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
    await tx.subscriptionPlan.update({ where: { id }, data: { status: "PAUSED" } });
    // Deactivate the private coupon too — otherwise it keeps discounting any
    // reorder indefinitely while the account page shows "Paused."
    await tx.coupon.update({ where: { code: plan.couponCode }, data: { active: false } });
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
    await tx.subscriptionPlan.update({ where: { id }, data: { status: "ACTIVE", nextDeliveryAt } });
    await tx.coupon.update({ where: { code: plan.couponCode }, data: { active: true } });
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
  await prisma.subscriptionPlan.update({ where: { id }, data: { nextDeliveryAt } });
  revalidatePath("/account/subscriptions");
}

export async function cancelSubscriptionPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("planId") ?? "");
  const plan = await ownedPlan(id, session.sub);
  if (!plan) return;
  await prisma.$transaction([
    prisma.subscriptionPlan.update({ where: { id }, data: { status: "CANCELLED" } }),
    // Retire the private coupon so it can't be reused after cancelling.
    prisma.coupon.deleteMany({ where: { code: plan.couponCode } }),
  ]);
  revalidatePath("/account/subscriptions");
}
