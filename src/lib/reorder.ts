import "server-only";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/products";
import { MAX_QTY_PER_ITEM } from "@/lib/constants";
import type { CartItem } from "@/lib/cart-context";

// Resolves a past order's line items to CURRENT, buyable cart lines — live
// price/image from the DB, dropping any variant (or whole product) that's gone
// inactive since. Used by the "Reorder" button so re-adding always reflects
// today's catalog, never a stale snapshot. Mirrors loadServerCartItems.
type OrderItemRow = {
  variantId: string | null;
  productName: string;
  fragrance: string | null;
  size: string;
  quantity: number;
};

export type ReorderResult = {
  items: CartItem[];
  unavailable: string[]; // human labels of lines no longer buyable
};

const label = (r: OrderItemRow) =>
  `${r.productName}${[r.fragrance, r.size].filter(Boolean).length ? ` (${[r.fragrance, r.size].filter(Boolean).join(" · ")})` : ""}`;

export async function buildReorderItems(rows: OrderItemRow[]): Promise<ReorderResult> {
  const ids = rows.map((r) => r.variantId).filter((id): id is string => Boolean(id));
  const variants = ids.length
    ? await prisma.variant.findMany({
        where: { id: { in: ids }, active: true },
        include: { product: { select: { slug: true, active: true } } },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  // Hydrate each distinct product once (reuses image/price logic).
  const slugs = [...new Set(variants.filter((v) => v.product.active).map((v) => v.product.slug))];
  const products = new Map(await Promise.all(slugs.map(async (s) => [s, await getProduct(s)] as const)));

  const items: CartItem[] = [];
  const unavailable: string[] = [];

  for (const r of rows) {
    const v = r.variantId ? byId.get(r.variantId) : undefined;
    const product = v && v.product.active ? products.get(v.product.slug) : undefined;
    if (!v || !product) {
      unavailable.push(label(r));
      continue;
    }
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
      pricePaise: v.pricePaise, // live price
      quantity: Math.min(r.quantity, MAX_QTY_PER_ITEM),
    });
  }

  return { items, unavailable };
}
