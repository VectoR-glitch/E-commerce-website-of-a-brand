import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpay, RAZORPAY_KEY_ID } from "@/lib/razorpay";
import { formatINR } from "@/lib/catalog";
import { MAX_ORDER_PAISE } from "@/lib/constants";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resolveShipping } from "@/lib/shiprocket";

type IncomingItem = { sku: string; quantity: number };
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
  const year = new Date().getFullYear();
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

  // Re-price against the database — the cart's prices are display-only.
  const skus = [...new Set(items.map((i) => i.sku))];
  const variants = await prisma.variant.findMany({
    where: { sku: { in: skus }, active: true },
    include: { product: true },
  });
  const bySku = new Map(variants.map((v) => [v.sku, v]));

  const orderItems = [];
  let subtotalPaise = 0;
  // Summed packed weight for the courier quote; null if any item lacks a weight,
  // which makes resolveShipping fall back to flat rather than quote on bad data.
  let weightGrams: number | null = 0;

  for (const line of items) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty < 1)
      return badRequest("Invalid item quantity.");

    const variant = bySku.get(line.sku);
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
    if (weightGrams !== null && variant.weightGrams != null) {
      weightGrams += variant.weightGrams * qty;
    } else {
      weightGrams = null;
    }
    orderItems.push({
      variantId: variant.id,
      sku: variant.sku,
      productName: variant.product.name,
      fragrance: variant.fragrance,
      size: variant.size,
      unitPaise: variant.pricePaise,
      quantity: qty,
      linePaise,
    });
  }

  // Authoritative delivery charge from Shiprocket (cheapest serviceable courier),
  // falling back to the flat state rate if Shiprocket is unreachable. COD prepays
  // only this charge; the goods are cash on delivery.
  const isCod = body.paymentMethod === "COD";
  const shipping = await resolveShipping({
    deliveryPincode: ship.pincode,
    state: ship.state,
    weightGrams,
    declaredValuePaise: subtotalPaise,
  });
  if (!shipping.serviceable) {
    return badRequest("We don't deliver to this pincode yet. Please try another address.");
  }
  if (isCod && (!shipping.codAvailable || shipping.codPaise == null)) {
    return badRequest("Cash on Delivery isn't available for this pincode. Please pay online.");
  }
  const shippingPaise = isCod ? shipping.codPaise! : shipping.prepaidPaise;
  const totalPaise = subtotalPaise + shippingPaise;

  // Both methods go through Razorpay, but COD only prepays the delivery fee —
  // the goods are collected in cash on delivery. ONLINE pays the full total.
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
  const order = await prisma.order.create({
    data: {
      orderNumber,
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
      totalPaise,
      razorpayOrderId: rzpOrder.id,
      items: { create: orderItems },
    },
  });

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
    totalPaise,
    currency: "INR",
    prefill: {
      name: ship.fullName,
      email: ship.email,
      contact: ship.phone,
    },
  });
}