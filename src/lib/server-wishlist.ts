import "server-only";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/products";
import type { WishlistItem } from "@/lib/wishlist-context";

// Builds the client WishlistItem[] for a signed-in customer's saved products.
// Mirrors loadServerCartItems: the display snapshot (name, image, "from" price)
// is resolved live through getProduct — the same hydration the storefront uses —
// so a saved product whose price/image changed (or that went inactive) always
// reflects today's catalog. Rows are stored keyed on slug+fragrance; the empty
// string sentinel (never null) round-trips back to `undefined` for the client.
export async function loadServerWishlistItems(customerId: string): Promise<WishlistItem[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return [];

  // Hydrate each distinct product once (reuses image/price logic).
  const slugs = [...new Set(rows.map((r) => r.productSlug))];
  const products = new Map(await Promise.all(slugs.map(async (s) => [s, await getProduct(s)] as const)));

  const items: WishlistItem[] = [];
  for (const r of rows) {
    const product = products.get(r.productSlug);
    if (!product) continue; // product removed/inactive → drop the saved line
    const fragrance = r.fragrance || undefined;

    // "From" price, scoped to the saved fragrance when there is one.
    const relevant = fragrance
      ? product.variants.filter((v) => v.fragrance === fragrance)
      : product.variants;
    const prices = (relevant.length ? relevant : product.variants).map((v) => v.pricePaise);
    const fromPaise = prices.length ? Math.min(...prices) : 0;

    const image =
      (fragrance ? product.fragranceImages?.[fragrance] : undefined) ?? product.image;

    items.push({ slug: r.productSlug, fragrance, name: product.name, image, fromPaise });
  }
  return items;
}
