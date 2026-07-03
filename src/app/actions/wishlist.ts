"use server";
// Server-side wishlist persistence for signed-in customers (cross-device).
// Mirrors the cart actions: guests keep their wishlist in localStorage; on login
// it merges into these rows, which then become authoritative. Server Actions are
// POST-reachable, so each authorizes via the session itself.
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loadServerWishlistItems } from "@/lib/server-wishlist";
import type { WishlistItem } from "@/lib/wishlist-context";

// The minimal wire shape the client sends — identity only. Display fields
// (name/image/price) are re-hydrated server-side, never trusted from the client.
type WireItem = { slug: string; fragrance?: string };

// Normalize a wire list to unique {slug, fragrance} rows. `fragrance` is stored
// as "" (never null) so the composite unique key dedupes fragrance-less products.
function toRows(items: WireItem[] | undefined): { productSlug: string; fragrance: string }[] {
  const seen = new Map<string, { productSlug: string; fragrance: string }>();
  for (const it of items ?? []) {
    const productSlug = String(it?.slug ?? "").trim();
    if (!productSlug) continue;
    const fragrance = String(it?.fragrance ?? "").trim();
    seen.set(`${productSlug}|${fragrance}`, { productSlug, fragrance });
  }
  return [...seen.values()];
}

// Replace the customer's saved set with exactly `wanted`. Simple and correct for
// a small wishlist (same approach as writeCart).
async function writeWishlist(customerId: string, wanted: WireItem[]): Promise<void> {
  const rows = toRows(wanted).map((r) => ({ ...r, customerId }));
  await prisma.$transaction([
    prisma.wishlistItem.deleteMany({ where: { customerId } }),
    ...(rows.length ? [prisma.wishlistItem.createMany({ data: rows })] : []),
  ]);
}

// Write-through of the current client wishlist for the signed-in customer.
// No-op for guests (they persist to localStorage).
export async function persistWishlist(items: WireItem[]): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await writeWishlist(session.sub, items);
}

// One-time on login: merge the guest (localStorage) wishlist into the saved set
// (union — a wishlist has no quantities, so a saved item either exists or not),
// then return the hydrated, authoritative list.
export async function syncGuestWishlist(guestItems: WireItem[]): Promise<WishlistItem[]> {
  const session = await getSession();
  if (!session) return [];

  const existing = await prisma.wishlistItem.findMany({
    where: { customerId: session.sub },
    select: { productSlug: true, fragrance: true },
  });

  const union = new Map<string, WireItem>();
  for (const r of existing) union.set(`${r.productSlug}|${r.fragrance}`, { slug: r.productSlug, fragrance: r.fragrance });
  for (const r of toRows(guestItems)) union.set(`${r.productSlug}|${r.fragrance}`, { slug: r.productSlug, fragrance: r.fragrance });

  await writeWishlist(session.sub, [...union.values()]);
  return loadServerWishlistItems(session.sub);
}
