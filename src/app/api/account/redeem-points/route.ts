import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { redeemPoints } from "@/lib/loyalty";

// Redeem loyalty points into a discount voucher directly from checkout, without
// a trip to /account/loyalty. Same debit + voucher-mint path as the account
// page's redeem action (src/app/actions/loyalty.ts) — just JSON in/out so the
// checkout page can call it via fetch and auto-apply the returned code.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in to redeem points." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const points = Math.floor(Number(body?.points));
  if (!Number.isFinite(points) || points <= 0) {
    return NextResponse.json({ error: "Enter how many points to redeem." }, { status: 400 });
  }

  const result = await redeemPoints(session.sub, points);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, code: result.code });
}
