import { NextResponse } from "next/server";
import { listAvailableCoupons } from "@/lib/coupons";
import { getActiveVouchers } from "@/lib/loyalty";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LOYALTY_MIN_REDEEM_POINTS, POINT_VALUE_PAISE } from "@/lib/constants";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export type LoyaltyOffer =
  | { kind: "existing"; code: string; valuePaise: number }
  | { kind: "redeemable"; valuePaise: number; pointsToRedeem: number };

// Everything the checkout "available offers" dropdown needs in one call: every
// public promo code that currently qualifies for this cart, plus (signed-in
// only) the best loyalty option — an already-redeemed unused voucher if one
// exists, otherwise how much redeeming points right now would be worth. Only
// one of coupons/loyalty ever ends up applied at a time, same as manual entry.
export async function POST(request: Request) {
  const rl = await rateLimit(`coupon-available:${getClientIp(request)}`, {
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) return tooManyRequests(rl.retryAfter, "Too many attempts. Please wait a moment.");

  let body: { subtotalPaise?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ coupons: [], loyalty: null });
  }
  const subtotalPaise = Math.max(0, Math.floor(Number(body.subtotalPaise) || 0));

  const [coupons, session] = await Promise.all([
    listAvailableCoupons(subtotalPaise),
    getSession(),
  ]);

  let loyalty: LoyaltyOffer | null = null;
  if (session) {
    const [vouchers, customer] = await Promise.all([
      getActiveVouchers(session.sub),
      prisma.customer.findUnique({ where: { id: session.sub }, select: { points: true } }),
    ]);
    const bestVoucher = vouchers
      .filter((v) => v.valuePaise <= subtotalPaise)
      .sort((a, b) => b.valuePaise - a.valuePaise)[0];
    if (bestVoucher) {
      loyalty = { kind: "existing", code: bestVoucher.code, valuePaise: bestVoucher.valuePaise };
    } else {
      const points = customer?.points ?? 0;
      const maxPoints = Math.min(points, Math.floor(subtotalPaise / POINT_VALUE_PAISE));
      if (maxPoints >= LOYALTY_MIN_REDEEM_POINTS) {
        loyalty = {
          kind: "redeemable",
          valuePaise: maxPoints * POINT_VALUE_PAISE,
          pointsToRedeem: maxPoints,
        };
      }
    }
  }

  return NextResponse.json({ coupons, loyalty });
}