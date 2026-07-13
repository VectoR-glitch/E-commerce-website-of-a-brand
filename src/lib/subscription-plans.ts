import "server-only";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/products";
import { sendSubscriptionPlanReminder } from "@/lib/email";
import { SITE_URL } from "@/lib/constants";
import { intervalLabel } from "@/lib/subscriptions";
import type { SubscriptionPlanStatus } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
// Claim window for sendDuePlanReminders — mirrors sendDueSubscriptionReminders.
const CLAIM_WINDOW_MS = 10 * 60 * 1000;

// A plan's discount is realised through a private, per-plan coupon so the
// existing checkout/settlement discount pipeline is reused unchanged for
// FUTURE reorders (same trick as kits and the single-item Subscription).
// Unlike SUB- codes, this one always gets `customerId` set at creation (see
// the SubscriptionPlan schema comment) rather than relying only on its
// unguessable suffix.
export const subscriptionPlanCouponCode = (id: string) => `SUBPLAN-${id.slice(-8).toUpperCase()}`;

export type SubscriptionPlanItemView = {
  variantId: string;
  productSlug: string;
  productName: string;
  fragrance: string | null;
  size: string;
  sku: string;
  image?: string;
  quantity: number;
  unitPaise: number;
  unitDiscountedPaise: number;
  available: boolean;
};

export type SubscriptionPlanView = {
  id: string;
  status: SubscriptionPlanStatus;
  intervalDays: number;
  intervalLabel: string;
  discountPercent: number;
  nextDeliveryAt: Date;
  couponCode: string;
  items: SubscriptionPlanItemView[];
  totalDiscountedPaise: number;
  available: boolean; // false if every item went inactive
};

// Builds the display views for a customer's multi-item plans, resolving live
// price/image the same way the storefront does — mirrors
// getCustomerSubscriptions in subscriptions.ts, generalized to several items
// per plan. Ordered active-first.
export async function getCustomerSubscriptionPlans(customerId: string): Promise<SubscriptionPlanView[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { customerId, status: { not: "CANCELLED" } },
    orderBy: [{ status: "asc" }, { nextDeliveryAt: "asc" }],
    include: {
      items: { include: { variant: { include: { product: { select: { slug: true, active: true } } } } } },
    },
  });
  if (plans.length === 0) return [];

  const slugs = [...new Set(plans.flatMap((p) => p.items.map((it) => it.variant.product.slug)))];
  const products = new Map(await Promise.all(slugs.map(async (s) => [s, await getProduct(s)] as const)));

  return plans.map((p) => {
    const items: SubscriptionPlanItemView[] = p.items.map((it) => {
      const v = it.variant;
      const product = products.get(v.product.slug);
      const frag = v.fragrance ?? null;
      const image = product
        ? (frag ? product.variantImages?.[`${frag}|${v.size}`] : undefined) ??
          (frag ? product.fragranceImages?.[frag] : undefined) ??
          product.image
        : undefined;
      const unitDiscountedPaise = Math.round(v.pricePaise * (1 - p.discountPercent / 100));
      return {
        variantId: v.id,
        productSlug: v.product.slug,
        productName: product?.name ?? v.product.slug,
        fragrance: frag,
        size: v.size,
        sku: v.sku,
        image,
        quantity: it.quantity,
        unitPaise: v.pricePaise,
        unitDiscountedPaise,
        available: Boolean(product) && v.active && v.product.active,
      };
    });
    const totalDiscountedPaise = items.reduce((s, it) => s + it.unitDiscountedPaise * it.quantity, 0);
    return {
      id: p.id,
      status: p.status,
      intervalDays: p.intervalDays,
      intervalLabel: intervalLabel(p.intervalDays),
      discountPercent: p.discountPercent,
      nextDeliveryAt: p.nextDeliveryAt,
      couponCode: p.couponCode,
      items,
      totalDiscountedPaise,
      available: items.some((it) => it.available),
    };
  });
}

// Active plans whose next delivery has come due. Basis for the reminder run
// below and the admin "N due" count.
export async function getDuePlans() {
  return prisma.subscriptionPlan.findMany({
    where: { status: "ACTIVE", nextDeliveryAt: { lte: new Date() } },
    orderBy: { nextDeliveryAt: "asc" },
    include: {
      customer: { select: { email: true, name: true } },
      items: { include: { variant: { include: { product: { select: { name: true, active: true } } } } } },
    },
  });
}

// Sends each due plan's refill reminder, then rolls the schedule forward one
// interval — mirrors sendDueSubscriptionReminders exactly (same claim guard,
// same roll-forward-only-on-success logic). A plan is skipped entirely only
// if EVERY item has gone inactive; otherwise the email lists just the
// still-available items, so one discontinued product doesn't block a
// reminder for the rest of the box.
export async function sendDuePlanReminders(): Promise<{ sent: number; failed: number }> {
  const due = await getDuePlans();
  let sent = 0;
  let failed = 0;

  for (const p of due) {
    const availableItems = p.items.filter((it) => it.variant.active && it.variant.product.active);
    if (availableItems.length === 0) continue;

    // Claim this plan's reminder before sending — same guarded update pattern
    // as sendDueSubscriptionReminders, so the daily cron and a manual admin
    // "send due reminders" click racing each other can't both email the
    // customer for the same cycle.
    const claimed = await prisma.subscriptionPlan.updateMany({
      where: {
        id: p.id,
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(Date.now() - CLAIM_WINDOW_MS) } }],
      },
      data: { lastReminderAt: new Date() },
    });
    if (claimed.count === 0) continue;

    const emailItems = availableItems.map((it) => ({
      productName: it.variant.product.name,
      variantLabel: [it.variant.fragrance, it.variant.size].filter(Boolean).join(" · "),
      quantity: it.quantity,
      unitDiscountedPaise: Math.round(it.variant.pricePaise * (1 - p.discountPercent / 100)),
    }));
    const totalDiscountedPaise = emailItems.reduce((s, it) => s + it.unitDiscountedPaise * it.quantity, 0);

    try {
      await sendSubscriptionPlanReminder({
        to: p.customer.email,
        name: p.customer.name,
        discountPercent: p.discountPercent,
        items: emailItems,
        totalDiscountedPaise,
        manageUrl: `${SITE_URL}/account/subscriptions`,
      });
      sent++;

      // Only roll the schedule forward on a successful send — otherwise a
      // transient outage would silently skip this customer's whole cycle
      // with no retry. Rolls from the due date, skipping any cycles already
      // in the past, so a long-idle plan lands on a future date.
      let next = p.nextDeliveryAt.getTime() + p.intervalDays * DAY_MS;
      const now = Date.now();
      while (next <= now) next += p.intervalDays * DAY_MS;
      await prisma.subscriptionPlan.update({
        where: { id: p.id },
        data: { lastReminderAt: new Date(), nextDeliveryAt: new Date(next) },
      });
    } catch (err) {
      console.error(`Subscription plan reminder failed for plan ${p.id} (${p.customer.email}):`, err);
      failed++;
      // Leave nextDeliveryAt untouched — the next daily sweep retries this cycle.
    }
  }

  return { sent, failed };
}
