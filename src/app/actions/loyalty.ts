"use server";
// Customer-facing loyalty actions. Server Actions are POST-reachable, so this
// re-checks auth itself. Redeeming converts points into a private, single-use
// FIXED coupon (LOYAL-<suffix>) that flows through the normal checkout/settlement
// discount pipeline — the customer applies it at checkout like any other code.
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { redeemPoints } from "@/lib/loyalty";

export type RedeemState = { ok?: boolean; code?: string; error?: string } | undefined;

export async function redeemPointsAction(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to redeem points." };

  const points = Math.floor(Number(formData.get("points")));
  if (!Number.isFinite(points) || points <= 0) {
    return { error: "Enter how many points to redeem." };
  }

  const result = await redeemPoints(session.sub, points);
  if ("error" in result) return { error: result.error };
  revalidatePath("/account/loyalty");
  return { ok: true, code: result.code };
}
