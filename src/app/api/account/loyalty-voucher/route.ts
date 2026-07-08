import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getActiveVouchers } from "@/lib/loyalty";

// Read-only lookup for checkout: the signed-in customer's currently-usable
// loyalty vouchers (to auto-apply the best qualifying one) plus their live
// points balance (to offer redeeming the rest inline). Returns zeroed values
// for guests.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ vouchers: [], points: 0 });

  const [vouchers, customer] = await Promise.all([
    getActiveVouchers(session.sub),
    prisma.customer.findUnique({ where: { id: session.sub }, select: { points: true } }),
  ]);
  return NextResponse.json({ vouchers, points: customer?.points ?? 0 });
}
