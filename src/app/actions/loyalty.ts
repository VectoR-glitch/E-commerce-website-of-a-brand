"use server";
// Customer-facing loyalty actions. Server Actions are POST-reachable, so this
// re-checks auth itself. Redeeming converts points into a private, single-use
// FIXED coupon (LOYAL-<suffix>) that flows through the normal checkout/settlement
// discount pipeline — the customer applies it at checkout like any other code.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loyaltyVoucherCode, pointsToPaise } from "@/lib/loyalty";
import {
  LOYALTY_MIN_REDEEM_POINTS,
  LOYALTY_VOUCHER_TTL_DAYS,
} from "@/lib/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RedeemState = { ok?: boolean; code?: string; error?: string } | undefined;

export async function redeemPointsAction(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to redeem points." };

  const points = Math.floor(Number(formData.get("points")));
  if (!Number.isFinite(points) || points <= 0) {
    return { error: "Enter how many points to redeem." };
  }
  if (points < LOYALTY_MIN_REDEEM_POINTS) {
    return { error: `Redeem at least ${LOYALTY_MIN_REDEEM_POINTS} points at a time.` };
  }

  const valuePaise = pointsToPaise(points);

  const result = await prisma.$transaction(async (tx): Promise<{ code: string } | { error: string }> => {
    // Atomic debit: only succeeds when the balance actually covers it, so two
    // concurrent redeems can't overspend the same points.
    const debit = await tx.customer.updateMany({
      where: { id: session.sub, points: { gte: points } },
      data: { points: { decrement: points } },
    });
    if (debit.count === 0) return { error: "You don't have that many points to redeem." };

    const ledger = await tx.loyaltyLedger.create({
      data: { customerId: session.sub, delta: -points, reason: "redeem" },
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
      },
    });
    return { code };
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/account/loyalty");
  return { ok: true, code: result.code };
}
