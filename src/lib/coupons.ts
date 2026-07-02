import "server-only";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/catalog";

// One place that decides whether a coupon applies and what it's worth, so the
// live checkout preview and the authoritative checkout route can never disagree.
export type CouponResult =
  | { ok: true; code: string; discountPaise: number; label: string }
  | { ok: false; error: string };

export type CartLine = { variantId: string; quantity: number };

// A bundle's discount is realised through a coupon whose code (KIT-<slug>) is
// necessarily visible on the storefront. To stop customers from lifting that
// code and using it off-kit, a KIT- coupon only applies when the cart actually
// contains the bundle's items. Returns an error string if the gate fails.
async function bundleGate(code: string, cart: CartLine[]): Promise<string | null> {
  if (!code.startsWith("KIT-")) return null; // not a bundle coupon
  const slug = code.slice(4).toLowerCase();
  const bundle = await prisma.bundle.findUnique({
    where: { slug },
    include: { items: true },
  });
  if (!bundle) return null; // orphan KIT- code (no bundle) → treat as a normal coupon
  if (!bundle.active) return "This kit is no longer available.";

  const have = new Map(cart.map((l) => [l.variantId, l.quantity]));
  const missing = bundle.items.some((it) => (have.get(it.variantId) ?? 0) < it.quantity);
  if (missing) {
    return "This code only applies when the kit’s items are in your cart. Add the kit from the shop.";
  }
  return null;
}

export async function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
  cart: CartLine[] = [],
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

  // Bundle codes are gated on the cart containing the kit — so the publicly
  // visible KIT-<slug> code can't be applied to an arbitrary order.
  const gate = await bundleGate(code, cart);
  if (gate) return { ok: false, error: gate };

  // PERCENT → % of subtotal; FIXED → flat paise. Never exceed the subtotal
  // (a discount can zero the goods but not the shipping).
  const raw =
    c.type === "PERCENT" ? Math.round(subtotalPaise * (c.value / 100)) : c.value;
  const discountPaise = Math.min(raw, subtotalPaise);
  const label = c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`;

  return { ok: true, code, discountPaise, label };
}
