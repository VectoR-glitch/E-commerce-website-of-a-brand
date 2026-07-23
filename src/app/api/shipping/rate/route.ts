import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveShipping, type ShippingItem } from "@/lib/ekart";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Live shipping quote for the checkout page: given a destination pincode and the
// cart, returns the prepaid charge, COD availability + COD charge, and whether
// we deliver there at all. Pricing is recomputed authoritatively at /api/checkout
// — this endpoint is purely for display, so it stays read-only.

type IncomingItem = { variantId: string; quantity: number };

export async function POST(request: Request) {
  // Generous limit: a shopper may re-quote a few times while editing the form,
  // but this proxies an upstream (Ekart) call, so cap scripted abuse.
  const rl = await rateLimit(`shiprate:${getClientIp(request)}`, {
    limit: 40,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) return tooManyRequests(rl.retryAfter, "Too many requests. Please wait a moment.");

  let body: { pincode?: string; state?: string; items?: IncomingItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pincode = String(body.pincode ?? "");
  const state = String(body.state ?? "");
  const items = body.items ?? [];
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "A valid 6-digit pincode is required." }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  // Re-read the cart against the DB for authoritative weight + value. Keyed by
  // the immutable variant id (not SKU), so SKU edits don't drop cart lines.
  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds }, active: true },
    select: { id: true, pricePaise: true, weightGrams: true, lengthCm: true, widthCm: true, heightCm: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  let declaredValuePaise = 0;
  const parcelItems: ShippingItem[] = [];
  for (const line of items) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty < 1) continue;
    const v = byId.get(line.variantId);
    if (!v) continue;
    declaredValuePaise += v.pricePaise * qty;
    parcelItems.push({
      weightGrams: v.weightGrams,
      lengthCm: v.lengthCm,
      widthCm: v.widthCm,
      heightCm: v.heightCm,
      quantity: qty,
    });
  }

  const shipping = await resolveShipping({
    deliveryPincode: pincode,
    state,
    items: parcelItems,
    declaredValuePaise,
  });

  if (!shipping.serviceable) {
    return NextResponse.json({ serviceable: false });
  }
  return NextResponse.json({
    serviceable: true,
    codAvailable: shipping.codAvailable,
    prepaidPaise: shipping.prepaidPaise,
    codPaise: shipping.codPaise,
  });
}