import "server-only";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/catalog";

// One place that decides whether a coupon applies and what it's worth, so the
// live checkout preview and the authoritative checkout route can never disagree.
export type CouponResult =
  | { ok: true; code: string; discountPaise: number; label: string }
  | { ok: false; error: string };

export async function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };

  const c = await prisma.coupon.findUnique({ where: { code } });
  if (!c || !c.active) return { ok: false, error: "This code isn’t valid." };
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This code has expired." };
  }
  if (c.maxUses != null && c.usedCount >= c.maxUses) {
    return { ok: false, error: "This code has reached its usage limit." };
  }
  if (subtotalPaise < c.minOrderPaise) {
    return { ok: false, error: `Spend ${formatINR(c.minOrderPaise)} to use this code.` };
  }

  // PERCENT → % of subtotal; FIXED → flat paise. Never exceed the subtotal
  // (a discount can zero the goods but not the shipping).
  const raw =
    c.type === "PERCENT" ? Math.round(subtotalPaise * (c.value / 100)) : c.value;
  const discountPaise = Math.min(raw, subtotalPaise);
  const label = c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`;

  return { ok: true, code, discountPaise, label };
}
