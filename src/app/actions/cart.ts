"use server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MAX_QTY_PER_ITEM } from "@/lib/constants";
import { loadServerCartItems } from "@/lib/server-cart";
import type { CartItem } from "@/lib/cart-context";

type WireItem = { variantId: string; quantity: number };

// Normalize a wire list to a variantId→quantity map (drop junk, cap quantity).
// `sum` merges duplicates additively (used when merging a guest cart); otherwise
// the last quantity for a variantId wins (used for a straight replace).
function toMap(items: WireItem[] | undefined, sum: boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items ?? []) {
    const id = String(it?.variantId ?? "");
    const q = Math.floor(Number(it?.quantity));
    if (!id || !Number.isFinite(q) || q < 1) continue;
    const base = sum ? m.get(id) ?? 0 : 0;
    m.set(id, Math.min(base + q, MAX_QTY_PER_ITEM));
  }
  return m;
}

// Writes `wanted` as the customer's cart, keeping only variants that still exist
// and are active (so a stale client can never write a dangling/inactive line).
async function writeCart(customerId: string, wanted: Map<string, number>): Promise<void> {
  const ids = [...wanted.keys()];
  const valid = ids.length
    ? await prisma.variant.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } })
    : [];
  const validIds = new Set(valid.map((v) => v.id));

  const cart = await prisma.cart.upsert({
    where: { customerId },
    create: { customerId },
    update: {},
    select: { id: true },
  });

  const rows = [...wanted]
    .filter(([id]) => validIds.has(id))
    .map(([variantId, quantity]) => ({ cartId: cart.id, variantId, quantity }));

  // Replace the whole set — simple and correct for a small cart.
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    ...(rows.length ? [prisma.cartItem.createMany({ data: rows })] : []),
  ]);
}

// Write-through of the current client cart for the signed-in customer. No-op for
// guests (they persist to localStorage). Authorized via the session.
export async function persistCart(items: WireItem[]): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await writeCart(session.sub, toMap(items, false));
}

// One-time on login: merge the guest (localStorage) cart into the server cart
// (summing quantities), then return the hydrated, authoritative cart.
export async function syncGuestCart(guestItems: WireItem[]): Promise<CartItem[]> {
  const session = await getSession();
  if (!session) return [];

  const existing = await prisma.cart.findUnique({
    where: { customerId: session.sub },
    include: { items: { select: { variantId: true, quantity: true } } },
  });

  const merged = new Map<string, number>();
  for (const it of existing?.items ?? []) merged.set(it.variantId, it.quantity);
  for (const [id, q] of toMap(guestItems, true)) {
    merged.set(id, Math.min((merged.get(id) ?? 0) + q, MAX_QTY_PER_ITEM));
  }

  await writeCart(session.sub, merged);
  return loadServerCartItems(session.sub);
}