import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { Ornament } from "@/components/ornament";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "The full Klenich collection — plant-powered dishwash, floor, and toilet care, made in India.",
};

export default async function ShopPage() {
  const products = await getProducts();

  // Surface each fragrance of a multi-fragrance product as its own card.
  const cards = products.flatMap((product) =>
    product.fragrances.length > 1
      ? product.fragrances.map((fragrance) => ({ product, fragrance }))
      : [{ product, fragrance: undefined as string | undefined }],
  );

  return (
    <section className="mx-auto max-w-6xl px-8 py-24">
      <Reveal className="mb-16 text-center">
        <span className="smallcaps text-brass-deep">The Collection</span>
        <h1 className="mt-4 font-serif text-5xl">Shop Klenich</h1>
        <p className="mx-auto mt-4 max-w-md text-ink/70">
          Plant-powered essentials, done right. More on the way.
        </p>
        <Ornament className="mt-6" />
      </Reveal>
      <Reveal delay={120}>
        <div className="grid gap-px border border-line bg-line md:grid-cols-3">
          {cards.map((c, i) => (
            <ProductCard
              key={`${c.product.slug}-${c.fragrance ?? "default"}`}
              product={c.product}
              fragrance={c.fragrance}
              index={i}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}