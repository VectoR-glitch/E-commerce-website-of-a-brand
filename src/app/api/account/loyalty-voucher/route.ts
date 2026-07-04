import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getActiveVouchers } from "@/lib/loyalty";

// Read-only lookup for checkout: the signed-in customer's currently-usable
// loyalty vouchers, so the page can auto-apply the best qualifying one.
// Returns { vouchers: [] } for guests.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ vouchers: [] });

  const vouchers = await getActiveVouchers(session.sub);
  return NextResponse.json({ vouchers });
}
