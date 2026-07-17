import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Meta requires the app to be subscribed to the WABA's webhook before it
// will fully unblock business-initiated sends, and it's the only way to
// see per-message delivery/read/failed status (the Send API response only
// ever says "accepted", never whether it actually landed).
//
// Set WHATSAPP_WEBHOOK_VERIFY_TOKEN (any random string — this file just has
// to echo it back) and WHATSAPP_APP_SECRET (App Dashboard → Settings →
// Basic → App Secret), then register …/api/webhooks/whatsapp in the Meta
// App Dashboard under WhatsApp → Configuration, subscribed to "messages".

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Meta's subscribe-time handshake: echo back hub.challenge only if
// hub.verify_token matches what we configured in the dashboard.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    console.error("WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set; cannot verify webhook.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  if (mode === "subscribe" && token && safeEqual(token, expected) && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

type WhatsAppStatus = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string; message?: string }[];
};

type WhatsAppMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
};

type WhatsAppWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        statuses?: WhatsAppStatus[];
        messages?: WhatsAppMessage[];
      };
    }[];
  }[];
};

// Delivery/read/failed status updates and inbound replies both land here.
// Nothing in the app currently acts on either — this just logs them so
// send failures are visible (Vercel logs) instead of silently disappearing,
// and so the app satisfies Meta's "subscribed to messages" requirement.
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.error("WHATSAPP_APP_SECRET is not set; cannot verify webhook.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (!signature || !safeEqual(signature, expected)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (status.status === "failed") {
          console.error("WhatsApp message failed:", JSON.stringify(status.errors), status.id);
        } else {
          console.log(`WhatsApp status: ${status.id} -> ${status.status}`);
        }
      }
      for (const message of change.value?.messages ?? []) {
        // Log only shape, not content — a customer's reply text is PII and
        // nothing here currently acts on it, so there's no reason to let it
        // sit in shared log infrastructure indefinitely.
        console.log(`WhatsApp inbound from ${message.from}: [${message.type}] id=${message.id}`);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
