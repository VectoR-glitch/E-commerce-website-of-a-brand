// Server-only order settlement. Shared by the client-side payment verify route
// and the Razorpay webhook so both reconcile an order through ONE idempotent,
// race-safe path. Never import from client code.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextInvoiceNumber } from "@/lib/gst";
import { subscriptionPlanCouponCode } from "@/lib/subscription-plans";
import { SUBSCRIBE_SAVE_PERCENT } from "@/lib/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/**
 * "Build a box" checkout: create the recurring SubscriptionPlan once its
 * founding order has genuinely settled CONFIRMED with no holdReasons — an
 * order that's ON_HOLD (e.g. a stock shortfall) must not spawn a plan
 * promising deliveries it just failed to fulfill. Called both from the
 * winning settlement claim below AND from updateOrderStatus's ON_HOLD →
 * CONFIRMED transition (admin/actions.ts) — a subscription checkout that
 * lands ON_HOLD at settlement (e.g. a stock race) must still get its plan
 * once staff resolve the hold, not silently never enroll the customer who
 * already paid the discounted subscribe-and-save price.
 *
 * `subscriptionPlanId == null` is defense in depth: each caller's own claim
 * already guarantees this runs at most once per order under normal
 * operation, but this guard means even a re-entry that somehow got past that
 * claim can't silently orphan the original plan by creating and linking a
 * second one.
 */
export async function createSubscriptionPlanFromOrder(
  tx: Prisma.TransactionClient,
  order: OrderWithItems,
): Promise<void> {
  if (order.subscriptionIntervalDays == null || order.subscriptionPlanId != null) return;
  const plan = await tx.subscriptionPlan.create({
    data: {
      customerId: order.customerId!, // guaranteed by /api/checkout's session check
      intervalDays: order.subscriptionIntervalDays,
      discountPercent: SUBSCRIBE_SAVE_PERCENT,
      nextDeliveryAt: new Date(Date.now() + order.subscriptionIntervalDays * DAY_MS),
      couponCode: `PENDING-${order.id}`, // placeholder, overwritten immediately below
      items: {
        create: order.items
          .filter((it) => it.variantId)
          .map((it) => ({ variantId: it.variantId!, quantity: it.quantity })),
      },
    },
  });
  const couponCode = subscriptionPlanCouponCode(plan.id);
  await tx.subscriptionPlan.update({ where: { id: plan.id }, data: { couponCode } });
  await tx.coupon.create({
    data: {
      code: couponCode,
      type: "PERCENT",
      value: SUBSCRIBE_SAVE_PERCENT,
      minOrderPaise: 0,
      active: true,
      customerId: order.customerId,
    },
  });
  await tx.order.update({ where: { id: order.id }, data: { subscriptionPlanId: plan.id } });
}

type SettleResult =
  | {
      ok: true;
      orderNumber: string;
      /** true only for the caller that won the PENDING→PAID flip — use this to
       *  fire side effects (e.g. confirmation email) exactly once. */
      newlySettled: boolean;
      order: OrderWithItems;
    }
  | { ok: false; reason: "not_found" };

/**
 * Settles a captured Razorpay payment against its PENDING order — exactly once.
 *
 * The amount captured depends on the payment method:
 *   - ONLINE: the full order total was paid → paymentStatus PAID.
 *   - COD:    only the delivery fee was prepaid → paymentStatus PARTIALLY_PAID,
 *             with the goods (totalPaise - amountPaidPaise) still due as cash on
 *             delivery.
 * Stock is decremented with a GUARDED update (only when enough remains), so a
 * stock change between order creation and payment can never push it negative.
 * If every line is satisfiable the order moves to CONFIRMED; if any line falls
 * short the order is left ON_HOLD for staff (the payment is already captured —
 * we never silently confirm an order we can't fulfill).
 *
 * Race-safety: the PENDING→settled flip is an atomic conditional `updateMany`
 * inside a transaction. Only the caller that wins that flip (claimed.count === 1)
 * decrements stock; a concurrent verify+webhook for the same order finds
 * count === 0 and returns success without touching stock again. So a customer
 * closing the tab (browser verify never runs) OR a double-fire both land here
 * safely.
 *
 * `signature` is the per-payment HMAC from the browser flow; the webhook has no
 * such value (it authenticates via its own body signature), so it's optional.
 */
export async function settleOrderPaid(params: {
  razorpayOrderId: string;
  paymentId: string;
  signature?: string;
}): Promise<SettleResult> {
  const { razorpayOrderId, paymentId, signature } = params;

  // This transaction does several sequential round-trips (order lookup, stock
  // decrements, coupon/loyalty updates, invoice number allocation, re-read) —
  // enough that Prisma's 5s interactive-transaction default was observed
  // expiring mid-flight in production (P2028, ~7s elapsed) against Neon.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true },
    });
    if (!existing) return { ok: false, reason: "not_found" };

    // COD prepays only the delivery fee; online pays the whole total.
    const isCod = existing.paymentMethod === "COD";
    const amountPaidPaise = isCod ? existing.shippingPaise : existing.totalPaise;

    // Claim the settlement by flipping paymentStatus off PENDING *or* FAILED.
    // FAILED is set by the verify route on a bad signature, but that's just a
    // local guess (a stray retry, a network hiccup, tampering) — Razorpay's own
    // webhook is the actual source of truth for whether money moved, so a real
    // payment must still be able to settle an order this route previously
    // marked FAILED. The final order status is set AFTER the stock check
    // below, so we don't confirm an order we then find we can't fulfill.
    const claimed = await tx.order.updateMany({
      where: { razorpayOrderId, paymentStatus: { in: ["PENDING", "FAILED"] } },
      data: {
        paymentStatus: isCod ? "PARTIALLY_PAID" : "PAID",
        amountPaidPaise,
        razorpayPaymentId: paymentId,
        ...(signature ? { razorpaySignature: signature } : {}),
      },
    });

    // Someone already settled this order — idempotent success, no re-decrement
    // and no duplicate side effects.
    if (claimed.count === 0) {
      return { ok: true, orderNumber: existing.orderNumber, newlySettled: false, order: existing };
    }

    // We won the claim: decrement each line with a GUARDED update that only
    // matches rows with enough stock — so it can never go negative. A line that
    // can't be satisfied flags the whole order for staff review (ON_HOLD).
    // Reasons accumulate (rather than a single boolean) so an order held for
    // BOTH a stock shortfall and a coupon-cap overage doesn't leave staff
    // guessing which guard actually tripped — that ambiguity only grows now
    // that there are two distinct causes funneling into the same status.
    const holdReasons: string[] = [];
    for (const item of existing.items) {
      if (!item.variantId) continue;
      const dec = await tx.variant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (dec.count === 0) {
        holdReasons.push(`Insufficient stock for ${item.sku} (need ${item.quantity})`);
      } else {
        // Recorded per-line (not inferred from the order's eventual status)
        // so a later cancel/return restocks exactly what was actually taken —
        // an order held for a coupon-cap reason alone still has every line's
        // stock genuinely committed, while one held for a stock shortfall on
        // a SPECIFIC line does not, for that line only.
        await tx.orderItem.update({ where: { id: item.id }, data: { stockCommitted: true } });
      }
    }

    // Count the coupon redemption exactly once, here in the winning claim, so a
    // concurrent verify+webhook can't double-count it. Guarded the same way as
    // stock above: only claim a redemption slot if the cap hasn't been reached,
    // via a compare-and-swap on the usedCount just read — so two concurrent
    // settlements racing the same single-use code can't both commit. The
    // payment is already captured, so a lost race doesn't block the order,
    // just flags it (like a stock shortfall) for staff to review.
    let couponRedeemed = false;
    if (existing.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: existing.couponCode } });
      if (coupon) {
        const capOk = coupon.maxUses == null || coupon.usedCount < coupon.maxUses;
        const claimedRedemption = capOk
          ? await tx.coupon.updateMany({
              where: { code: existing.couponCode, usedCount: coupon.usedCount },
              data: { usedCount: { increment: 1 } },
            })
          : { count: 0 };
        if (claimedRedemption.count === 0) {
          holdReasons.push(`Coupon ${existing.couponCode} redemption cap reached`);
        } else {
          couponRedeemed = true;
        }
      }
    }

    await tx.order.update({
      where: { id: existing.id },
      data: {
        status: holdReasons.length ? "ON_HOLD" : "CONFIRMED",
        holdReason: holdReasons.length ? holdReasons.join("; ") : null,
        couponRedeemed,
      },
    });

    // There's no "pending" state to clean up if this order never settles
    // cleanly: nothing subscription-plan-related is written here unless
    // holdReasons is empty, so an abandoned/failed checkout leaves no
    // residue, same as any other abandoned order today. If it DOES land
    // ON_HOLD, updateOrderStatus's ON_HOLD → CONFIRMED transition calls this
    // same function again once staff resolve the hold (see its own comment).
    if (holdReasons.length === 0) {
      await createSubscriptionPlanFromOrder(tx, existing);
    }

    // Loyalty is NOT credited here — it's awarded only once the order is later
    // marked DELIVERED (see awardLoyaltyForDeliveredOrder in admin/actions.ts),
    // so a settled-but-cancelled/returned order never earns points.

    // Allocate the GST invoice number exactly once, here in the winning claim
    // — a sequential number must never be issued twice or skipped.
    const invoiceGeneratedAt = new Date();
    const invoiceNumber = await nextInvoiceNumber(tx, invoiceGeneratedAt);
    await tx.order.update({
      where: { id: existing.id },
      data: { invoiceNumber, invoiceGeneratedAt },
    });

    // Re-read so the returned order (used for the confirmation email) reflects
    // the settled status + amountPaidPaise we just wrote.
    const order = await tx.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true },
    });
    return {
      ok: true,
      orderNumber: existing.orderNumber,
      newlySettled: true,
      order: order ?? existing,
    };
  }, { timeout: 20_000 });
}
