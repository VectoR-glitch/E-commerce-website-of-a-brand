import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct } from "@/lib/products";
import { ProductDetail } from "@/components/product-detail";
import { SITE_URL } from "@/lib/constants";
import type { Product } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// Product structured data for Google rich results. Price + availability only —
// deliberately no aggregateRating until we have verified reviews (compliance).
function productJsonLd(product: Product) {
  const prices = product.variants.map((v) => v.pricePaise);
  const lowPaise = Math.min(...prices);
  const highPaise = Math.max(...prices);
  // A variant is in stock when stock is unknown (static catalog) or positive.
  const inStock = product.variants.some(
    (v) => typeof v.stock !== "number" || v.stock > 0,
  );
  const image = product.image.startsWith("http")
    ? product.image
    : `${SITE_URL}${product.image}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.tagline,
    image,
    brand: { "@type": "Brand", name: "Klenich" },
    url: `${SITE_URL}/product/${product.slug}`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (lowPaise / 100).toFixed(2),
      highPrice: (highPaise / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}

export async function generateMetadata(
  props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.tagline,
    alternates: { canonical: `/product/${slug}` },
  };
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const { fragrance } = await props.searchParams;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <section className="mx-auto max-w-6xl px-8 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product)) }}
      />
      <Link href="/shop" className="smallcaps text-ink/70 hover:text-forest">
        ← Back to shop
      </Link>

      <ProductDetail
        product={product}
        initialFragrance={typeof fragrance === "string" ? fragrance : undefined}
      />
    </section>
  );
}