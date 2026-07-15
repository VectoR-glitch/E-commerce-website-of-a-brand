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

// KIT-<slug>, SUB-<id>, SUBPLAN-<id>, and LOYAL-<suffix> codes are all
// system-managed — never hand-creatable or hand-deletable via the generic
// Coupons admin page. KIT-/SUB- are kept in sync by the Bundles/Subscriptions
// admin pages (syncBundleCoupon in admin/actions.ts, syncSubscriptionCoupon in
// app/actions/subscriptions.ts); deleting one via the generic page leaves its
// bundle/subscription still showing "Active" with a discount that silently
// stops applying. LOYAL- codes are minted by redeemPoints (lib/loyalty.ts),
// always scoped to the customer who earned them via `customerId` — a
// hand-created LOYAL- coupon on the generic form defaults customerId to null,
// bypassing that scoping and making one customer's reward usable by anyone
// (this exact gap caused a real production incident — a null-customerId
// LOYAL- row was found and fixed 2026-07-13). SUBPLAN- codes are minted by
// settleOrderPaid (lib/orders.ts) for multi-item subscription plans; they DO
// set customerId at creation, but are blocked here too, defense-in-depth.
// Manage all four from their own page instead (Bundles / Subscriptions /
// Subscription plans / the customer's loyalty ledger).
export function isSystemCouponCode(code: string): boolean {
  return (
    code.startsWith("KIT-") ||
    code.startsWith("SUB-") ||
    code.startsWith("SUBPLAN-") ||
    code.startsWith("LOYAL-")
  );
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

// SUB-/SUBPLAN- codes are visible to their own customer (shown on the account
// page, passed into the reorder button) so they can be applied manually at
// checkout — but that code is meant to discount a REORDER of the subscribed
// item(s), not an arbitrary unrelated cart. Unlike a third party guessing the
// code (which the unguessable id-suffix already defends against), the
// legitimate owner can see and enter their own code against any cart, so gate
// it the same way KIT- is: require the subscribed item(s) to actually be
// present. The id is looked up by its coupon-code suffix since neither
// subscriptionCouponCode nor subscriptionPlanCouponCode store the reverse
// mapping anywhere.
async function subscriptionGate(code: string, cart: CartLine[]): Promise<string | null> {
  const have = new Map(cart.map((l) => [l.variantId, l.quantity]));

  if (code.startsWith("SUB-")) {
    const sub = await prisma.subscription.findFirst({
      where: { id: { endsWith: code.slice(4).toLowerCase() } },
      select: { variantId: true, quantity: true },
    });
    if (!sub) return null; // orphan code → treat as a normal coupon
    if ((have.get(sub.variantId) ?? 0) < sub.quantity) {
      return "This code only applies when your subscribed item is in your cart.";
    }
    return null;
  }

  if (code.startsWith("SUBPLAN-")) {
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: { endsWith: code.slice(8).toLowerCase() } },
      include: { items: { select: { variantId: true, quantity: true } } },
    });
    if (!plan) return null; // orphan code → treat as a normal coupon
    for (const it of plan.items) {
      if ((have.get(it.variantId) ?? 0) < it.quantity) {
        return "This code only applies when your subscription box's items are in your cart.";
      }
    }
    return null;
  }

  return null; // not a subscription coupon
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
  const gate = (await bundleGate(code, cart)) ?? (await subscriptionGate(code, cart));
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

// Every active coupon that currently qualifies for this cart — for the
// checkout "available offers" dropdown. Two different exclusion reasons here,
// don't conflate them:
//  - SUB-/LOYAL- are hard-excluded, always. Both are genuinely private:
//    SUB- codes are meant to stay unguessable (only ever shown in the
//    customer's own reminder email/account), and LOYAL- codes are scoped to
//    the specific customer who redeemed them via `customerId`. Listing either
//    here would hand one customer's private code/reward to every visitor —
//    exactly the shape of a null-customerId LOYAL- row found in production
//    2026-07-13 (see isSystemCouponCode).
//  - KIT- codes are NOT excluded — they're already meant to be publicly
//    visible (shown on the kit's own page), gated by cart contents rather
//    than customer identity. They're only included here when `bundleGate`
//    actually passes for the current cart, so the dropdown never offers a
//    kit discount the customer can't actually use yet.
export async function listAvailableCoupons(
  subtotalPaise: number,
  cart: CartLine[] = [],
): Promise<AvailableCoupon[]> {
  const now = new Date();
  const candidates = await prisma.coupon.findMany({
    where: {
      active: true,
      customerId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  const results: AvailableCoupon[] = [];
  for (const c of candidates) {
    if (c.code.startsWith("SUB-") || c.code.startsWith("LOYAL-")) continue;
    if (c.maxUses != null && c.usedCount >= c.maxUses) continue;
    if (subtotalPaise < c.minOrderPaise) continue;
    if (c.code.startsWith("KIT-") && (await bundleGate(c.code, cart))) continue;
    results.push({ code: c.code, ...computeDiscount(c, subtotalPaise) });
  }
  return results;
}
