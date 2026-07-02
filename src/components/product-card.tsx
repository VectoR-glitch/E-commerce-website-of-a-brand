import Link from "next/link";
import Image from "next/image";
import { formatINR, priceFromPaise, type Product } from "@/lib/catalog";
import { Ornament } from "@/components/ornament";
import { CardMedia } from "@/components/card-media";

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