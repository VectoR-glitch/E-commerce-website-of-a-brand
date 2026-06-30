"use client";

import { useMemo, useState } from "react";
import { FRAGRANCE_HEX, formatINR, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-context";

export function VariantSelector({ product }: { product: Product }) {
  const hasFragrance = product.fragrances.length > 0;
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const [fragrance, setFragrance] = useState<string | undefined>(
    hasFragrance ? product.fragrances[0] : undefined,
  );
  const [size, setSize] = useState<string>(product.sizes[0]);

  const selected = useMemo(
    () =>
      product.variants.find(
        (v) => v.size === size && (!hasFragrance || v.fragrance === fragrance),
      ),
    [product.variants, size, fragrance, hasFragrance],
  );

  const outOfStock =
    !!selected && typeof selected.stock === "number" && selected.stock <= 0;

  return (
    <div className="flex flex-col gap-8">
      {hasFragrance && (
        <div>
          <p className="smallcaps mb-3 text-ink/70">Fragrance</p>
          <div className="flex flex-wrap gap-3">
            {product.fragrances.map((f) => {
              const active = f === fragrance;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFragrance(f)}
                  className={`flex items-center gap-2 border px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-forest bg-forest text-bone"
                      : "border-line hover:border-ink"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/10"
                    style={{ background: FRAGRANCE_HEX[f] }}
                  />
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="smallcaps mb-3 text-ink/70">Size</p>
        <div className="flex flex-wrap gap-3">
          {product.sizes.map((s) => {
            const active = s === size;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`border px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-forest bg-forest text-bone"
                    : "border-line hover:border-ink"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-7">
        <span className="font-serif text-3xl">
          {selected ? formatINR(selected.pricePaise) : "—"}
        </span>
        <button
          type="button"
          disabled={!selected || outOfStock}
          onClick={() => {
            if (!selected || outOfStock || !selected.id) return;
            addItem({
              variantId: selected.id,
              sku: selected.sku,
              productSlug: product.slug,
              name: product.name,
              fragrance: selected.fragrance,
              size: selected.size,
              pricePaise: selected.pricePaise,
            });
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 1800);
          }}
          className="smallcaps bg-forest px-9 py-4 text-bone btn-fill-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          {outOfStock ? "Out of Stock" : justAdded ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
      {selected && (
        <p className="text-xs text-ink/40">SKU: {selected.sku}</p>
      )}
    </div>
  );
}