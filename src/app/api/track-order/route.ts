import { NextResponse } from "next/server";
import { getOrderTrackingByNumberAndEmail } from "@/lib/order-tracking";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Rate limit: 10 lookups per 10 minutes per IP — this endpoint is a manual
  // guess-two-fields form, the same class of abuse surface as login/contact.
  const rl = await rateLimit(`track-order:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfter, "Too many attempts. Please wait a few minutes and try again.");
  }

  let body: { orderNumber?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const orderNumber = (body.orderNumber ?? "").trim();
  const email = (body.email ?? "").trim();
  if (!orderNumber || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter your order number and the email used at checkout." },
      { status: 400 },
    );
  }

  const tracking = await getOrderTrackingByNumberAndEmail(orderNumber, email);
  // One generic message for "no such order" AND "email doesn't match" —
  // distinguishing them would let an attacker confirm a guessed order number
  // exists just by trying emails against it.
  if (!tracking) {
    return NextResponse.json(
      { error: "We couldn't find an order matching that order number and email." },
      { status: 404 },
    );
  }

  return NextResponse.json({ tracking });
}
