import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncNewsletterContact, createWelcomeCoupon } from "@/lib/newsletter";
import { sendWelcomeDiscountEmail } from "@/lib/email";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

type NewsletterBody = {
  email?: string;
  // Honeypot — hidden field real users never fill. Bots that auto-fill every
  // input will populate it, letting us drop them silently. Same pattern as
  // the contact form.
  company?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Rate limit: 5 signups per 10 minutes per IP — a footer form has no
  // legitimate reason to be submitted rapidly.
  const rl = await rateLimit(`newsletter:${getClientIp(request)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return tooManyRequests(
      rl.retryAfter,
      "Too many attempts. Please wait a few minutes and try again.",
    );
  }

  let body: NewsletterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // Honeypot tripped → pretend success so the bot doesn't retry.
  if (body.company && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  // Re-submitting an already-subscribed email is a harmless no-op, not an
  // error — a visitor has no way to know they already signed up. Re-surface
  // their existing code instead of minting a second one, so someone who lost
  // the email can recover it by just submitting the form again.
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: true, couponCode: existing.couponCode });
  }

  const [resendId, couponCode] = await Promise.all([
    syncNewsletterContact(email),
    createWelcomeCoupon(),
  ]);
  try {
    await prisma.newsletterSubscriber.create({ data: { email, resendId, couponCode } });
  } catch (err) {
    // Unique constraint on `email` — a concurrent request for the same address
    // won the race. Re-surface whatever coupon that request minted rather than
    // erroring; the coupon we just minted here (if any) is simply unused.
    const isUniqueClash =
      typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
    if (!isUniqueClash) throw err;
    const winner = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    return NextResponse.json({ ok: true, couponCode: winner?.couponCode ?? null });
  }
  if (couponCode) {
    // Best-effort — the coupon is already minted and the code is returned in
    // this response either way, so a flaky send here doesn't lose the reward.
    await sendWelcomeDiscountEmail(email, couponCode).catch((err) =>
      console.error("Welcome discount email failed:", err),
    );
  }

  return NextResponse.json({ ok: true, couponCode });
}
