import "server-only";
import type { OrderStatus } from "@prisma/client";

const WHATSAPP_API_VERSION = "v21.0";

// Mirrors STATUS_EMAILS in email.ts — one approved Meta template per status
// that has customer-facing copy. Statuses not listed here send no WhatsApp
// message (nothing useful to tell the customer yet).
const TEMPLATE_BY_STATUS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "order_confirmed",
  PACKED: "order_packed",
  SHIPPED: "order_shipped",
  DELIVERED: "order_delivered",
  ON_HOLD: "order_on_hold",
  CANCELLED: "order_cancelled",
  RETURNED: "order_returned",
};

// Checkout validates phone as a bare 10-digit Indian mobile number
// (^[6-9]\d{9}$, see checkout/page.tsx) — prepend the country code for
// WhatsApp's E.164-without-plus format.
function toWhatsAppNumber(phone: string): string | null {
  return /^[6-9]\d{9}$/.test(phone) ? `91${phone}` : null;
}

/**
 * Sends the customer a WhatsApp order-status template message. Best-effort:
 * the caller is expected to swallow throws so WhatsApp never blocks or
 * breaks the status update. No-ops when there's no phone on file, no
 * WhatsApp credentials configured, or the status has no matching template.
 */
export async function sendOrderStatusWhatsApp(
  phone: string | null,
  orderNumber: string,
  status: OrderStatus,
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId || !phone) return;

  const template = TEMPLATE_BY_STATUS[status];
  if (!template) return;

  const to = toWhatsAppNumber(phone);
  if (!to) return;

  const res = await fetch(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: "en_US" },
          components: [{ type: "body", parameters: [{ type: "text", text: orderNumber }] }],
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${body}`);
  }
}