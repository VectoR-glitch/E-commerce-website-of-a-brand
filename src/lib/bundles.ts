import "server-only";
import { prisma } from "@/lib/prisma";

// Each bundle mirrors a coupon so the whole discount pipeline (checkout,
// settlement, receipts) is reused. The code is derived from the slug and is
// applied when the kit is added. It's gated on the kit's items being in the
// cart (see coupons.ts) so the publicly visible code can't be abused off-kit.
export function bundleCouponCode(slug: string): string {
  return `KIT-${slug.toUpperCase()}`;
}

// A concrete, purchasable option the customer can pick for a product slot.
export type SlotOption = {
  variantId: string;
  sku: string;
  fragrance?: string;
  size: string;
  label: string; // "Fragrance · Size" (or just size)
  pricePaise: number;
};

// An exact-variant slot: fixed, no choice.
export type ExactSlot = {
  kind: "exact";
  id: string;
  productSlug: string;
  productName: string;
  quantity: number;
  option: SlotOption; // the single fixed variant
};

// A flexible product slot: any variant of the product, optionally locked to a
// size — the customer picks one option.
export type ProductSlot = {
  kind: "product";
  id: string;
  productSlug: string;
  productName: string;
  size: string | null; // locked size, or null = any size
  quantity: number;
  options: SlotOption[];
  fromPaise: number; // cheapest option (for "from" display)
};

export type BundleSlot = ExactSlot | ProductSlot;

export type BundleView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  couponCode: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number; // percent, or paise
  slots: BundleSlot[];
  // Lowest possible kit pricing (every product slot at its cheapest option),
  // for the card; the client recomputes live as the customer chooses.
  regularFromPaise: number;
  discountFromPaise: number;
  kitFromPaise: number;
  variablePricing: boolean; // any product slot whose options differ in price
};

function optionOf(v: {
  id: string;
  sku: string;
  fragrance: string | null;
  size: string;
  pricePaise: number;
}): SlotOption {
  return {
    variantId: v.id,
    sku: v.sku,
    fragrance: v.fragrance ?? undefined,
    size: v.size,
    label: [v.fragrance, v.size].filter(Boolean).join(" · ") || v.size,
    pricePaise: v.pricePaise,
  };
}

function discountFor(type: "PERCENT" | "FIXED", value: number, subtotalPaise: number): number {
  const raw = type === "PERCENT" ? Math.round(subtotalPaise * (value / 100)) : value;
  return Math.min(raw, subtotalPaise);
}

export async function getActiveBundles(): Promise<BundleView[]> {
  const bundles = await prisma.bundle.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
          product: { include: { variants: true } },
        },
      },
    },
  });

  return bundles
    .map((b): BundleView | null => {
      const slots: BundleSlot[] = [];
      let variablePricing = false;

      for (const it of b.items) {
        if (it.variantId && it.variant) {
          // Exact slot — skip if the variant went inactive.
          if (!it.variant.active) continue;
          slots.push({
            kind: "exact",
            id: it.id,
            productSlug: it.variant.product.slug,
            productName: it.variant.product.name,
            quantity: it.quantity,
            option: optionOf(it.variant),
          });
        } else if (it.productId && it.product) {
          // Product slot — offer the product's active variants (matching the
          // size lock, if any). Skip the slot if nothing qualifies.
          const options = it.product.variants
            .filter((v) => v.active && (!it.size || v.size === it.size))
            .map(optionOf);
          if (options.length === 0) continue;
          const prices = options.map((o) => o.pricePaise);
          if (new Set(prices).size > 1) variablePricing = true;
          slots.push({
            kind: "product",
            id: it.id,
            productSlug: it.product.slug,
            productName: it.product.name,
            size: it.size,
            quantity: it.quantity,
            options,
            fromPaise: Math.min(...prices),
          });
        }
      }

      if (slots.length === 0) return null;

      const regularFromPaise = slots.reduce((sum, s) => {
        const unit = s.kind === "exact" ? s.option.pricePaise : s.fromPaise;
        return sum + unit * s.quantity;
      }, 0);
      const discountType = b.discountType;
      const discountFromPaise = discountFor(discountType, b.discountValue, regularFromPaise);

      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        couponCode: bundleCouponCode(b.slug),
        discountType,
        discountValue: b.discountValue,
        slots,
        regularFromPaise,
        discountFromPaise,
        kitFromPaise: regularFromPaise - discountFromPaise,
        variablePricing,
      };
    })
    .filter((b): b is BundleView => b !== null);
}
