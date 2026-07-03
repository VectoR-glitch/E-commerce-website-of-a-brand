import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runBackInStockSweep } from "@/lib/back-in-stock";

// Daily backstop for back-in-stock alerts. The admin stock-save hook notifies
// immediately on the common restock path; this sweep catches the others (a
// returned/cancelled order that increments stock directly) and retries any
// sends that failed. Gated by CRON_SECRET, exactly like the reminder cron.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to run the back-in-stock sweep.");
    return NextResponse.json({ error: "Cron not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sent, failed, variants } = await runBackInStockSweep();
    return NextResponse.json({ ok: true, sent, failed, variants });
  } catch (err) {
    console.error("Back-in-stock sweep failed:", err);
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }
}
