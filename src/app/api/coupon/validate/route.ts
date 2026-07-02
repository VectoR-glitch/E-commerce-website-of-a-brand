import { NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Live coupon check for the checkout UI. The checkout route re-validates
// authoritatively at order creation, so this is purely for instant feedback.
// Rate-limited to blunt code-guessing/enumeration.
export async function POST(request: Request) {
  const rl = await rateLimit(`coupon:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) return tooManyRequests(rl.retryAfter, "Too many attempts. Please wait a moment.");

  let body: {
    code?: string;
    subtotalPaise?: number;
    items?: { variantId?: string; quantity?: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const subtotalPaise = Math.max(0, Math.floor(Number(body.subtotalPaise) || 0));
  const cart = (body.items ?? [])
    .map((i) => ({ variantId: String(i.variantId ?? ""), quantity: Math.floor(Number(i.quantity) || 0) }))
    .filter((i) => i.variantId && i.quantity > 0);
  const result = await validateCoupon(String(body.code ?? ""), subtotalPaise, cart);
  return NextResponse.json(result);
}
