import "server-only";
// Loyalty & referral engine. Points are ₹-denominated (see POINT_VALUE_PAISE):
// customers earn a % back when an order settles, and can convert points into a
// private, single-use discount voucher (LOYAL-<suffix>) that flows through the
// existing coupon pipeline — same trick as kits (KIT-) and subscriptions (SUB-).
// Referrals award both sides a one-off point bonus on the referred customer's
// first settled order. Never import from client code.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  POINT_VALUE_PAISE,
  LOYALTY_EARN_PERCENT,
  REFERRAL_REFERRER_BONUS_POINTS,
  REFERRAL_REFEREE_BONUS_POINTS,
  SITE_URL,
} from "@/lib/constants";

// Points earned for a net goods value (subtotal − discount), in paise. Floors to
// whole points so we never over-credit; 5% back at 1pt=₹1 → ₹1000 = 50 points.
export function pointsForNetPaise(netPaise: number): number {
  if (netPaise <= 0) return 0;
  return Math.floor((netPaise * LOYALTY_EARN_PERCENT) / 100 / POINT_VALUE_PAISE);
}

export const pointsToPaise = (points: number) => points * POINT_VALUE_PAISE;

// The deterministic voucher code minted for a redemption. Derived from the
// ledger row's id so it's reconstructable (the account page lists a customer's
// vouchers by re-deriving codes from their redeem ledger entries).
export const loyaltyVoucherCode = (ledgerId: string) => `LOYAL-${ledgerId.slice(-8).toUpperCase()}`;

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

// Credits loyalty for a just-settled order. MUST be called inside the order's
// winning settlement claim (runs exactly once per order), so the writes here are
// inherently idempotent. Guest orders (no customerId) earn nothing. Returns the
// buyer's own earned points (referral bonuses are separate ledger entries).
export async function awardLoyaltyForSettledOrder(
  tx: Prisma.TransactionClient,
  order: { id: string; customerId: string | null; subtotalPaise: number; discountPaise: number },
): Promise<number> {
  if (!order.customerId) return 0;

  const netPaise = Math.max(0, order.subtotalPaise - order.discountPaise);
  const earned = pointsForNetPaise(netPaise);

  if (earned > 0) {
    await tx.customer.update({
      where: { id: order.customerId },
      data: { points: { increment: earned } },
    });
    await tx.loyaltyLedger.create({
      data: { customerId: order.customerId, delta: earned, reason: "order", orderId: order.id },
    });
  }
  await tx.order.update({ where: { id: order.id }, data: { pointsEarned: earned } });

  // Referral bonus — only on the buyer's FIRST settled order. This order is
  // already flipped to settled before we run, so we count OTHER settled orders;
  // 0 → this is their first → credit both sides once.
  const buyer = await tx.customer.findUnique({
    where: { id: order.customerId },
    select: { referredById: true },
  });
  if (buyer?.referredById) {
    const priorSettled = await tx.order.count({
      where: {
        customerId: order.customerId,
        id: { not: order.id },
        paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
      },
    });
    if (priorSettled === 0) {
      await tx.customer.update({
        where: { id: buyer.referredById },
        data: { points: { increment: REFERRAL_REFERRER_BONUS_POINTS } },
      });
      await tx.loyaltyLedger.create({
        data: { customerId: buyer.referredById, delta: REFERRAL_REFERRER_BONUS_POINTS, reason: "referral", orderId: order.id },
      });
      await tx.customer.update({
        where: { id: order.customerId },
        data: { points: { increment: REFERRAL_REFEREE_BONUS_POINTS } },
      });
      await tx.loyaltyLedger.create({
        data: { customerId: order.customerId, delta: REFERRAL_REFEREE_BONUS_POINTS, reason: "referee", orderId: order.id },
      });
    }
  }

  return earned;
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
  referralCode: string;
  referralUrl: string;
  referredCount: number;
  ledger: LoyaltyLedgerEntry[];
  vouchers: LoyaltyVoucher[];
};

// Everything the /account/loyalty page needs, in one call.
export async function getLoyaltySummary(customerId: string): Promise<LoyaltySummary> {
  const referralCode = await ensureReferralCode(customerId);

  const [customer, referredCount, ledger, redeemEntries] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { points: true } }),
    prisma.customer.count({ where: { referredById: customerId } }),
    prisma.loyaltyLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.loyaltyLedger.findMany({
      where: { customerId, reason: "redeem" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Re-derive each redemption's voucher code and fetch the coupon to read its
  // live status (used / expired / active).
  const codes = redeemEntries.map((e) => loyaltyVoucherCode(e.id));
  const coupons = codes.length
    ? await prisma.coupon.findMany({ where: { code: { in: codes } } })
    : [];
  const byCode = new Map(coupons.map((c) => [c.code, c]));
  const now = Date.now();

  const vouchers: LoyaltyVoucher[] = redeemEntries.map((e) => {
    const code = loyaltyVoucherCode(e.id);
    const c = byCode.get(code);
    const valuePaise = c?.value ?? -e.delta * POINT_VALUE_PAISE;
    let status: LoyaltyVoucher["status"] = "active";
    if (c && c.maxUses != null && c.usedCount >= c.maxUses) status = "used";
    else if (c?.expiresAt && c.expiresAt.getTime() < now) status = "expired";
    else if (!c) status = "used"; // coupon gone → treat as spent
    return { code, valuePaise, expiresAt: c?.expiresAt ?? null, status };
  });

  const points = customer?.points ?? 0;
  return {
    points,
    pointsValuePaise: pointsToPaise(points),
    referralCode,
    referralUrl: `${SITE_URL}/register?ref=${referralCode}`,
    referredCount,
    ledger,
    vouchers,
  };
}
