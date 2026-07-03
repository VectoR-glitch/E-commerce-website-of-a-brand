import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDueSubscriptionReminders } from "@/lib/subscriptions";

// Daily cron entrypoint for the subscribe & save reminders. Vercel Cron (see
// vercel.json) hits this once a day and, when CRON_SECRET is set, automatically
// sends an `Authorization: Bearer <CRON_SECRET>` header — so we can gate the
// route to Vercel's scheduler and reject anyone else hitting the public URL.
//
// The work itself (email each due subscriber, roll their schedule forward one
// cycle) is idempotent-ish: once a subscription is rolled forward it won't be
// due again until its next cycle, so an accidental double-fire is harmless. The
// same function still backs the manual admin button on /admin/subscriptions.

export const dynamic = "force-dynamic";
// A reminder run sends emails sequentially; give it headroom over the default.
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuse to run unauthenticated — without a secret the endpoint would be an
    // open trigger. Misconfiguration (not a client error): log and 500.
    console.error("CRON_SECRET is not set; refusing to run the reminder cron.");
    return NextResponse.json({ error: "Cron not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sent, failed } = await sendDueSubscriptionReminders();
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    // Transient failure (e.g. DB) — 500 so the run is visible as failed in the
    // Vercel cron logs rather than silently reporting success.
    console.error("Subscription reminder cron failed:", err);
    return NextResponse.json({ error: "Reminder run failed." }, { status: 500 });
  }
}
