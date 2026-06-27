// Server-only order settlement. Shared by the client-side payment verify route
// and the Razorpay webhook so both reconcile an order through ONE idempotent,
// race-safe path. Never import from client code.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

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
 * Either way the order moves to CONFIRMED and stock is decremented.
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

  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true },
    });
    if (!existing) return { ok: false, reason: "not_found" };

    // COD prepays only the delivery fee; online pays the whole total.
    const isCod = existing.paymentMethod === "COD";
    const amountPaidPaise = isCod ? existing.shippingPaise : existing.totalPaise;

    const claimed = await tx.order.updateMany({
      where: { razorpayOrderId, paymentStatus: "PENDING" },
      data: {
        paymentStatus: isCod ? "PARTIALLY_PAID" : "PAID",
        status: "CONFIRMED",
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

    // We won the claim: decrement stock for each line that maps to a variant.
    for (const item of existing.items) {
      if (item.variantId) {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

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
  });
}
