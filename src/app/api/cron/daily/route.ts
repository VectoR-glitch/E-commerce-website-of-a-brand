import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDueSubscriptionReminders } from "@/lib/subscriptions";
import { runBackInStockSweep } from "@/lib/back-in-stock";
import { runAbandonedCartSweep } from "@/lib/abandoned-cart";

// One daily scheduled entrypoint for all background maintenance, so the whole
// app needs a single Vercel Cron (well within the Hobby 2-cron limit) and one
// shared secret. Add new daily jobs by calling their sweep here.
//
// Gated by CRON_SECRET: Vercel Cron sends it as an `Authorization: Bearer`
// header automatically. The route refuses to run (500) if the secret is unset
// and rejects anything else (401), so the public URL is not an open trigger.
//
// Tasks run independently — one failing never aborts the others — and every
// task function is individually idempotent-ish (safe to re-run), so a retry of
// the whole cron is harmless.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Runs a task, capturing its result or error so one failure can't sink the run.
async function runTask<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Daily cron task "${name}" failed:`, err);
    return { error: err instanceof Error ? err.message : "failed" };
  }
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to run the daily cron.");
    return NextResponse.json({ error: "Cron not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const subscriptions = await runTask("subscription-reminders", sendDueSubscriptionReminders);
  const backInStock = await runTask("back-in-stock", runBackInStockSweep);
  const abandonedCart = await runTask("abandoned-cart", runAbandonedCartSweep);

  // Individual send failures are logged where they happen; this summary line
  // makes a systemic outage (e.g. sent:0 across the board) scannable in the
  // server logs even though nothing currently reads the JSON response below.
  console.log("Daily cron summary:", { subscriptions, backInStock, abandonedCart });

  return NextResponse.json({ ok: true, subscriptions, backInStock, abandonedCart });
}
