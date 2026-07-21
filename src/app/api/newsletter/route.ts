import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncNewsletterContact } from "@/lib/newsletter";
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

  // Upsert: re-submitting an already-subscribed email is a harmless no-op,
  // not an error — a visitor has no way to know they already signed up.
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (!existing) {
    const resendId = await syncNewsletterContact(email);
    await prisma.newsletterSubscriber.create({ data: { email, resendId } });
  }

  return NextResponse.json({ ok: true });
}
