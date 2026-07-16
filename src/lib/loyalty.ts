import "server-only";
// Loyalty & referral engine. Points are ₹-denominated (see POINT_VALUE_PAISE):
// customers earn a % back once an order is DELIVERED (not merely paid — see
// awardLoyaltyForDeliveredOrder), and can convert points into a private,
// single-use discount voucher (LOYAL-<suffix>) that flows through the existing
// coupon pipeline — same trick as kits (KIT-) and subscriptions (SUB-).
// Referrals award both sides a one-off point bonus on the referred customer's
// first delivered order. Never import from client code.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  POINT_VALUE_PAISE,
  LOYALTY_TIERS,
  LOYALTY_MIN_REDEEM_POINTS,
  LOYALTY_VOUCHER_TTL_DAYS,
  REFERRAL_REFERRER_BONUS_POINTS,
  REFERRAL_REFEREE_BONUS_POINTS,
  SITE_URL,
} from "@/lib/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LoyaltyTier = {
  name: string;
  earnPercent: number;
  next: { name: string; pointsNeeded: number } | null;
};

// The tier a customer holds given their lifetime points earned — the last
// tier (LOYALTY_TIERS is ascending) whose threshold they've reached — plus how
// far they are from the next one (null once at the top tier).
export function loyaltyTier(lifetimePoints: number): LoyaltyTier {
  let current: (typeof LOYALTY_TIERS)[number] = LOYALTY_TIERS[0];
  let next: (typeof LOYALTY_TIERS)[number] | null = null;
  for (let i = 0; i < LOYALTY_TIERS.length; i++) {
    if (lifetimePoints >= LOYALTY_TIERS[i].minLifetimePoints) {
      current = LOYALTY_TIERS[i];
      next = LOYALTY_TIERS[i + 1] ?? null;
    }
  }
  return {
    name: current.name,
    earnPercent: current.earnPercent,
    next: next ? { name: next.name, pointsNeeded: next.minLifetimePoints - lifetimePoints } : null,
  };
}

// Points earned for a net goods value (subtotal − discount) at a given earn
// rate, in paise. Floors to whole points so we never over-credit.
export function pointsForNetPaise(netPaise: number, earnPercent: number): number {
  if (netPaise <= 0) return 0;
  return Math.floor((netPaise * earnPercent) / 100 / POINT_VALUE_PAISE);
}

export const pointsToPaise = (points: number) => points * POINT_VALUE_PAISE;

// The deterministic voucher code minted for a redemption. Derived from the
// ledger row's id so it's reconstructable (the account page lists a customer's
// vouchers by re-deriving codes from their redeem ledger entries).
export const loyaltyVoucherCode = (ledgerId: string) => `LOYAL-${ledgerId.slice(-8).toUpperCase()}`;

// Converts a customer's points into a private, single-use FIXED coupon —
// shared by the /account/loyalty redeem action and the checkout redeem-at-pay
// route, so both debit the same way. The debit is atomic (only succeeds when
// the balance actually covers it), so two concurrent redeems can't overspend.
export async function redeemPoints(
  customerId: string,
  points: number,
): Promise<{ code: string } | { error: string }> {
  if (points < LOYALTY_MIN_REDEEM_POINTS) {
    return { error: `Redeem at least ${LOYALTY_MIN_REDEEM_POINTS} points at a time.` };
  }

  const valuePaise = pointsToPaise(points);

  return prisma.$transaction(async (tx): Promise<{ code: string } | { error: string }> => {
    const debit = await tx.customer.updateMany({
      where: { id: customerId, points: { gte: points } },
      data: { points: { decrement: points } },
    });
    if (debit.count === 0) return { error: "You don't have that many points to redeem." };

    const ledger = await tx.loyaltyLedger.create({
      data: { customerId, delta: -points, reason: "redeem" },
    });
    const code = loyaltyVoucherCode(ledger.id);
    await tx.coupon.create({
      data: {
        code,
        type: "FIXED",
        value: valuePaise,
        // Require an order at least the voucher's worth so its value is never
        // wasted against the subtotal cap in validateCoupon.
        minOrderPaise: valuePaise,
        maxUses: 1,
        active: true,
        expiresAt: new Date(Date.now() + LOYALTY_VOUCHER_TTL_DAYS * DAY_MS),
        // Scoped to the customer who earned it — see customerId on Coupon.
        customerId,
      },
    });
    return { code };
  });
}

// Human-readable referral code — no ambiguous characters (0/O, 1/I), so it
// survives being read aloud or typed from a screenshot.
function randomReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `KLN${s}`;
}

// Returns the customer's referral code, generating + persisting one on first
// use (lazy). Retries on the rare unique collision.
export async function ensureReferralCode(customerId: string): Promise<string> {
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomReferralCode();
    try {
      await prisma.customer.update({ where: { id: customerId }, data: { referralCode: code } });
      return code;
    } catch {
      // Unique collision (or a racing call already set one) — re-read and retry.
      const now = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { referralCode: true },
      });
      if (now?.referralCode) return now.referralCode;
    }
  }
  throw new Error("Could not allocate a referral code");
}

// Resolves a referral code to the referring customer's id (null if unknown).
// Used at registration to stamp the new account's referredById.
export async function resolveReferralCode(code: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const referrer = await prisma.customer.findUnique({
    where: { referralCode: clean },
    select: { id: true },
  });
  return referrer?.id ?? null;
}

// Credits loyalty once an order is DELIVERED — not at payment settlement, so a
// cancelled/returned order (even if it was paid) never earns points. Called
// from the admin status-change action on every transition INTO DELIVERED; the
// atomic claim below (not pointsEarned, which can legitimately be 0) makes it
// safe to call more than once for the same order — a second call is a no-op.
// Guest orders (no customerId) earn nothing. Returns the buyer's own earned
// points (referral bonuses are separate ledger entries).
export async function awardLoyaltyForDeliveredOrder(
  tx: Prisma.TransactionClient,
  order: { id: string; customerId: string | null; subtotalPaise: number; discountPaise: number },
): Promise<number> {
  if (!order.customerId) return 0;

  // Claim the award exactly once — a concurrent or repeated call (e.g. an
  // admin flipping DELIVERED → SHIPPED → DELIVERED again) finds count === 0
  // and bails without re-crediting anything.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, loyaltyAwardedAt: null },
    data: { loyaltyAwardedAt: new Date() },
  });
  if (claimed.count === 0) return 0;

  // Tier is decided by the buyer's lifetime points BEFORE this order's earn is
  // added — so a customer earns at the rate they'd already qualified for, not
  // one this same order pushes them into.
  const buyer = await tx.customer.findUnique({
    where: { id: order.customerId },
    select: { referredById: true, lifetimePoints: true },
  });
  const earnPercent = loyaltyTier(buyer?.lifetimePoints ?? 0).earnPercent;

  const netPaise = Math.max(0, order.subtotalPaise - order.discountPaise);
  const earned = pointsForNetPaise(netPaise, earnPercent);

  if (earned > 0) {
    await tx.customer.update({
      where: { id: order.customerId },
      data: { points: { increment: earned }, lifetimePoints: { increment: earned } },
    });
    await tx.loyaltyLedger.create({
      data: { customerId: order.customerId, delta: earned, reason: "order", orderId: order.id },
    });
  }
  await tx.order.update({ where: { id: order.id }, data: { pointsEarned: earned } });

  // Referral bonus — only on the buyer's FIRST delivered order. This order is
  // already claimed above, so we count OTHER delivered (loyalty-awarded)
  // orders; 0 → this is their first → credit both sides once.
  if (buyer?.referredById) {
    const priorDelivered = await tx.order.count({
      where: {
        customerId: order.customerId,
        id: { not: order.id },
        loyaltyAwardedAt: { not: null },
      },
    });
    if (priorDelivered === 0) {
      await tx.customer.update({
        where: { id: buyer.referredById },
        data: {
          points: { increment: REFERRAL_REFERRER_BONUS_POINTS },
          lifetimePoints: { increment: REFERRAL_REFERRER_BONUS_POINTS },
        },
      });
      await tx.loyaltyLedger.create({
        data: { customerId: buyer.referredById, delta: REFERRAL_REFERRER_BONUS_POINTS, reason: "referral", orderId: order.id },
      });
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          points: { increment: REFERRAL_REFEREE_BONUS_POINTS },
          lifetimePoints: { increment: REFERRAL_REFEREE_BONUS_POINTS },
        },
      });
      await tx.loyaltyLedger.create({
        data: { customerId: order.customerId, delta: REFERRAL_REFEREE_BONUS_POINTS, reason: "referee", orderId: order.id },
      });
    }
  }

  return earned;
}

// Reverses whatever awardLoyaltyForDeliveredOrder credited for this order —
// called when a DELIVERED (or otherwise stock-committed) order moves to
// CANCELLED/RETURNED, so a return doesn't leave the customer keeping points
// for goods they gave back. Every ledger entry awardLoyaltyForDeliveredOrder
// wrote is tagged with this orderId (the buyer's own earn, plus any referral/
// referee bonus it triggered), so we just claw each one back from whoever
// received it.
//
// Claims via the same loyaltyAwardedAt field, clearing it back to null — that
// both makes this idempotent (a repeat call finds count === 0 and no-ops) and
// means a later re-delivery of this same order (e.g. correcting a mistaken
// return) can earn loyalty again.
//
// Clawback is clamped to the customer's CURRENT balance: they may have already
// spent some of these points (e.g. redeemed into a voucher), and we can't take
// back money that's already gone. lifetimePoints (which decides tier) is
// clawed back the same way — unlike voucher redemption, a return means the
// purchase that earned these points didn't actually stick, so it's fair for
// tier progress to unwind too.
export async function reverseLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, loyaltyAwardedAt: { not: null } },
    data: { loyaltyAwardedAt: null, pointsEarned: 0 },
  });
  if (claimed.count === 0) return;

  const entries = await tx.loyaltyLedger.findMany({ where: { orderId, delta: { gt: 0 } } });
  for (const entry of entries) {
    // The clamp ("don't take back more than they currently hold") has to be
    // computed from a value that's protected from concurrent modification for
    // the rest of this transaction — a plain read-then-decrement would let two
    // concurrent reversals for the SAME customer (e.g. bulk-returning two
    // orders in different admin tabs) both clamp against the same stale
    // balance and then both decrement, driving points negative (100 held,
    // two reversals owing 60 and 50 each clamp to "100 is enough", decrement
    // sequentially to -10). `SELECT ... FOR UPDATE` takes an explicit row
    // lock as part of a single, ordinary SELECT — no CTE/materialization
    // ambiguity to reason about — so a concurrent transaction blocks until
    // this one commits, and by the time it acquires the lock it reads
    // whatever this transaction actually left behind. The subsequent
    // `decrement` is then safe: nothing else can touch this row until we're
    // done.
    const [locked] = await tx.$queryRaw<{ points: number; lifetimePoints: number }[]>`
      SELECT points, "lifetimePoints" FROM "Customer" WHERE id = ${entry.customerId} FOR UPDATE
    `;
    if (!locked) continue; // customer no longer exists

    const pointsBack = Math.min(entry.delta, locked.points);
    const lifetimeBack = Math.min(entry.delta, locked.lifetimePoints);
    if (pointsBack > 0 || lifetimeBack > 0) {
      await tx.customer.update({
        where: { id: entry.customerId },
        data: { points: { decrement: pointsBack }, lifetimePoints: { decrement: lifetimeBack } },
      });
    }
    if (pointsBack > 0) {
      await tx.loyaltyLedger.create({
        data: { customerId: entry.customerId, delta: -pointsBack, reason: "return", orderId },
      });
    }
  }
}

// Un-consumes a redeemed loyalty voucher (LOYAL-<suffix>) if the order it was
// applied to never actually got fulfilled. redeemPoints debits points and
// mints the voucher up front, independent of any order; settleOrderPaid then
// marks it used (usedCount 0 -> 1) at settlement REGARDLESS of whether the
// order confirms cleanly or lands ON_HOLD for an unrelated reason (a stock
// shortfall on a different line, or a coupon-cap edge case) — so a customer
// whose order never leaves ON_HOLD before being cancelled would otherwise
// permanently lose the points they spent for zero goods and zero refund.
//
// Deliberately narrow: only reverses a voucher on an order that was ON_HOLD
// right up to the cancel/return (i.e. never reached a real confirmed/
// fulfilled state at any point) — NOT on an order that genuinely confirmed
// and shipped and is only later returned, where the coupon having been spent
// is the same as for any other discount type and isn't unwound.
//
// Claims via the coupon's own usedCount, the same field settleOrderPaid used
// to consume it: a guarded updateMany matching usedCount === 1 (the only
// value a single-use LOYAL- coupon can be at) resetting it to 0. This is
// naturally idempotent — a second call for the same order finds usedCount is
// no longer 1 and no-ops — without needing a separate "already reversed"
// field.
export async function reverseVoucherRedemptionForOrder(
  tx: Prisma.TransactionClient,
  order: { couponCode: string | null },
): Promise<void> {
  if (!order.couponCode?.startsWith("LOYAL-")) return;
  await tx.coupon.updateMany({
    where: { code: order.couponCode, usedCount: 1 },
    data: { usedCount: 0 },
  });
}

// ── Account-page read model ──────────────────────────────────────────────────

export type LoyaltyVoucher = {
  code: string;
  valuePaise: number;
  expiresAt: Date | null;
  status: "active" | "used" | "expired";
};

export type LoyaltyLedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  createdAt: Date;
};

export type LoyaltySummary = {
  points: number;
  pointsValuePaise: number;
  tier: string;
  tierEarnPercent: number;
  lifetimePoints: number;
  nextTier: { name: string; pointsNeeded: number } | null;
  referralCode: string;
  referralUrl: string;
  referredCount: number;
  ledger: LoyaltyLedgerEntry[];
  vouchers: LoyaltyVoucher[];
};

// Re-derives every redemption's voucher code and reads its live coupon status
// (used / expired / active). Shared by the account page (full history) and
// getActiveVouchers (checkout auto-apply — active only).
async function deriveVouchers(customerId: string): Promise<LoyaltyVoucher[]> {
  const redeemEntries = await prisma.loyaltyLedger.findMany({
    where: { customerId, reason: "redeem" },
    orderBy: { createdAt: "desc" },
  });

  const codes = redeemEntries.map((e) => loyaltyVoucherCode(e.id));
  const coupons = codes.length
    ? await prisma.coupon.findMany({ where: { code: { in: codes } } })
    : [];
  const byCode = new Map(coupons.map((c) => [c.code, c]));
  const now = Date.now();

  return redeemEntries.map((e) => {
    const code = loyaltyVoucherCode(e.id);
    const c = byCode.get(code);
    const valuePaise = c?.value ?? -e.delta * POINT_VALUE_PAISE;
    let status: LoyaltyVoucher["status"] = "active";
    if (c && c.maxUses != null && c.usedCount >= c.maxUses) status = "used";
    else if (c?.expiresAt && c.expiresAt.getTime() < now) status = "expired";
    else if (!c) status = "used"; // coupon gone → treat as spent
    return { code, valuePaise, expiresAt: c?.expiresAt ?? null, status };
  });
}

// The customer's currently-usable vouchers — used by checkout to auto-apply
// the best qualifying one without the customer having to dig up its code.
export async function getActiveVouchers(
  customerId: string,
): Promise<{ code: string; valuePaise: number }[]> {
  const vouchers = await deriveVouchers(customerId);
  return vouchers.filter((v) => v.status === "active").map(({ code, valuePaise }) => ({ code, valuePaise }));
}

// Everything the /account/loyalty page needs, in one call.
export async function getLoyaltySummary(customerId: string): Promise<LoyaltySummary> {
  const referralCode = await ensureReferralCode(customerId);

  const [customer, referredCount, ledger, vouchers] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { points: true, lifetimePoints: true } }),
    prisma.customer.count({ where: { referredById: customerId } }),
    prisma.loyaltyLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    deriveVouchers(customerId),
  ]);

  const points = customer?.points ?? 0;
  const lifetimePoints = customer?.lifetimePoints ?? 0;
  const tier = loyaltyTier(lifetimePoints);
  return {
    points,
    pointsValuePaise: pointsToPaise(points),
    tier: tier.name,
    tierEarnPercent: tier.earnPercent,
    lifetimePoints,
    nextTier: tier.next,
    referralCode,
    referralUrl: `${SITE_URL}/register?ref=${referralCode}`,
    referredCount,
    ledger,
    vouchers,
  };
}
