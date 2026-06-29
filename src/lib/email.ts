// Server-only transactional email via Resend. No-ops safely when RESEND_API_KEY
// is absent, so the order flow works with or without email configured.
//
// Env:
//   RESEND_API_KEY  — Klenich's Resend key (required to actually send)
//   RESEND_FROM     — sender; defaults to the test sender until klenich.com is
//                     verified, then set to "Klenich <orders@klenich.com>"
//   ADMIN_EMAIL     — where order notifications land (your inbox)
import { Resend } from "resend";
import { formatINR } from "@/lib/catalog";
import { SITE_URL } from "@/lib/constants";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.RESEND_FROM ?? "Klenich <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "bharatblissofficial@gmail.com";

// Brand tokens (mirrors globals.css) — inline so they survive email clients.
const C = {
  bone: "#f5f1e8",
  paper: "#fbfaf5",
  ink: "#1c1c1a",
  forest: "#1f3d2b",
  brass: "#b08d4c",
  line: "#e0dac9",
  muted: "#6b6a64",
};

type OrderItem = {
  productName: string;
  fragrance: string | null;
  size: string;
  quantity: number;
  linePaise: number;
};

export type OrderForEmail = {
  orderNumber: string;
  email: string;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  paymentMethod: "ONLINE" | "COD";
  items: OrderItem[];
};

function itemsRows(items: OrderItem[]): string {
  return items
    .map((it) => {
      const name = escapeHtml(it.productName);
      const variant = escapeHtml([it.fragrance, it.size].filter(Boolean).join(" · "));
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};">
            <div style="font-weight:600;color:${C.ink};">${name}</div>
            <div style="font-size:13px;color:${C.muted};">${variant} &nbsp;×&nbsp; ${it.quantity}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;color:${C.ink};">
            ${formatINR(it.linePaise)}
          </td>
        </tr>`;
    })
    .join("");
}

function summaryBlock(order: OrderForEmail): string {
  // Shipping fields are user-supplied at checkout (only trimmed, not character-
  // restricted), so escape them before they're interpolated into the email HTML.
  const shipName = escapeHtml(order.shipName);
  const shipLine1 = escapeHtml(order.shipLine1);
  const shipLine2 = order.shipLine2 ? `${escapeHtml(order.shipLine2)}<br/>` : "";
  const shipCity = escapeHtml(order.shipCity);
  const shipState = escapeHtml(order.shipState);
  const shipPincode = escapeHtml(order.shipPincode);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${itemsRows(order.items)}
      <tr><td style="padding:12px 0 4px;color:${C.muted};">Subtotal</td><td style="padding:12px 0 4px;text-align:right;color:${C.ink};">${formatINR(order.subtotalPaise)}</td></tr>
      <tr><td style="padding:4px 0;color:${C.muted};">${order.paymentMethod === "COD" ? "Delivery (paid online)" : "Shipping"}</td><td style="padding:4px 0;text-align:right;color:${C.ink};">${order.shippingPaise === 0 ? "Free" : formatINR(order.shippingPaise)}</td></tr>
      <tr><td style="padding:12px 0 0;border-top:1px solid ${C.line};font-family:Georgia,serif;font-size:18px;color:${C.ink};">Total</td><td style="padding:12px 0 0;border-top:1px solid ${C.line};text-align:right;font-family:Georgia,serif;font-size:18px;color:${C.ink};">${formatINR(order.totalPaise)}</td></tr>
      ${
        order.paymentMethod === "COD"
          ? `<tr><td style="padding:8px 0 0;color:${C.muted};">Paid online (delivery)</td><td style="padding:8px 0 0;text-align:right;color:${C.ink};">${formatINR(order.amountPaidPaise)}</td></tr>
      <tr><td style="padding:4px 0 0;color:${C.forest};font-weight:600;">Due on delivery (cash)</td><td style="padding:4px 0 0;text-align:right;color:${C.forest};font-weight:600;">${formatINR(order.totalPaise - order.amountPaidPaise)}</td></tr>`
          : ""
      }
    </table>
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid ${C.line};font-size:14px;color:${C.muted};line-height:1.6;">
      <div style="text-transform:uppercase;letter-spacing:0.18em;font-size:11px;color:${C.brass};margin-bottom:6px;">Shipping to</div>
      <strong style="color:${C.ink};">${shipName}</strong><br/>
      ${shipLine1}<br/>
      ${shipLine2}
      ${shipCity}, ${shipState} — ${shipPincode}
    </div>`;
}

function shell(heading: string, intro: string, body: string): string {
  return `
  <div style="margin:0;padding:24px;background:${C.bone};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr><td style="padding:8px 4px 20px;">
        <span style="font-family:Georgia,serif;font-size:22px;letter-spacing:0.04em;color:${C.forest};font-weight:600;">KLENICH</span>
      </td></tr>
      <tr><td style="background:${C.paper};border:1px solid ${C.line};border-radius:4px;padding:32px;">
        <div style="text-transform:uppercase;letter-spacing:0.22em;font-size:11px;color:${C.brass};">${heading}</div>
        <h1 style="font-family:Georgia,serif;font-weight:600;font-size:26px;color:${C.ink};margin:10px 0 0;">${intro}</h1>
        <div style="margin-top:24px;">${body}</div>
      </td></tr>
      <tr><td style="padding:20px 4px;text-align:center;font-size:12px;color:${C.muted};">
        Klenich · Plant-powered home care, made in India<br/>
        <a href="${SITE_URL}" style="color:${C.forest};text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
      </td></tr>
    </table>
  </div>`;
}

// Plain-text counterpart of the order email. A text/plain part alongside the
// HTML improves deliverability (some filters penalise HTML-only mail) and gives
// a clean fallback in text-only clients. No HTML escaping here — this is not an
// HTML context, so the raw user values are correct.
function orderText(order: OrderForEmail, opts: { admin: boolean }): string {
  const isCod = order.paymentMethod === "COD";
  const codDue = order.totalPaise - order.amountPaidPaise;
  const lines: string[] = [];

  lines.push(
    opts.admin
      ? `New ${isCod ? "COD " : ""}order ${order.orderNumber}`
      : `Your Klenich order ${order.orderNumber} is confirmed`,
  );
  lines.push("");

  if (opts.admin) {
    lines.push(`Customer: ${order.shipName} · ${order.email}`);
    lines.push("");
  }
  if (isCod) {
    lines.push(`Cash on Delivery — delivery fee ${formatINR(order.amountPaidPaise)} paid online.`);
    lines.push(
      opts.admin
        ? `Collect ${formatINR(codDue)} in cash on delivery.`
        : `Please keep ${formatINR(codDue)} in cash ready for the delivery agent.`,
    );
    lines.push("");
  }

  lines.push("Items:");
  for (const it of order.items) {
    const variant = [it.fragrance, it.size].filter(Boolean).join(" · ");
    lines.push(`  - ${it.productName}${variant ? ` (${variant})` : ""} × ${it.quantity} — ${formatINR(it.linePaise)}`);
  }
  lines.push("");

  lines.push(`Subtotal: ${formatINR(order.subtotalPaise)}`);
  lines.push(
    `${isCod ? "Delivery (paid online)" : "Shipping"}: ${order.shippingPaise === 0 ? "Free" : formatINR(order.shippingPaise)}`,
  );
  lines.push(`Total: ${formatINR(order.totalPaise)}`);
  if (isCod) {
    lines.push(`Paid online (delivery): ${formatINR(order.amountPaidPaise)}`);
    lines.push(`Due on delivery (cash): ${formatINR(codDue)}`);
  }
  lines.push("");

  lines.push("Shipping to:");
  lines.push(`  ${order.shipName}`);
  lines.push(`  ${order.shipLine1}`);
  if (order.shipLine2) lines.push(`  ${order.shipLine2}`);
  lines.push(`  ${order.shipCity}, ${order.shipState} — ${order.shipPincode}`);
  lines.push("");

  lines.push("Klenich · Plant-powered home care, made in India");
  lines.push(SITE_URL);
  return lines.join("\n");
}

/**
 * Sends the customer confirmation and the admin notification for a paid order.
 * Call only from the path that newly settles the order (exactly once). Throws
 * are the caller's to swallow so email never breaks an order.
 */
export async function sendOrderEmails(order: OrderForEmail): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured

  const isCod = order.paymentMethod === "COD";
  const codDuePaise = order.totalPaise - order.amountPaidPaise;
  const summary = summaryBlock(order);
  // Highlighted payment line — COD confirms the delivery fee is prepaid and
  // states the cash due for the goods on delivery; prepaid orders need no note.
  const payNote = isCod
    ? `<p style="margin:0 0 18px;padding:12px 14px;background:${C.bone};border:1px solid ${C.line};border-radius:4px;font-size:14px;color:${C.ink};"><strong>Cash on Delivery</strong> — your delivery fee of <strong>${formatINR(order.amountPaidPaise)}</strong> is paid. Please keep <strong>${formatINR(codDuePaise)}</strong> in cash ready for the delivery agent.</p>`
    : "";

  // 1. Customer confirmation
  await resend.emails.send({
    from: FROM,
    to: order.email,
    subject: `Your Klenich order ${order.orderNumber} is confirmed`,
    text: orderText(order, { admin: false }),
    html: shell(
      "Order confirmed",
      isCod
        ? "Thank you — your order is confirmed."
        : "Thank you — your order is on its way to being prepared.",
      `<p style="color:${C.muted};font-size:14px;margin:0 0 18px;">Order <strong style="color:${C.ink};">${order.orderNumber}</strong></p>${payNote}${summary}`,
    ),
  });

  // 2. Admin notification (to your inbox)
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    replyTo: order.email,
    subject: `New ${isCod ? "COD " : ""}order ${order.orderNumber} — ${formatINR(order.totalPaise)}`,
    text: orderText(order, { admin: true }),
    html: shell(
      "New order",
      `New ${isCod ? "COD " : ""}order ${order.orderNumber}`,
      `<p style="color:${C.muted};font-size:14px;margin:0 0 18px;">Customer: <strong style="color:${C.ink};">${escapeHtml(order.shipName)}</strong> · ${escapeHtml(order.email)}</p>${isCod ? `<p style="margin:0 0 18px;font-size:14px;color:${C.ink};"><strong>COD</strong> — delivery fee ${formatINR(order.amountPaidPaise)} prepaid online. Collect <strong>${formatINR(codDuePaise)}</strong> in cash on delivery.</p>` : ""}${summary}`,
    ),
  });
}

export type ContactMessage = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

// Escapes user-supplied text before it's interpolated into the HTML email, so a
// message body can never inject markup into the notification we send ourselves.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Forwards a contact-form submission to the support inbox (ADMIN_EMAIL), with
 * replyTo set to the sender so a reply goes straight back to them. Returns
 * `false` when email isn't configured (no key) so the caller can surface that.
 */
export async function sendContactEmail(msg: ContactMessage): Promise<boolean> {
  if (!resend) return false; // no key → can't forward

  const name = escapeHtml(msg.name);
  const email = escapeHtml(msg.email);
  const phone = escapeHtml(msg.phone);
  // tel: links can't contain spaces/parens — strip to digits and a leading +.
  const phoneHref = msg.phone.replace(/[^\d+]/g, "");
  const body = escapeHtml(msg.message).replace(/\n/g, "<br/>");

  // Plain-text counterpart (raw values — not an HTML context, so no escaping).
  const text = [
    `New contact message from ${msg.name}`,
    "",
    `Name:  ${msg.name}`,
    `Email: ${msg.email}`,
    `Phone: ${msg.phone}`,
    "",
    "Message:",
    msg.message,
  ].join("\n");

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    replyTo: msg.email,
    subject: `New contact message from ${msg.name}`,
    text,
    html: shell(
      "Contact form",
      `Message from ${name}`,
      `<p style="color:${C.muted};font-size:14px;margin:0 0 18px;line-height:1.6;">
         <strong style="color:${C.ink};">${name}</strong><br/>
         <a href="mailto:${email}" style="color:${C.forest};text-decoration:none;">${email}</a><br/>
         <a href="tel:${phoneHref}" style="color:${C.forest};text-decoration:none;">${phone}</a>
       </p>
       <div style="padding-top:18px;border-top:1px solid ${C.line};color:${C.ink};font-size:15px;line-height:1.7;white-space:pre-wrap;">${body}</div>`,
    ),
  });

  return true;
}
