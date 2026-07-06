import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { settleOrderPaid } from "@/lib/orders";
import { sendOrderEmails } from "@/lib/email";
import { renderSettledOrderInvoicePdf } from "@/lib/invoice-pdf";

// Razorpay webhook backup. If the browser-side verify never runs (customer
// closes the tab, loses signal, etc.), Razorpay still calls this endpoint
// directly so a captured payment always reconciles its order server-side.
//
// Set RAZORPAY_WEBHOOK_SECRET and register this URL (…/api/payment/webhook)
// in the Razorpay dashboard for the `payment.captured` event.

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration, not a client error — log loudly and let Razorpay retry.
    console.error("RAZORPAY_WEBHOOK_SECRET is not set; cannot verify webhook.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  // Raw body bytes are required — the signature is computed over the exact text.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (!safeEqual(expected, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const type = event.event;
    // Both events confirm money captured against an order; settling is
    // idempotent, so handling either (or both) is safe.
    if (type === "payment.captured" || type === "order.paid") {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      if (orderId && paymentId) {
        const result = await settleOrderPaid({
          razorpayOrderId: orderId,
          paymentId,
        });
        if (!result.ok) {
          // Unknown order — acknowledge so Razorpay stops retrying, but log it.
          console.warn(`Webhook ${type}: no order for Razorpay order ${orderId}`);
        } else if (result.newlySettled) {
          // The browser verify never ran (tab closed, etc.) — send here. Only
          // fires when WE won the settle, so emails are never duplicated.
          try {
            const invoice = await renderSettledOrderInvoicePdf(result.order);
            await sendOrderEmails(result.order, invoice ?? undefined);
          } catch (err) {
            console.error("Order email failed (webhook):", err);
          }
        }
      }
    }
    // Other events (incl. payment.failed) are intentionally ignored: a failed
    // attempt may be followed by a successful one on the same order, so we
    // leave the order PENDING rather than risk masking a later capture.
  } catch (err) {
    // Transient failure (e.g. DB) — 500 makes Razorpay retry the delivery.
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Processing error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
