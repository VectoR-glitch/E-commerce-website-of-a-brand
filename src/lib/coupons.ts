import "server-only";
import type { Coupon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/catalog";

// One place that decides whether a coupon applies and what it's worth, so the
// live checkout preview and the authoritative checkout route can never disagree.
export type CouponResult =
  | { ok: true; code: string; discountPaise: number; label: string }
  | { ok: false; error: string };

export type CartLine = { variantId: string; quantity: number };

// KIT-<slug>, SUB-<id>, and LOYAL-<suffix> codes are all system-managed —
// never hand-creatable or hand-deletable via the generic Coupons admin page.
// KIT-/SUB- are kept in sync by the Bundles/Subscriptions admin pages
// (syncBundleCoupon in admin/actions.ts, syncSubscriptionCoupon in
// app/actions/subscriptions.ts); deleting one via the generic page leaves its
// bundle/subscription still showing "Active" with a discount that silently
// stops applying. LOYAL- codes are minted by redeemPoints (lib/loyalty.ts),
// always scoped to the customer who earned them via `customerId` — a
// hand-created LOYAL- coupon on the generic form defaults customerId to null,
// bypassing that scoping and making one customer's reward usable by anyone.
// Manage all three from their own page instead (Bundles / Subscriptions / the
// customer's loyalty ledger).
export function isSystemCouponCode(code: string): boolean {
  return code.startsWith("KIT-") || code.startsWith("SUB-") || code.startsWith("LOYAL-");
}

// A bundle's discount is realised through a coupon whose code (KIT-<slug>) is
// necessarily visible on the storefront. To stop customers from lifting that
// code and using it off-kit, a KIT- coupon only applies when the cart actually
// contains the bundle's items. Returns an error string if the gate fails.
async function bundleGate(code: string, cart: CartLine[]): Promise<string | null> {
  if (!code.startsWith("KIT-")) return null; // not a bundle coupon
  const slug = code.slice(4).toLowerCase();
  const bundle = await prisma.bundle.findUnique({
    where: { slug },
    include: { items: { include: { product: { include: { variants: true } } } } },
  });
  if (!bundle) return null; // orphan KIT- code (no bundle) → treat as a normal coupon
  if (!bundle.active) return "This kit is no longer available.";

  const have = new Map(cart.map((l) => [l.variantId, l.quantity]));
  const notMet = "This code only applies when the kit’s items are in your cart. Add the kit from the shop.";

  for (const it of bundle.items) {
    if (it.variantId) {
      // Exact slot: that variant must be present in the required quantity.
      if ((have.get(it.variantId) ?? 0) < it.quantity) return notMet;
    } else if (it.productId && it.product) {
      // Product slot: any of the product's variants (matching the size lock)
      // must total at least the slot quantity.
      const eligible = new Set(
        it.product.variants
          .filter((v) => v.active && (!it.size || v.size === it.size))
          .map((v) => v.id),
      );
      let total = 0;
      for (const [variantId, qty] of have) {
        if (eligible.has(variantId)) total += qty;
      }
      if (total < it.quantity) return notMet;
    }
  }
  return null;
}

export async function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
  cart: CartLine[] = [],
  customerId: string | null = null,
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };

  const c = await prisma.coupon.findUnique({ where: { code } });
  if (!c || !c.active) return { ok: false, error: "This code isn’t valid." };
  // Customer-specific codes (loyalty vouchers) only redeem for the customer
  // who earned them — otherwise a leaked/guessed code lets anyone else spend
  // someone else's reward.
  if (c.customerId && c.customerId !== customerId) {
    return { ok: false, error: "This code isn’t valid." };
  }
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

  return { ok: true, code, ...computeDiscount(c, subtotalPaise) };
}

// PERCENT → % of subtotal; FIXED → flat paise. Never exceed the subtotal (a
// discount can zero the goods but not the shipping). Shared by validateCoupon
// and listAvailableCoupons so the two can never disagree on a coupon's worth.
function computeDiscount(
  c: Pick<Coupon, "type" | "value">,
  subtotalPaise: number,
): { discountPaise: number; label: string } {
  const raw = c.type === "PERCENT" ? Math.round(subtotalPaise * (c.value / 100)) : c.value;
  const discountPaise = Math.min(raw, subtotalPaise);
  const label = c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`;
  return { discountPaise, label };
}

export type AvailableCoupon = { code: string; label: string; discountPaise: number };

// Every active, publicly shareable coupon that currently qualifies for this
// cart — for the checkout "available offers" dropdown. Excludes KIT-/SUB-/
// LOYAL- codes (see isSystemCouponCode) and anything else customer-specific.
// The isSystemCouponCode check matters here even though the query already
// filters `customerId: null`: a LOYAL- coupon is SUPPOSED to always carry a
// customerId, but a null-customerId LOYAL- row was found in production
// 2026-07-13 (likely hand-created via the generic admin create-coupon form,
// which didn't reject that prefix before this fix) — without this filter it
// would have been listed here as a "public" coupon, exposing one specific
// customer's reward to every checkout visitor.
export async function listAvailableCoupons(subtotalPaise: number): Promise<AvailableCoupon[]> {
  const now = new Date();
  const candidates = await prisma.coupon.findMany({
    where: {
      active: true,
      customerId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  return candidates
    .filter((c) => !isSystemCouponCode(c.code))
    .filter((c) => c.maxUses == null || c.usedCount < c.maxUses)
    .filter((c) => subtotalPaise >= c.minOrderPaise)
    .map((c) => ({ code: c.code, ...computeDiscount(c, subtotalPaise) }));
}
