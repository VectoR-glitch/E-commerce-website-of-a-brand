import "server-only";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/products";
import { sendSubscriptionReminder } from "@/lib/email";
import { SUBSCRIBE_INTERVALS, SITE_URL } from "@/lib/constants";
import type { SubscriptionStatus } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// A subscription's discount is realised through a private, per-subscription
// coupon so the existing checkout/settlement discount pipeline is reused
// unchanged (same trick as kits). Unlike KIT- codes, a SUB- code is NEVER
// rendered in public page source — only in the owner's reminder email and their
// own account page — so its unguessable cuid suffix is sufficient protection;
// no cart gate needed.
export const subscriptionCouponCode = (id: string) => `SUB-${id.slice(-8).toUpperCase()}`;

export const intervalLabel = (days: number) =>
  SUBSCRIBE_INTERVALS.find((i) => i.days === days)?.label ?? `Every ${days} days`;

export type SubscriptionView = {
  id: string;
  status: SubscriptionStatus;
  quantity: number;
  intervalDays: number;
  intervalLabel: string;
  discountPercent: number;
  nextDeliveryAt: Date;
  couponCode: string;
  // resolved product/variant display
  variantId: string;
  productSlug: string;
  productName: string;
  fragrance: string | null;
  size: string;
  sku: string;
  image?: string;
  unitPaise: number; // current price
  unitDiscountedPaise: number; // after the subscription's % off
  available: boolean; // false if the variant/product went inactive
};

// Builds the display views for a customer's subscriptions, resolving live
// price/image the same way the storefront does. Ordered active-first.
export async function getCustomerSubscriptions(customerId: string): Promise<SubscriptionView[]> {
  const subs = await prisma.subscription.findMany({
    where: { customerId, status: { not: "CANCELLED" } },
    orderBy: [{ status: "asc" }, { nextDeliveryAt: "asc" }],
    include: { variant: { include: { product: { select: { slug: true, active: true } } } } },
  });
  if (subs.length === 0) return [];

  const slugs = [...new Set(subs.map((s) => s.variant.product.slug))];
  const products = new Map(await Promise.all(slugs.map(async (s) => [s, await getProduct(s)] as const)));

  return subs.map((s) => {
    const v = s.variant;
    const product = products.get(v.product.slug);
    const frag = v.fragrance ?? null;
    const image = product
      ? (frag ? product.variantImages?.[`${frag}|${v.size}`] : undefined) ??
        (frag ? product.fragranceImages?.[frag] : undefined) ??
        product.image
      : undefined;
    const unitDiscountedPaise = Math.round(v.pricePaise * (1 - s.discountPercent / 100));
    return {
      id: s.id,
      status: s.status,
      quantity: s.quantity,
      intervalDays: s.intervalDays,
      intervalLabel: intervalLabel(s.intervalDays),
      discountPercent: s.discountPercent,
      nextDeliveryAt: s.nextDeliveryAt,
      couponCode: subscriptionCouponCode(s.id),
      variantId: v.id,
      productSlug: v.product.slug,
      productName: product?.name ?? v.product.slug,
      fragrance: frag,
      size: v.size,
      sku: v.sku,
      image,
      unitPaise: v.pricePaise,
      unitDiscountedPaise,
      available: Boolean(product) && v.active && v.product.active,
    };
  });
}

// Active subscriptions whose next delivery has come due (nextDeliveryAt in the
// past). Basis for the reminder run below and the admin "N due" count.
export async function getDueSubscriptions() {
  return prisma.subscription.findMany({
    where: { status: "ACTIVE", nextDeliveryAt: { lte: new Date() } },
    orderBy: { nextDeliveryAt: "asc" },
    include: {
      customer: { select: { email: true, name: true } },
      variant: { include: { product: { select: { name: true, active: true } } } },
    },
  });
}

// Sends each due subscriber their refill reminder, then rolls the schedule
// forward one interval (managed model: the cadence advances on reminder; the
// customer places the order when ready). Idempotent-ish — once rolled forward,
// a subscription won't be due again until its next cycle. Intended to be called
// by a daily cron; for now the admin panel triggers it manually. Returns counts.
export async function sendDueSubscriptionReminders(): Promise<{ sent: number; failed: number }> {
  const due = await getDueSubscriptions();
  let sent = 0;
  let failed = 0;

  for (const s of due) {
    // Skip items that went inactive — don't nudge a customer toward a dead SKU.
    if (!s.variant.active || !s.variant.product.active) continue;

    const variantLabel = [s.variant.fragrance, s.variant.size].filter(Boolean).join(" · ");
    const unitDiscountedPaise = Math.round(s.variant.pricePaise * (1 - s.discountPercent / 100));
    try {
      await sendSubscriptionReminder({
        to: s.customer.email,
        name: s.customer.name,
        productName: s.variant.product.name,
        variantLabel,
        quantity: s.quantity,
        discountPercent: s.discountPercent,
        unitDiscountedPaise,
        manageUrl: `${SITE_URL}/account/subscriptions`,
      });
      sent++;

      // Only roll the schedule forward on a successful send — otherwise a
      // transient outage (bad API key, Resend down) would silently skip this
      // customer's whole cycle with no retry. Rolls from the due date,
      // skipping any cycles already in the past, so a long-idle subscription
      // lands on a future date.
      let next = s.nextDeliveryAt.getTime() + s.intervalDays * DAY_MS;
      const now = Date.now();
      while (next <= now) next += s.intervalDays * DAY_MS;
      await prisma.subscription.update({
        where: { id: s.id },
        data: { lastReminderAt: new Date(), nextDeliveryAt: new Date(next) },
      });
    } catch (err) {
      console.error(`Subscription reminder failed for subscription ${s.id} (${s.customer.email}):`, err);
      failed++;
      // Leave nextDeliveryAt untouched — the next daily sweep retries this cycle.
    }
  }

  return { sent, failed };
}
