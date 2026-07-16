import "server-only";
import { prisma } from "@/lib/prisma";
import { getProductsBySlugs } from "@/lib/products";
import { MAX_QTY_PER_ITEM } from "@/lib/constants";
import type { CartItem } from "@/lib/cart-context";

// Builds the client CartItem[] for a signed-in customer's server cart. Display
// data (name, image, live price) is resolved through getProductsBySlugs — the
// same hydration the storefront uses — so prices are always current and an
// item whose product/variant went inactive silently drops out of the cart.
export async function loadServerCartItems(customerId: string): Promise<CartItem[]> {
  const cart = await prisma.cart.findUnique({
    where: { customerId },
    include: { items: { include: { variant: { include: { product: { select: { slug: true } } } } } } },
  });
  if (!cart || cart.items.length === 0) return [];

  // Hydrate every distinct product in ONE query — this runs on every page
  // load for a signed-in customer with items in cart, so a per-slug lookup
  // here was a real, sitewide N+1.
  const slugs = [...new Set(cart.items.map((i) => i.variant.product.slug))];
  const products = await getProductsBySlugs(slugs);

  const items: CartItem[] = [];
  for (const it of cart.items) {
    const v = it.variant;
    if (!v.active) continue;
    const product = products.get(v.product.slug);
    if (!product) continue; // product inactive/removed → drop the line

    const frag = v.fragrance ?? undefined;
    const image =
      (frag ? product.variantImages?.[`${frag}|${v.size}`] : undefined) ??
      (frag ? product.fragranceImages?.[frag] : undefined) ??
      product.image;

    items.push({
      variantId: v.id,
      sku: v.sku,
      productSlug: v.product.slug,
      name: product.name,
      fragrance: frag,
      size: v.size,
      image,
      pricePaise: v.pricePaise, // live price from the DB
      quantity: Math.min(it.quantity, MAX_QTY_PER_ITEM),
    });
  }
  return items;
}