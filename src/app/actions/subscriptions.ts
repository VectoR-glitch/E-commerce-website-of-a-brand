"use server";
// Customer-facing "subscribe & save" actions. Server Actions are POST-reachable,
// so each re-checks auth AND ownership itself — the UI is not a security
// boundary. A subscription mirrors a private per-subscription coupon (SUB-<id>)
// so the discount flows through the existing checkout/settlement pipeline.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { subscriptionCouponCode } from "@/lib/subscriptions";
import { SUBSCRIBE_SAVE_PERCENT, SUBSCRIBE_INTERVALS, MAX_QTY_PER_ITEM } from "@/lib/constants";

export type SubscribeState = { ok?: boolean; error?: string } | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;
const validInterval = (days: number) => SUBSCRIBE_INTERVALS.some((i) => i.days === days);

// Mirror (or refresh) the private coupon that carries this subscription's saving.
async function syncSubscriptionCoupon(id: string, percent: number, active: boolean): Promise<void> {
  const code = subscriptionCouponCode(id);
  await prisma.coupon.upsert({
    where: { code },
    create: { code, type: "PERCENT", value: percent, minOrderPaise: 0, active },
    update: { value: percent, active },
  });
}

// Create (or refresh) a subscription for a variant. One non-cancelled
// subscription per customer+variant — re-subscribing updates the existing one.
export async function createSubscription(input: {
  variantId: string;
  intervalDays: number;
  quantity: number;
}): Promise<SubscribeState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to subscribe." };

  const variantId = String(input.variantId ?? "");
  const intervalDays = Math.round(Number(input.intervalDays));
  const quantity = Math.min(Math.max(1, Math.round(Number(input.quantity)) || 1), MAX_QTY_PER_ITEM);

  if (!variantId) return { error: "Please choose a product option first." };
  if (!validInterval(intervalDays)) return { error: "Please choose a delivery frequency." };

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, active: true, product: { active: true } },
    select: { id: true, product: { select: { slug: true } } },
  });
  if (!variant) return { error: "This item isn't available to subscribe to." };

  const nextDeliveryAt = new Date(Date.now() + intervalDays * DAY_MS);
  const existing = await prisma.subscription.findFirst({
    where: { customerId: session.sub, variantId, status: { not: "CANCELLED" } },
    select: { id: true },
  });

  const sub = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: { intervalDays, quantity, discountPercent: SUBSCRIBE_SAVE_PERCENT, status: "ACTIVE", nextDeliveryAt },
      })
    : await prisma.subscription.create({
        data: {
          customerId: session.sub,
          variantId,
          quantity,
          intervalDays,
          discountPercent: SUBSCRIBE_SAVE_PERCENT,
          nextDeliveryAt,
        },
      });

  await syncSubscriptionCoupon(sub.id, SUBSCRIBE_SAVE_PERCENT, true);
  revalidatePath("/account/subscriptions");
  revalidatePath(`/product/${variant.product.slug}`);
  return { ok: true };
}

// Loads a subscription only if it belongs to the signed-in customer.
async function ownedSub(id: string, customerId: string) {
  if (!id) return null;
  return prisma.subscription.findFirst({ where: { id, customerId } });
}

export async function pauseSubscription(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("subscriptionId") ?? "");
  const sub = await ownedSub(id, session.sub);
  if (!sub || sub.status === "CANCELLED") return;
  await prisma.subscription.update({ where: { id }, data: { status: "PAUSED" } });
  // Deactivate the private coupon too — otherwise it keeps discounting any
  // order indefinitely while the account page shows "Paused."
  await syncSubscriptionCoupon(id, sub.discountPercent, false);
  revalidatePath("/account/subscriptions");
}

export async function resumeSubscription(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("subscriptionId") ?? "");
  const sub = await ownedSub(id, session.sub);
  if (!sub || sub.status !== "PAUSED") return;
  // Push the next delivery to a fresh full interval from today.
  const nextDeliveryAt = new Date(Date.now() + sub.intervalDays * DAY_MS);
  await prisma.subscription.update({ where: { id }, data: { status: "ACTIVE", nextDeliveryAt } });
  await syncSubscriptionCoupon(id, sub.discountPercent, true);
  revalidatePath("/account/subscriptions");
}

// Skip this cycle — advance the next delivery by one interval.
export async function skipSubscription(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("subscriptionId") ?? "");
  const sub = await ownedSub(id, session.sub);
  if (!sub || sub.status !== "ACTIVE") return;
  const base = Math.max(sub.nextDeliveryAt.getTime(), Date.now());
  const nextDeliveryAt = new Date(base + sub.intervalDays * DAY_MS);
  await prisma.subscription.update({ where: { id }, data: { nextDeliveryAt } });
  revalidatePath("/account/subscriptions");
}

export async function cancelSubscription(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("subscriptionId") ?? "");
  const sub = await ownedSub(id, session.sub);
  if (!sub) return;
  await prisma.subscription.update({ where: { id }, data: { status: "CANCELLED" } });
  // Retire the private coupon so it can't be reused after cancelling.
  await prisma.coupon.deleteMany({ where: { code: subscriptionCouponCode(id) } });
  revalidatePath("/account/subscriptions");
}
