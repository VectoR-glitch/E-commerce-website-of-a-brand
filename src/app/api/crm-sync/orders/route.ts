import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Read-only export of D2C orders for the internal CRM to pull on a schedule.
// Gated by CRM_EXPORT_SECRET (`Authorization: Bearer`), same pattern as the
// daily cron's CRON_SECRET check in /api/cron/daily.

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRM_EXPORT_SECRET;
  if (!secret) {
    console.error("CRM_EXPORT_SECRET is not set; refusing to serve the CRM order export.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid 'since' parameter." }, { status: 400 });
  }

  // Only orders with money actually collected count as real D2C revenue —
  // a PENDING/unpaid order is just a cart, not a sale, and syncing it into
  // the CRM's combined B2B+D2C revenue view would overstate it.
  const orders = await prisma.order.findMany({
    where: {
      updatedAt: { gte: since },
      paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
    },
    select: {
      orderNumber: true,
      createdAt: true,
      totalPaise: true,
      status: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      orderId: order.orderNumber,
      orderDate: order.createdAt.toISOString(),
      amount: order.totalPaise / 100,
      status: order.status,
    })),
  });
}
