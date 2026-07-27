// Server-only transactional email via Resend. No-ops safely when RESEND_API_KEY
// is absent, so the order flow works with or without email configured.
//
// Env:
//   RESEND_API_KEY  — Klenich's Resend key (required to actually send)
//   RESEND_FROM     — sender; defaults to the test sender until klenich.com is
//                     verified, then set to "Klenich <orders@klenich.com>"
//   ADMIN_EMAIL     — where order notifications land (your inbox)
import type { OrderStatus } from "@prisma/client";
import { Resend } from "resend";
import { formatINR } from "@/lib/catalog";
import { SITE_URL } from "@/lib/constants";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const EMAIL_TIMEOUT_MS = 15000;

// Resend's SDK exposes no per-call timeout/AbortSignal — wraps every send in
// a timeout race so a hung request (e.g. a stalled TLS handshake) can never
// block a caller indefinitely, matching every other external call in this
// codebase (Ekart, WhatsApp, Upstash), which all set an explicit timeout for
// exactly this reason. Especially important for the daily cron, whose tasks
// run sequentially — one hung email send would otherwise starve every task
// after it of the function's time budget.
async function sendEmail(payload: Parameters<NonNullable<typeof resend>["emails"]["send"]>[0]) {
  if (!resend) throw new Error("Resend not configured");
  return Promise.race([
    resend.emails.send(payload),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Resend request timed out")), EMAIL_TIMEOUT_MS),
    ),
  ]);
}

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
  // Null for orders created before this field existed — those simply don't
  // get a tracking link in their emails.
  trackingToken: string | null;
  email: string;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  couponCode: string | null;
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

function trackingUrl(order: OrderForEmail): string | null {
  return order.trackingToken ? `${SITE_URL}/track-order/${order.trackingToken}` : null;
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
      ${order.discountPaise > 0 ? `<tr><td style="padding:4px 0;color:${C.forest};">Discount</td><td style="padding:4px 0;text-align:right;color:${C.forest};">−${formatINR(order.discountPaise)}</td></tr>` : ""}
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
  if (order.discountPaise > 0) lines.push(`Discount: −${formatINR(order.discountPaise)}`);
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

  const track = trackingUrl(order);
  if (track && !opts.admin) {
    lines.push(`Track your order: ${track}`);
    lines.push("");
  }

  lines.push("Klenich · Plant-powered home care, made in India");
  lines.push(SITE_URL);
  return lines.join("\n");
}

/**
 * Sends the customer confirmation and the admin notification for a paid order.
 * Call only from the path that newly settles the order (exactly once). Throws
 * are the caller's to swallow so email never breaks an order. `invoice`, when
 * given, attaches the GST invoice PDF to both emails.
 */
export async function sendOrderEmails(
  order: OrderForEmail,
  invoice?: { pdf: Buffer; invoiceNumber: string },
): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured

  const isCod = order.paymentMethod === "COD";
  const codDuePaise = order.totalPaise - order.amountPaidPaise;
  const summary = summaryBlock(order);
  // Highlighted payment line — COD confirms the delivery fee is prepaid and
  // states the cash due for the goods on delivery; prepaid orders need no note.
  const payNote = isCod
    ? `<p style="margin:0 0 18px;padding:12px 14px;background:${C.bone};border:1px solid ${C.line};border-radius:4px;font-size:14px;color:${C.ink};"><strong>Cash on Delivery</strong> — your delivery fee of <strong>${formatINR(order.amountPaidPaise)}</strong> is paid. Please keep <strong>${formatINR(codDuePaise)}</strong> in cash ready for the delivery agent.</p>`
    : "";
  const attachments = invoice
    ? [{ filename: `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`, content: invoice.pdf }]
    : undefined;

  // 1. Customer confirmation
  await sendEmail({
    from: FROM,
    to: order.email,
    subject: `Your Klenich order ${order.orderNumber} is confirmed`,
    text: orderText(order, { admin: false }),
    html: shell(
      "Order confirmed",
      isCod
        ? "Thank you — your order is confirmed."
        : "Thank you — your order is on its way to being prepared.",
      `<p style="color:${C.muted};font-size:14px;margin:0 0 18px;">Order <strong style="color:${C.ink};">${order.orderNumber}</strong></p>${payNote}${summary}${
        trackingUrl(order) ? `<p style="margin:22px 0 0;">${ctaButton(trackingUrl(order)!, "Track Your Order")}</p>` : ""
      }`,
    ),
    attachments,
  });

  // 2. Admin notification (to your inbox)
  await sendEmail({
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
    attachments,
  });
}

// ── Order status-change emails (sent from the admin panel) ──────────────────
type StatusCopy = { heading: string; intro: string; note?: string };

// Customer-facing copy per fulfilment status. Statuses NOT listed here (e.g.
// PENDING) send no email — there's nothing useful to tell the customer yet.
const STATUS_EMAILS: Partial<Record<OrderStatus, StatusCopy>> = {
  CONFIRMED: {
    heading: "Order confirmed",
    intro: "Your order is confirmed.",
    note: "We're getting it ready for dispatch — we'll email you again when it ships.",
  },
  PACKED: {
    heading: "Packed",
    intro: "Your order is packed and ready to ship.",
    note: "It'll be handed to the courier shortly.",
  },
  SHIPPED: {
    heading: "On its way",
    intro: "Your order has shipped.",
    note: "It's now with the courier and on its way to you.",
  },
  DELIVERED: {
    heading: "Delivered",
    intro: "Your order has been delivered.",
    note: "We hope you love it. If anything isn't right, just reply to this email.",
  },
  ON_HOLD: {
    heading: "Order on hold",
    intro: "Your order is temporarily on hold.",
    note: "Our team is reviewing it and will be in touch shortly.",
  },
  CANCELLED: {
    heading: "Order cancelled",
    intro: "Your order has been cancelled.",
    note: "If a payment was made, any refund will be processed to your original payment method.",
  },
  RETURNED: {
    heading: "Return processed",
    intro: "Your return has been processed.",
    note: "Any eligible refund will follow to your original payment method.",
  },
};

/** True when a status change should notify the customer by email. */
export function statusEmailsCustomer(status: OrderStatus): boolean {
  return status in STATUS_EMAILS;
}

// Plain-text counterpart of the status email (deliverability + text clients).
function statusText(order: OrderForEmail, copy: StatusCopy): string {
  const lines: string[] = [];
  lines.push(`Klenich order ${order.orderNumber} — ${copy.heading}`);
  lines.push("");
  lines.push(copy.intro);
  if (copy.note) {
    lines.push("");
    lines.push(copy.note);
  }
  lines.push("");
  lines.push("Items:");
  for (const it of order.items) {
    const variant = [it.fragrance, it.size].filter(Boolean).join(" · ");
    lines.push(`  - ${it.productName}${variant ? ` (${variant})` : ""} × ${it.quantity} — ${formatINR(it.linePaise)}`);
  }
  lines.push("");
  if (order.discountPaise > 0) {
    lines.push(`Discount (${order.couponCode ?? "coupon"}): −${formatINR(order.discountPaise)}`);
  }
  lines.push(`Total: ${formatINR(order.totalPaise)}`);
  lines.push("");
  const track = trackingUrl(order);
  if (track) {
    lines.push(`Track your order: ${track}`);
    lines.push("");
  }
  lines.push("Questions? Just reply to this email.");
  lines.push("");
  lines.push("Klenich · Plant-powered home care, made in India");
  lines.push(SITE_URL);
  return lines.join("\n");
}

/**
 * Emails the customer when their order's fulfilment status changes. Best-effort:
 * the caller swallows throws so email never blocks or breaks the status update.
 * No-ops for statuses with no customer-facing copy (and when no API key is set).
 */
export async function sendOrderStatusEmail(order: OrderForEmail, status: OrderStatus): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured
  const copy = STATUS_EMAILS[status];
  if (!copy) return; // status the customer doesn't need an email for

  const noteHtml = copy.note
    ? `<p style="margin:0 0 18px;padding:12px 14px;background:${C.bone};border:1px solid ${C.line};border-radius:4px;font-size:14px;color:${C.ink};">${copy.note}</p>`
    : "";

  await sendEmail({
    from: FROM,
    to: order.email,
    replyTo: ADMIN_EMAIL,
    subject: `Your Klenich order ${order.orderNumber} — ${copy.heading}`,
    text: statusText(order, copy),
    html: shell(
      copy.heading,
      copy.intro,
      `<p style="color:${C.muted};font-size:14px;margin:0 0 18px;">Order <strong style="color:${C.ink};">${order.orderNumber}</strong></p>${noteHtml}${summaryBlock(order)}${
        trackingUrl(order) ? `<p style="margin:22px 0 0;">${ctaButton(trackingUrl(order)!, "Track Your Order")}</p>` : ""
      }`,
    ),
  });
}

// ── Account emails (verification, password reset) ───────────────────────────
// Branded call-to-action button for links in transactional email.
function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:4px 0 22px;background:${C.forest};color:${C.bone};text-decoration:none;padding:13px 26px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">${label}</a>`;
}

/** Sends the email-confirmation link for a new (or re-sent) account. */
export async function sendVerificationEmail(
  to: string,
  name: string | null,
  verifyUrl: string,
): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured
  const hi = name ? `Hi ${escapeHtml(name)},` : "Welcome,";
  await sendEmail({
    from: FROM,
    to,
    subject: "Verify your email for Klenich",
    text: [
      name ? `Hi ${name},` : "Welcome,",
      "",
      "Confirm your email address to activate your Klenich account:",
      verifyUrl,
      "",
      "This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.",
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      "Verify your email",
      "Confirm your email",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 14px;">${hi}</p>
       <p style="color:${C.muted};font-size:14px;line-height:1.6;margin:0 0 20px;">Confirm your email address to activate your Klenich account.</p>
       ${ctaButton(verifyUrl, "Verify email")}
       <p style="color:${C.muted};font-size:13px;line-height:1.6;margin:0;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>`,
    ),
  });
}

/** Sends a password-reset link. Only ever emailed to a real, matching account. */
export async function sendPasswordResetEmail(
  to: string,
  name: string | null,
  resetUrl: string,
): Promise<void> {
  if (!resend) return;
  const hi = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  await sendEmail({
    from: FROM,
    to,
    subject: "Reset your Klenich password",
    text: [
      name ? `Hi ${name},` : "Hi,",
      "",
      "We received a request to reset your Klenich password. Use the link below to choose a new one:",
      resetUrl,
      "",
      "This link expires in 1 hour and can be used once. If you didn't request this, you can safely ignore this email — your password won't change.",
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      "Password reset",
      "Reset your password",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 14px;">${hi}</p>
       <p style="color:${C.muted};font-size:14px;line-height:1.6;margin:0 0 20px;">We received a request to reset your Klenich password. Choose a new one below.</p>
       ${ctaButton(resetUrl, "Reset password")}
       <p style="color:${C.muted};font-size:13px;line-height:1.6;margin:0;">This link expires in 1 hour and can be used once. If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    ),
  });
}

// ── Back-in-stock alert ─────────────────────────────────────────────────────
// Sent when a variant a customer asked about is restocked. One-tap back to the
// product page, where the item is now buyable.
export async function sendBackInStockEmail(input: {
  to: string;
  productName: string;
  variantLabel: string; // e.g. "Lavender · 1L"
  pricePaise: number;
  productUrl: string;
}): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured
  const label = escapeHtml(input.variantLabel);
  const name = escapeHtml(input.productName);

  await sendEmail({
    from: FROM,
    to: input.to,
    subject: `Back in stock: ${input.productName}`,
    text: [
      `Good news — the ${input.productName} (${input.variantLabel}) you wanted is back in stock.`,
      `Price: ${formatINR(input.pricePaise)}.`,
      "",
      "Popular items can sell out again quickly — grab yours here:",
      input.productUrl,
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      "Back in stock",
      "It's back — grab it before it's gone",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 6px;line-height:1.6;">
         Good news — the <strong>${name}</strong> (${label}) you asked about is back in stock.
       </p>
       <p style="color:${C.muted};font-size:14px;margin:0 0 20px;">
         <strong style="color:${C.ink};">${formatINR(input.pricePaise)}</strong> · popular items can sell out again quickly.
       </p>
       ${ctaButton(input.productUrl, "Shop it now")}
       <p style="color:${C.muted};font-size:13px;margin:0;line-height:1.6;">
         You're getting this because you asked to be notified when this item returned. No further action is needed.
       </p>`,
    ),
  });
}

// ── Abandoned cart reminder ─────────────────────────────────────────────────
// Sent to a signed-in customer who left items in their cart without checking
// out. One gentle nudge per abandonment episode (see the sweep). Lists what's
// waiting and links straight back to the cart.
type AbandonedItem = {
  name: string;
  fragrance: string | null;
  size: string;
  quantity: number;
  pricePaise: number;
};

export async function sendAbandonedCartEmail(input: {
  to: string;
  name: string | null;
  items: AbandonedItem[];
  subtotalPaise: number;
  cartUrl: string;
}): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured
  const hi = input.name ? `Hi ${escapeHtml(input.name)},` : "Hi,";

  const rows = input.items
    .map((it) => {
      const name = escapeHtml(it.name);
      const variant = escapeHtml([it.fragrance, it.size].filter(Boolean).join(" · "));
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};">
            <div style="font-weight:600;color:${C.ink};">${name}</div>
            <div style="font-size:13px;color:${C.muted};">${variant} &nbsp;×&nbsp; ${it.quantity}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;color:${C.ink};">
            ${formatINR(it.pricePaise * it.quantity)}
          </td>
        </tr>`;
    })
    .join("");

  const textLines = [
    input.name ? `Hi ${input.name},` : "Hi,",
    "",
    "You left something in your cart at Klenich:",
    "",
    ...input.items.map((it) => {
      const variant = [it.fragrance, it.size].filter(Boolean).join(" · ");
      return `  - ${it.name}${variant ? ` (${variant})` : ""} × ${it.quantity} — ${formatINR(it.pricePaise * it.quantity)}`;
    }),
    "",
    `Subtotal: ${formatINR(input.subtotalPaise)}`,
    "",
    "Your cart is saved — pick up where you left off:",
    input.cartUrl,
    "",
    "Klenich · Plant-powered home care, made in India",
    SITE_URL,
  ];

  await sendEmail({
    from: FROM,
    to: input.to,
    subject: "You left something behind 🧺",
    text: textLines.join("\n"),
    html: shell(
      "Your cart is waiting",
      "You left something behind",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 14px;">${hi}</p>
       <p style="color:${C.muted};font-size:14px;line-height:1.6;margin:0 0 20px;">
         Your cart is saved and ready when you are — here's what's inside:
       </p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
         ${rows}
         <tr><td style="padding:12px 0 0;font-family:Georgia,serif;font-size:18px;color:${C.ink};">Subtotal</td><td style="padding:12px 0 0;text-align:right;font-family:Georgia,serif;font-size:18px;color:${C.ink};">${formatINR(input.subtotalPaise)}</td></tr>
       </table>
       <div style="margin-top:24px;">${ctaButton(input.cartUrl, "Complete your order")}</div>
       <p style="color:${C.muted};font-size:13px;margin:0;line-height:1.6;">
         Prices and stock can change — checkout to lock in what's in your cart.
       </p>`,
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

  await sendEmail({
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

// ── Subscribe & save reminder ───────────────────────────────────────────────
// Sent when a subscription is due. Managed model: we never auto-charge — the
// email nudges the customer to place the order (one tap on their account page),
// with the saved price pre-applied.
export async function sendSubscriptionReminder(input: {
  to: string;
  name: string | null;
  productName: string;
  variantLabel: string; // e.g. "Lavender · 1L"
  quantity: number;
  discountPercent: number;
  unitDiscountedPaise: number;
  manageUrl: string;
}): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured
  const hi = input.name ? `Hi ${escapeHtml(input.name)},` : "Hi,";
  const label = escapeHtml(input.variantLabel);
  const qty = input.quantity > 1 ? ` × ${input.quantity}` : "";

  await sendEmail({
    from: FROM,
    to: input.to,
    subject: `Time to restock your ${input.productName}?`,
    text: [
      input.name ? `Hi ${input.name},` : "Hi,",
      "",
      `Your ${input.productName} (${input.variantLabel})${qty} is due for its next delivery.`,
      `As a subscriber you save ${input.discountPercent}% — ${formatINR(input.unitDiscountedPaise)} each.`,
      "",
      "Nothing is charged automatically. Place the order whenever you're ready:",
      input.manageUrl,
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      `Subscribe & save · ${input.discountPercent}% off`,
      "Ready for a refill?",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 14px;">${hi}</p>
       <p style="color:${C.ink};font-size:15px;margin:0 0 6px;line-height:1.6;">
         Your <strong>${escapeHtml(input.productName)}</strong> (${label})${qty} is due for its next delivery.
       </p>
       <p style="color:${C.muted};font-size:14px;margin:0 0 20px;">
         As a subscriber you pay <strong style="color:${C.ink};">${formatINR(input.unitDiscountedPaise)}</strong> each — a standing ${input.discountPercent}% saving.
       </p>
       ${ctaButton(input.manageUrl, "Order now")}
       <p style="color:${C.muted};font-size:13px;margin:0;line-height:1.6;">
         Nothing is charged automatically — order only when you're ready. You can skip, pause or cancel anytime from your account.
       </p>`,
    ),
  });
}

// ── Subscription plan reminder (multi-item "build a box") ──────────────────
// Same managed/reminder model as sendSubscriptionReminder above, generalized
// to a plan's several items with one combined total.
export async function sendSubscriptionPlanReminder(input: {
  to: string;
  name: string | null;
  discountPercent: number;
  items: { productName: string; variantLabel: string; quantity: number; unitDiscountedPaise: number }[];
  totalDiscountedPaise: number;
  manageUrl: string;
}): Promise<void> {
  if (!resend) return; // no key → safe no-op until configured
  const hi = input.name ? `Hi ${escapeHtml(input.name)},` : "Hi,";

  const textLines = input.items.map((it) => {
    const qty = it.quantity > 1 ? ` × ${it.quantity}` : "";
    return `- ${it.productName} (${it.variantLabel})${qty} — ${formatINR(it.unitDiscountedPaise)} each`;
  });
  const htmlRows = input.items
    .map((it) => {
      const qty = it.quantity > 1 ? ` × ${it.quantity}` : "";
      return `<li style="color:${C.ink};font-size:14px;margin:0 0 6px;line-height:1.5;">
        <strong>${escapeHtml(it.productName)}</strong> (${escapeHtml(it.variantLabel)})${qty} — ${formatINR(it.unitDiscountedPaise)} each
      </li>`;
    })
    .join("");

  await sendEmail({
    from: FROM,
    to: input.to,
    subject: "Time to restock your subscription?",
    text: [
      input.name ? `Hi ${input.name},` : "Hi,",
      "",
      "Your subscription box is due for its next delivery:",
      ...textLines,
      "",
      `As a subscriber you save ${input.discountPercent}% — total ${formatINR(input.totalDiscountedPaise)}.`,
      "",
      "Nothing is charged automatically. Place the order whenever you're ready:",
      input.manageUrl,
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      `Subscribe & save · ${input.discountPercent}% off`,
      "Ready for a refill?",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 14px;">${hi}</p>
       <p style="color:${C.ink};font-size:15px;margin:0 0 10px;line-height:1.6;">
         Your subscription box is due for its next delivery:
       </p>
       <ul style="margin:0 0 14px;padding-left:18px;">${htmlRows}</ul>
       <p style="color:${C.muted};font-size:14px;margin:0 0 20px;">
         As a subscriber you save ${input.discountPercent}% — total <strong style="color:${C.ink};">${formatINR(input.totalDiscountedPaise)}</strong>.
       </p>
       ${ctaButton(input.manageUrl, "Order now")}
       <p style="color:${C.muted};font-size:13px;margin:0;line-height:1.6;">
         Nothing is charged automatically — order only when you're ready. You can skip, pause or cancel anytime from your account.
       </p>`,
    ),
  });
}

// ── Newsletter welcome ───────────────────────────────────────────────────────
/** Sends the single-use 10%-off code minted for a new newsletter signup. */
export async function sendWelcomeDiscountEmail(to: string, code: string): Promise<boolean> {
  if (!resend) return false;
  const escapedCode = escapeHtml(code);

  await sendEmail({
    from: FROM,
    to,
    subject: "Here's your 10% off — welcome to Klenich",
    text: [
      "Welcome to the Klenich journal.",
      "",
      `Here's 10% off your first order: ${code}`,
      "Enter it at checkout — good for one order, on us.",
      "",
      `Shop now: ${SITE_URL}/shop`,
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      "Welcome",
      "Here's 10% off your first order",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 18px;line-height:1.6;">
         Thanks for joining the Klenich journal. Use this code at checkout for 10% off — good for one order, on us.
       </p>
       <div style="margin:0 0 22px;padding:16px;background:${C.bone};border:1px dashed ${C.brass};text-align:center;">
         <span style="font-family:Georgia,serif;font-size:20px;letter-spacing:0.08em;color:${C.forest};font-weight:600;">${escapedCode}</span>
       </div>
       ${ctaButton(`${SITE_URL}/shop`, "Shop now")}`,
    ),
  });
  return true;
}

// ── Review request ───────────────────────────────────────────────────────────
/** Sent a few days after delivery, nudging the customer to review what they bought. */
export async function sendReviewRequestEmail(input: {
  to: string;
  name: string | null;
  orderNumber: string;
  products: { name: string; slug: string }[];
}): Promise<boolean> {
  if (!resend) return false;
  const hi = input.name ? `Hi ${escapeHtml(input.name)},` : "Hi,";
  const isPlural = input.products.length > 1;

  const htmlLinks = input.products
    .map(
      (p) =>
        `<li style="margin-bottom:6px;"><a href="${SITE_URL}/product/${p.slug}#reviews" style="color:${C.forest};">${escapeHtml(p.name)}</a></li>`,
    )
    .join("");
  const textLines = input.products.map((p) => `${p.name}: ${SITE_URL}/product/${p.slug}#reviews`);

  await sendEmail({
    from: FROM,
    to: input.to,
    subject: isPlural ? "How are you liking your Klenich order?" : `How's your ${input.products[0]?.name}?`,
    text: [
      input.name ? `Hi ${input.name},` : "Hi,",
      "",
      `Your order ${input.orderNumber} should have settled in by now — we'd love to hear what you think.`,
      "",
      "Leave a review:",
      ...textLines,
      "",
      "Takes less than a minute, and it genuinely helps other shoppers decide.",
      "",
      "Klenich · Plant-powered home care, made in India",
      SITE_URL,
    ].join("\n"),
    html: shell(
      "Your feedback",
      "How’s it working out?",
      `<p style="color:${C.ink};font-size:15px;margin:0 0 14px;">${hi}</p>
       <p style="color:${C.muted};font-size:14px;line-height:1.6;margin:0 0 18px;">
         Your order <strong style="color:${C.ink};">${escapeHtml(input.orderNumber)}</strong> should
         have settled in by now — we'd love to hear what you think. Takes less than a minute, and it
         genuinely helps other shoppers decide.
       </p>
       <ul style="margin:0 0 20px;padding-left:18px;color:${C.ink};font-size:14px;">${htmlLinks}</ul>`,
    ),
  });
  return true;
}
