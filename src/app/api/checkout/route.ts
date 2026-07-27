import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpay, RAZORPAY_KEY_ID } from "@/lib/razorpay";
import { formatINR } from "@/lib/catalog";
import {
  MAX_ORDER_PAISE,
  MAX_QTY_PER_ITEM,
  MAX_COD_ORDER_PAISE,
  SUBSCRIBE_SAVE_PERCENT,
  SUBSCRIBE_INTERVALS,
} from "@/lib/constants";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resolveShipping, type ShippingItem } from "@/lib/ekart";
import { getSession } from "@/lib/session";
import { validateCoupon } from "@/lib/coupons";
import { toIST } from "@/lib/gst";

type IncomingItem = { variantId: string; quantity: number };
type IncomingShipping = {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function generateOrderNumber() {
  // Human-friendly + collision-resistant: KLN-2026-XXXXXX (base36, uppercase).
  const year = toIST(new Date()).getUTCFullYear();
  const suffix = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  return `KLN-${year}-${suffix}`;
}

export async function POST(request: Request) {
  // Rate limit order creation: 10 per 5 minutes per IP. Stops scripted floods
  // of PENDING orders (stock churn, DB bloat, Razorpay order spam) while
  // leaving plenty of headroom for a real shopper retrying payment.
  const rl = await rateLimit(`checkout:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) {
    return tooManyRequests(
      rl.retryAfter,
      "Too many checkout attempts. Please wait a moment and try again.",
    );
  }

  let body: {
    items?: IncomingItem[];
    shipping?: IncomingShipping;
    paymentMethod?: "ONLINE" | "COD";
    couponCode?: string;
    // Present only when this checkout should START a multi-item subscription
    // plan (the "build a box" flow at /subscribe) — see subscription-plans.ts.
    // Mutually exclusive with couponCode: when set, the discount is computed
    // automatically below and any couponCode is ignored (the UI never sends
    // both; this is just a defensive server-side stance).
    subscriptionIntervalDays?: number;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const items = body.items ?? [];
  const ship = body.shipping;

  if (items.length === 0) return badRequest("Your cart is empty.");
  if (!ship) return badRequest("Shipping details are required.");

  // Minimal server-side validation (mirrors the client form).
  if (!ship.fullName?.trim()) return badRequest("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ship.email ?? ""))
    return badRequest("A valid email is required.");
  if (!/^[6-9]\d{9}$/.test(ship.phone ?? ""))
    return badRequest("A valid 10-digit mobile is required.");
  if (!ship.line1?.trim()) return badRequest("Address is required.");
  if (!ship.city?.trim() || !ship.state?.trim())
    return badRequest("City and state are required.");
  if (!/^\d{6}$/.test(ship.pincode ?? ""))
    return badRequest("A valid 6-digit pincode is required.");

  // Re-price against the database — the cart's prices are display-only. Items
  // are keyed by the immutable variant id (not SKU), so a re-labelled SKU never
  // orphans a cart line here.
  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds }, active: true },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const orderItems = [];
  let subtotalPaise = 0;
  // Per-line weight+dimensions for the courier quote; resolveShipping falls
  // back to the flat rate if any line is missing either.
  const parcelItems: ShippingItem[] = [];

  for (const line of items) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty < 1)
      return badRequest("Invalid item quantity.");
    // Independently re-enforce the per-line cap. The client reducer already
    // bounds this, but a crafted request can send any quantity straight to
    // this route — so the server must reject it too (stock is also checked
    // below, but this guards orders for out-of-stock-but-cap-busting amounts).
    if (qty > MAX_QTY_PER_ITEM)
      return badRequest(`You can order at most ${MAX_QTY_PER_ITEM} of a single item.`);

    const variant = byId.get(line.variantId);
    if (!variant)
      return badRequest(`An item in your cart is no longer available.`);
    if (variant.stock < qty) {
      // Name the exact variant (fragrance + size), not just the product line.
      const desc = [variant.fragrance, variant.size].filter(Boolean).join(" · ");
      return badRequest(
        `Only ${variant.stock} left of ${variant.product.name}${desc ? ` (${desc})` : ""}. Please adjust your cart.`,
      );
    }

    const linePaise = variant.pricePaise * qty;
    subtotalPaise += linePaise;
    parcelItems.push({
      weightGrams: variant.weightGrams,
      lengthCm: variant.lengthCm,
      widthCm: variant.widthCm,
      heightCm: variant.heightCm,
      quantity: qty,
    });
    orderItems.push({
      variantId: variant.id,
      sku: variant.sku,
      productName: variant.product.name,
      fragrance: variant.fragrance,
      size: variant.size,
      unitPaise: variant.pricePaise,
      quantity: qty,
      linePaise,
      // GST snapshot — frozen at order time so a later product-level rate
      // change never alters an already-issued invoice.
      hsnCode: variant.product.hsnCode,
      gstPercent: variant.product.gstPercent,
    });
  }

  // Authoritative delivery charge from Ekart, falling back to the flat state
  // rate if Ekart is unreachable. COD prepays only this charge; the goods are
  // cash on delivery.
  const isCod = body.paymentMethod === "COD";
  const shipping = await resolveShipping({
    deliveryPincode: ship.pincode,
    state: ship.state,
    items: parcelItems,
    declaredValuePaise: subtotalPaise,
  });
  if (!shipping.serviceable) {
    return badRequest("We don't deliver to this pincode yet. Please try another address.");
  }
  if (isCod && (!shipping.codAvailable || shipping.codPaise == null)) {
    return badRequest("Cash on Delivery isn't available for this pincode. Please pay online.");
  }
  const shippingPaise = isCod ? shipping.codPaise! : shipping.prepaidPaise;

  // Attribute the order to the signed-in customer (if any) so it appears in
  // their account history, and so a customer-specific coupon (loyalty
  // voucher) can be checked against the right customer below.
  const session = await getSession();

  // "Build a box" subscription-plan checkout: the discount is automatic (not
  // a swappable coupon — see prisma schema's SubscriptionPlan comment for
  // why), and requires a signed-in customer since a plan is tied to one.
  const subscriptionIntervalDays = body.subscriptionIntervalDays;
  if (subscriptionIntervalDays != null) {
    if (!session) return badRequest("Please sign in to start a subscription.");
    if (!SUBSCRIBE_INTERVALS.some((i) => i.days === subscriptionIntervalDays)) {
      return badRequest("Please choose a valid delivery frequency.");
    }
  }

  // Apply a coupon against the goods subtotal. Re-validated server-side (the
  // client preview is advisory) so a tampered request can't fake a discount.
  // Skipped entirely for a subscription-plan checkout — its discount is
  // computed below instead, and any couponCode sent alongside is ignored
  // (the UI never sends both; this is just a defensive server-side stance).
  let discountPaise = 0;
  let couponCode: string | null = null;
  if (subscriptionIntervalDays != null) {
    discountPaise = Math.min(Math.round(subtotalPaise * (SUBSCRIBE_SAVE_PERCENT / 100)), subtotalPaise);
  } else if (body.couponCode?.trim()) {
    // Pass the cart so a bundle (KIT-) code is gated on its items being present.
    const result = await validateCoupon(
      body.couponCode,
      subtotalPaise,
      items.map((i) => ({ variantId: i.variantId, quantity: Math.floor(Number(i.quantity)) })),
      session?.sub ?? null,
    );
    if (!result.ok) return badRequest(result.error);
    discountPaise = result.discountPaise;
    couponCode = result.code;
  }

  const totalPaise = subtotalPaise + shippingPaise - discountPaise;

  // Both methods go through Razorpay, but COD only prepays the delivery fee —
  // the goods (net of discount) are collected in cash on delivery. ONLINE pays
  // the full discounted total.
  const razorpayAmount = isCod ? shippingPaise : totalPaise;

  // Reject oversized orders up front (before hitting Razorpay) with a clear,
  // actionable message — Razorpay would otherwise fail this with a vague error.
  // Only the online charge can hit the cap; the COD charge is just the small
  // delivery fee, so the goods total is never Razorpay-limited.
  if (!isCod && totalPaise > MAX_ORDER_PAISE) {
    return badRequest(
      `Online payment is limited to ${formatINR(MAX_ORDER_PAISE)} per order. Please reduce some quantities, or contact us for a large order.`,
    );
  }

  // Cap the cash exposure on a COD order. Only the delivery fee is prepaid, so
  // the goods (subtotalPaise) are collected as cash at the door — an order that
  // can be refused. Above the cap, ask the customer to pay online instead.
  if (isCod && subtotalPaise - discountPaise > MAX_COD_ORDER_PAISE) {
    return badRequest(
      `Cash on Delivery is limited to ${formatINR(MAX_COD_ORDER_PAISE)} of goods per order. Please reduce some quantities, or pay online for a larger order.`,
    );
  }

  // Create the Razorpay order first; if it fails we never write a DB order.
  const orderNumber = generateOrderNumber();
  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.create({
      amount: razorpayAmount, // paise — full total (ONLINE) or delivery fee (COD)
      currency: "INR",
      receipt: orderNumber,
      notes: { orderNumber, email: ship.email, paymentMethod: isCod ? "COD" : "ONLINE" },
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    const description = (err as { error?: { description?: string } })?.error
      ?.description;
    // Razorpay caps the amount per order — surface a precise, actionable
    // message rather than a dead-end "try again" the customer can't act on.
    if (description && /amount/i.test(description)) {
      return NextResponse.json(
        {
          error:
            "This order total is too large to pay online in a single transaction. Please reduce some quantities and try again.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 502 },
    );
  }

  // Persist a PENDING order with the snapshotted shipping + line items.
  // amountPaidPaise stays 0 until settlement records what Razorpay captured.
  let order;
  try {
    order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: session?.sub ?? null,
        email: ship.email,
        phone: ship.phone,
        shipName: ship.fullName,
        shipLine1: ship.line1,
        shipLine2: ship.line2 || null,
        shipCity: ship.city,
        shipState: ship.state,
        shipPincode: ship.pincode,
        paymentMethod: isCod ? "COD" : "ONLINE",
        subtotalPaise,
        shippingPaise,
        discountPaise,
        couponCode,
        totalPaise,
        subscriptionIntervalDays: subscriptionIntervalDays ?? null,
        razorpayOrderId: rzpOrder.id,
        // Unguessable id for the "Track your order" email link — independent
        // of the human-friendly orderNumber so the link can't be brute-forced.
        trackingToken: randomBytes(32).toString("base64url"),
        items: { create: orderItems },
      },
    });
  } catch (err) {
    // The Razorpay order above now exists with no matching DB row — it's
    // harmless on its own (nothing charges without a completed checkout), but
    // log the Razorpay order id so it's traceable if a customer ever manages
    // to complete payment against it before this request's retry.
    console.error(
      `Order persistence failed after Razorpay order ${rzpOrder.id} (orderNumber ${orderNumber}):`,
      err,
    );
    return NextResponse.json(
      { error: "Could not create your order. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    keyId: RAZORPAY_KEY_ID,
    razorpayOrderId: rzpOrder.id,
    orderId: order.id,
    orderNumber,
    paymentMethod: isCod ? "COD" : "ONLINE",
    // `amount` is what Razorpay charges now: full total (ONLINE) or just the
    // delivery fee (COD). The breakdown lets the client show what's paid now vs
    // what's due as cash on delivery.
    amount: razorpayAmount,
    subtotalPaise,
    shippingPaise,
    discountPaise,
    couponCode,
    totalPaise,
    currency: "INR",
    prefill: {
      name: ship.fullName,
      email: ship.email,
      contact: ship.phone,
    },
  });
}