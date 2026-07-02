import "server-only";
import { prisma } from "@/lib/prisma";

// Each bundle mirrors a coupon so the whole discount pipeline (checkout,
// settlement, receipts) is reused. The code is derived from the slug and is
// what "Add kit to cart" auto-applies at checkout.
export function bundleCouponCode(slug: string): string {
  return `KIT-${slug.toUpperCase()}`;
}

export type BundleLineItem = {
  variantId: string;
  sku: string;
  productSlug: string;
  productName: string;
  fragrance?: string;
  size: string;
  label: string; // "Fragrance · Size" for display
  pricePaise: number;
  quantity: number;
};

export type BundleView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  couponCode: string;
  items: BundleLineItem[];
  regularPaise: number;
  discountPaise: number;
  kitPaise: number;
};

function discountFor(
  type: "PERCENT" | "FIXED",
  value: number,
  regularPaise: number,
): number {
  const raw = type === "PERCENT" ? Math.round(regularPaise * (value / 100)) : value;
  return Math.min(raw, regularPaise);
}

// Active bundles for the storefront, with pricing computed from live variant
// prices. A bundle is dropped if it has no active-variant items.
export async function getActiveBundles(): Promise<BundleView[]> {
  const bundles = await prisma.bundle.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  return bundles
    .map((b): BundleView | null => {
      const live = b.items.filter((it) => it.variant.active);
      if (live.length === 0) return null;
      const items: BundleLineItem[] = live.map((it) => ({
        variantId: it.variantId,
        sku: it.variant.sku,
        productSlug: it.variant.product.slug,
        productName: it.variant.product.name,
        fragrance: it.variant.fragrance ?? undefined,
        size: it.variant.size,
        label:
          [it.variant.fragrance, it.variant.size].filter(Boolean).join(" · ") ||
          it.variant.size,
        pricePaise: it.variant.pricePaise,
        quantity: it.quantity,
      }));
      const regularPaise = items.reduce((s, it) => s + it.pricePaise * it.quantity, 0);
      const discountPaise = discountFor(b.discountType, b.discountValue, regularPaise);
      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        couponCode: bundleCouponCode(b.slug),
        items,
        regularPaise,
        discountPaise,
        kitPaise: regularPaise - discountPaise,
      };
    })
    .filter((b): b is BundleView => b !== null);
}
