"use server";
// Customer-facing multi-item "subscription plan" actions — mirrors
// src/app/actions/subscriptions.ts 1:1 for the bigger, multi-product sibling.
// Server Actions are POST-reachable, so each re-checks auth AND ownership
// itself — the UI is not a security boundary.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

// Loads a plan only if it belongs to the signed-in customer.
async function ownedPlan(id: string, customerId: string) {
  if (!id) return null;
  return prisma.subscriptionPlan.findFirst({ where: { id, customerId } });
}

export async function pauseSubscriptionPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("planId") ?? "");
  const plan = await ownedPlan(id, session.sub);
  if (!plan || plan.status === "CANCELLED") return;
  await prisma.$transaction(async (tx) => {
    // Guarded on the FROM-status read above, via updateMany not update — two
    // of these actions racing each other (double-click, two tabs, a pause
    // racing a cancel) could otherwise have the loser act on a stale premise:
    // resurrect a CANCELLED plan back to PAUSED, or (worse) throw P2025 on
    // the plain coupon.update below because a concurrent cancel's
    // coupon.deleteMany already removed the row it expects to find. A count
    // === 0 here means someone else already changed this plan — skip the
    // coupon sync too rather than acting on stale data.
    const claimed = await tx.subscriptionPlan.updateMany({
      where: { id, status: plan.status },
      data: { status: "PAUSED" },
    });
    if (claimed.count === 0) return;
    // Deactivate the private coupon too — otherwise it keeps discounting any
    // reorder indefinitely while the account page shows "Paused."
    await tx.coupon.updateMany({ where: { code: plan.couponCode }, data: { active: false } });
  });
  revalidatePath("/account/subscriptions");
}

export async function resumeSubscriptionPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("planId") ?? "");
  const plan = await ownedPlan(id, session.sub);
  if (!plan || plan.status !== "PAUSED") return;
  // Push the next delivery to a fresh full interval from today.
  const nextDeliveryAt = new Date(Date.now() + plan.intervalDays * DAY_MS);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.subscriptionPlan.updateMany({
      where: { id, status: "PAUSED" },
      data: { status: "ACTIVE", nextDeliveryAt },
    });
    if (claimed.count === 0) return;
    await tx.coupon.updateMany({ where: { code: plan.couponCode }, data: { active: true } });
  });
  revalidatePath("/account/subscriptions");
}

// Skip this cycle — advance the next delivery by one interval.
export async function skipSubscriptionPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("planId") ?? "");
  const plan = await ownedPlan(id, session.sub);
  if (!plan || plan.status !== "ACTIVE") return;
  const base = Math.max(plan.nextDeliveryAt.getTime(), Date.now());
  const nextDeliveryAt = new Date(base + plan.intervalDays * DAY_MS);
  // Guard on the nextDeliveryAt just read, not just status=ACTIVE — see
  // skipSubscription's comment in subscriptions.ts for why a status-only
  // guard doesn't protect against a double-click losing one skip.
  await prisma.subscriptionPlan.updateMany({
    where: { id, status: "ACTIVE", nextDeliveryAt: plan.nextDeliveryAt },
    data: { nextDeliveryAt },
  });
  revalidatePath("/account/subscriptions");
}

export async function cancelSubscriptionPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("planId") ?? "");
  const plan = await ownedPlan(id, session.sub);
  if (!plan || plan.status === "CANCELLED") return;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.subscriptionPlan.updateMany({
      where: { id, status: plan.status },
      data: { status: "CANCELLED" },
    });
    if (claimed.count === 0) return;
    // Retire the private coupon so it can't be reused after cancelling.
    await tx.coupon.deleteMany({ where: { code: plan.couponCode } });
  });
  revalidatePath("/account/subscriptions");
}
