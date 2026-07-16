import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

type ContactBody = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  // Honeypot — a hidden field real users never fill. Bots that auto-fill every
  // input will populate it, letting us drop them silently.
  company?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// "+<dial code> <national number>", e.g. "+91 9876543210". The form sends the
// country dial code and 6–15 national digits separated by a single space.
const PHONE_RE = /^\+\d{1,4}\s\d{6,15}$/;
const MAX_NAME = 100;

export async function POST(request: Request) {
  // Rate limit: 5 submissions per 10 minutes per IP.
  const rl = await rateLimit(`contact:${getClientIp(request)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return tooManyRequests(
      rl.retryAfter,
      "Too many messages. Please wait a few minutes and try again.",
    );
  }

  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // Honeypot tripped → pretend success so the bot doesn't retry. No email sent.
  if (body.company && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // Strip CR/LF before it ever reaches an email subject line — sendContactEmail
  // interpolates `name` into "New contact message from {name}", and a raw
  // newline there is exactly what a header-injection attempt would need.
  const name = (body.name?.trim() ?? "").replace(/[\r\n]/g, " ");
  const email = body.email?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !email || !phone || !message) {
    return NextResponse.json(
      { error: "Please fill in your name, email, mobile number, and message." },
      { status: 400 },
    );
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json(
      { error: "Please enter a shorter name." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "Please enter a valid mobile number." },
      { status: 400 },
    );
  }
  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Message is too long." },
      { status: 400 },
    );
  }

  try {
    const sent = await sendContactEmail({ name, email, phone, message });
    if (!sent) {
      // Email isn't configured — don't pretend it went through.
      return NextResponse.json(
        { error: "Messaging is temporarily unavailable. Please email us directly." },
        { status: 503 },
      );
    }
  } catch (err) {
    console.error("Contact email failed:", err);
    return NextResponse.json(
      { error: "Something went wrong sending your message. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
