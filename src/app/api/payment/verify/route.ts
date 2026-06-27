import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RAZORPAY_KEY_SECRET } from "@/lib/razorpay";
import { settleOrderPaid } from "@/lib/orders";
import { sendOrderEmails } from "@/lib/email";

type VerifyBody = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  let body: VerifyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { error: "Missing payment fields." },
      { status: 400 },
    );
  }

  // Razorpay signs `${order_id}|${payment_id}` with the key secret (HMAC-SHA256).
  const expected = createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (!safeEqual(expected, signature)) {
    // Mark the order failed so it doesn't linger as PENDING forever.
    await prisma.order.updateMany({
      where: { razorpayOrderId: orderId, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.json(
      { error: "Payment verification failed." },
      { status: 400 },
    );
  }

  // Settle through the shared, race-safe path (idempotent if the webhook or a
  // double-submit already marked this order paid).
  const result = await settleOrderPaid({
    razorpayOrderId: orderId,
    paymentId,
    signature,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Send confirmation + admin notification once, only if WE settled it (the
  // webhook may have beaten us). Never let an email failure break the order.
  if (result.newlySettled) {
    try {
      await sendOrderEmails(result.order);
    } catch (err) {
      console.error("Order email failed (verify):", err);
    }
  }

  return NextResponse.json({ ok: true, orderNumber: result.orderNumber });
}