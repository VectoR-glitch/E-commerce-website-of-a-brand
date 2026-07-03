import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct } from "@/lib/products";
import { ProductDetail } from "@/components/product-detail";
import { RecentlyViewed } from "@/components/recently-viewed";
import { RecentlyViewedTracker } from "@/components/recently-viewed-tracker";
import { SITE_URL } from "@/lib/constants";
import { jsonLdHtml } from "@/lib/json-ld";
import { priceFromPaise, type Product } from "@/lib/catalog";
import { getProductReviews, getReviewEligibility, type ReviewSummary } from "@/lib/reviews";
import { getSession } from "@/lib/session";
import { Stars } from "@/components/stars";
import { ReviewForm } from "@/components/review-form";

export const dynamic = "force-dynamic";

// Product structured data for Google rich results. aggregateRating is included
// only once real, admin-approved (verified-buyer) reviews exist — accurate and
// compliant.
function productJsonLd(product: Product, summary: ReviewSummary) {
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
    ...(summary.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: summary.average.toFixed(1),
        reviewCount: summary.count,
      },
    }),
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

  const { productId, reviews, summary } = await getProductReviews(slug);
  const [{ canReview, existing }, session] = await Promise.all([
    productId ? getReviewEligibility(productId) : Promise.resolve({ canReview: false, existing: null }),
    getSession(),
  ]);

  return (
    <section className="mx-auto max-w-6xl px-8 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productJsonLd(product, summary)) }}
      />
      <Link href="/shop" className="smallcaps text-ink/70 hover:text-forest">
        ← Back to shop
      </Link>

      <RecentlyViewedTracker
        item={{
          slug: product.slug,
          name: product.name,
          image: product.image,
          fromPaise: priceFromPaise(product),
        }}
      />

      <ProductDetail
        product={product}
        initialFragrance={typeof fragrance === "string" ? fragrance : undefined}
      />

      {/* Reviews */}
      <div className="mt-20 border-t border-line pt-12">
        <span className="smallcaps text-brass-deep">Reviews</span>
        {summary.count > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-3xl">{summary.average.toFixed(1)} out of 5</h2>
            <Stars value={summary.average} size={20} />
            <span className="text-sm text-ink/60">
              {summary.count} verified {summary.count === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : (
          <h2 className="mt-2 font-serif text-3xl">No reviews yet</h2>
        )}

        {productId && canReview ? (
          <ReviewForm productId={productId} slug={slug} existing={existing} />
        ) : (
          <p className="mt-4 text-sm text-ink/55">
            {session ? (
              "Only customers who’ve purchased this product can review it."
            ) : (
              <>
                Bought this?{" "}
                <Link href={`/login?next=/product/${slug}`} className="text-forest underline">
                  Sign in
                </Link>{" "}
                to leave a review — reviews are open to verified buyers.
              </>
            )}
          </p>
        )}

        {reviews.length > 0 && (
          <ul className="mt-10 space-y-8">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-line pb-6 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars value={r.rating} size={14} />
                  <span className="text-sm font-medium text-ink">{r.author}</span>
                  <span className="smallcaps text-xs text-forest">✓ Verified</span>
                </div>
                {r.title && <p className="mt-2 font-serif text-lg">{r.title}</p>}
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink/75">
                  {r.body}
                </p>
                <p className="mt-2 text-xs text-ink/45">
                  {r.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecentlyViewed excludeSlug={product.slug} />
    </section>
  );
}