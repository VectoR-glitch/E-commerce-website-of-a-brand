"use server";
// Customer-facing "notify me when back in stock" signup. Server Action, so it
// rate-limits + validates itself. Stores one pending alert per email+variant;
// re-subscribing simply re-arms it (resets notifiedAt).
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

export type BackInStockState =
  | { ok?: boolean; error?: string; alreadyInStock?: boolean }
  | undefined;

export async function requestBackInStockAlert(input: {
  variantId: string;
  email: string;
}): Promise<BackInStockState> {
  // Throttle abuse: 15 signups / 10 min per IP.
  const rl = await rateLimit(`bis:${getClientIpFromHeaders(await headers())}`, {
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return { error: "Too many requests — please wait a few minutes and try again." };

  const variantId = String(input.variantId ?? "");
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!variantId) return { error: "Something went wrong — please refresh and try again." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, active: true, product: { active: true } },
    select: { id: true, stock: true },
  });
  if (!variant) return { error: "This item isn't available right now." };
  // Already buyable — nothing to wait for; tell the UI so it can nudge them.
  if (variant.stock > 0) return { ok: true, alreadyInStock: true };

  const session = await getSession();
  await prisma.backInStockAlert.upsert({
    where: { variantId_email: { variantId, email } },
    create: { variantId, email, customerId: session?.sub ?? null },
    // Re-arm an existing (possibly already-notified) request for this refill.
    update: { notifiedAt: null, customerId: session?.sub ?? null },
  });

  return { ok: true };
}
