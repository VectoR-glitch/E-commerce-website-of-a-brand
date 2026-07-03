import Link from "next/link";
import Image from "next/image";
import { formatINR, priceFromPaise, type Product } from "@/lib/catalog";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { Ornament } from "@/components/ornament";
import { CardMedia } from "@/components/card-media";
import { WishlistButton } from "@/components/wishlist-button";

export function ProductCard({
  product,
  index,
  fragrance,
}: {
  product: Product;
  index: number;
  fragrance?: string;
}) {
  const from = priceFromPaise(product);
  const multipleVariants = product.variants.length > 1;
  const href = fragrance
    ? `/product/${product.slug}?fragrance=${encodeURIComponent(fragrance)}`
    : `/product/${product.slug}`;
  const image =
    (fragrance && product.fragranceImages?.[fragrance]) || product.image;
  const subtitle = fragrance ?? product.tagline;

  // Stock urgency cue — only from real DB numbers (never the static fallback,
  // where stock is undefined), so it stays truthful. Scope to the shown
  // fragrance when the card represents one. "Sold out" when every relevant
  // variant is empty; "Only N left" when the combined stock is running low.
  const relevant = fragrance
    ? product.variants.filter((v) => v.fragrance === fragrance)
    : product.variants;
  const stocks = relevant
    .map((v) => v.stock)
    .filter((s): s is number => typeof s === "number");
  const stockKnown = stocks.length > 0 && stocks.length === relevant.length;
  const totalStock = stocks.reduce((sum, s) => sum + s, 0);
  const soldOut = stockKnown && totalStock <= 0;
  const lowStock = stockKnown && !soldOut && totalStock <= LOW_STOCK_THRESHOLD;

  // For a full-product listing, build a labelled slide for every variant
  // (fragrance × size) so each card shows its variant + size — and cycles
  // through them. A single-fragrance (shop) card stays on its one image.
  const variantSlides: { src: string; label: string }[] = [];
  if (!fragrance) {
    for (const v of product.variants) {
      const key = `${v.fragrance ?? ""}|${v.size}`;
      const src =
        product.variantImages?.[key] ||
        (v.fragrance ? product.fragranceImages?.[v.fragrance] : undefined) ||
        product.image;
      if (!src) continue;
      variantSlides.push({
        src,
        label: [v.fragrance, v.size].filter(Boolean).join(" · "),
      });
    }
  }

  return (
    <Link
      href={href}
      className="group flex flex-col bg-paper transition-colors hover:bg-white"
    >
      <div className="relative h-80 overflow-hidden border-b border-line">
        <WishlistButton
          item={{ slug: product.slug, fragrance, name: product.name, image, fromPaise: from }}
        />
        {(soldOut || lowStock) && (
          <span
            className={`smallcaps absolute left-3 top-3 z-10 border px-2.5 py-1 text-xs backdrop-blur ${
              soldOut
                ? "border-line bg-bone/85 text-ink/55"
                : "border-brass/40 bg-bone/85 text-brass-deep"
            }`}
          >
            {soldOut ? "Sold out" : `Only ${totalStock} left`}
          </span>
        )}
        {variantSlides.length >= 1 ? (
          <CardMedia slides={variantSlides} name={product.name} />
        ) : image ? (
          <Image
            src={image}
            alt={fragrance ? `${product.name} — ${fragrance}` : product.name}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // No image uploaded yet (e.g. a newly-added DB product) — show the
          // emoji placeholder instead of an empty <Image src="">.
          <div className="flex h-full items-center justify-center bg-bone text-7xl">
            <span aria-hidden>{product.placeholder}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center px-8 py-11 text-center">
        <span className="smallcaps text-brass-deep">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="mt-2.5 font-serif text-2xl">{product.name}</h3>
        <p className="mt-1.5 text-sm text-ink/70">{subtitle}</p>
        <Ornament className="mt-4" />
        <span className="mt-4 font-serif text-xl">
          {multipleVariants ? `from ${formatINR(from)}` : formatINR(from)}
        </span>
        <span className="smallcaps btn-fill mt-5 border border-ink px-7 py-3">
          {multipleVariants ? "Choose" : "View"}
        </span>
      </div>
    </Link>
  );
}