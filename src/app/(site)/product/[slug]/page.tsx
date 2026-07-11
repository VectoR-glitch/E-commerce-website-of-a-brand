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
import { getProductQuestions, getAskEligibility } from "@/lib/product-qa";
import { getSession } from "@/lib/session";
import { Stars } from "@/components/stars";
import { ReviewForm } from "@/components/review-form";
import { AskQuestionForm } from "@/components/ask-question-form";
import { Kicker } from "@/components/kicker";

export const dynamic = "force-dynamic";

// Product structured data for Google rich results. aggregateRating is included
// only once real, admin-approved (verified-buyer) reviews exist — accurate and
// compliant.
function productJsonLd(product: Product, summary: ReviewSummary) {
  const prices = product.variants.map((v) => v.pricePaise);
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
    // Omitted entirely (not emitted with degenerate values) when every
    // variant has been deactivated — Math.min/max of an empty array is
    // ±Infinity, which schema.org validators reject as invalid pricing.
    ...(prices.length > 0 && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "INR",
        lowPrice: (Math.min(...prices) / 100).toFixed(2),
        highPrice: (Math.max(...prices) / 100).toFixed(2),
        offerCount: product.variants.length,
        availability: inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    }),
    ...(summary.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: summary.average.toFixed(1),
        reviewCount: summary.count,
      },
    }),
  };
}

// Lets Google show "Shop › {product}" breadcrumbs directly in the search
// result instead of the raw URL. The current page is the last entry and
// intentionally has no `item` URL, matching Google's own reference example.
function breadcrumbJsonLd(product: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
      { "@type": "ListItem", position: 3, name: product.name },
    ],
  };
}

export async function generateMetadata(
  props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) return { title: "Not found" };
  const imageUrl = product.image
    ? product.image.startsWith("http")
      ? product.image
      : `${SITE_URL}${product.image}`
    : undefined;
  return {
    title: product.name,
    description: product.tagline,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title: product.name,
      description: product.tagline,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const { fragrance } = await props.searchParams;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [{ productId, reviews, summary }, { questions }] = await Promise.all([
    getProductReviews(slug),
    getProductQuestions(slug),
  ]);
  const [{ canReview, existing }, { canAsk }, session] = await Promise.all([
    productId ? getReviewEligibility(productId) : Promise.resolve({ canReview: false, existing: null }),
    productId ? getAskEligibility(productId) : Promise.resolve({ canAsk: false, pendingCount: 0 }),
    getSession(),
  ]);

  return (
    <section className="mx-auto max-w-6xl px-8 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productJsonLd(product, summary)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(product)) }}
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
        defaultEmail={session?.email ?? ""}
      />

      {/* Reviews */}
      <div className="mt-20 border-t border-line pt-12">
        <Kicker>Reviews</Kicker>
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

      {/* Questions & Answers */}
      <div className="mt-20 border-t border-line pt-12">
        <Kicker>Questions &amp; Answers</Kicker>
        <h2 className="mt-2 font-serif text-3xl">
          {questions.length > 0 ? "Your questions, answered" : "Have a question?"}
        </h2>

        {productId && canAsk ? (
          <AskQuestionForm productId={productId} slug={slug} />
        ) : (
          <p className="mt-4 text-sm text-ink/55">
            {session ? (
              "Thanks — you already have a question awaiting our reply on this product."
            ) : (
              <>
                <Link href={`/login?next=/product/${slug}`} className="text-forest underline">
                  Sign in
                </Link>{" "}
                to ask a question — we answer publicly so it helps everyone.
              </>
            )}
          </p>
        )}

        {questions.length > 0 && (
          <ul className="mt-10 space-y-8">
            {questions.map((q) => (
              <li key={q.id} className="border-b border-line pb-6 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="smallcaps text-xs text-brass-deep">Q</span>
                  <span className="text-sm font-medium text-ink">{q.question}</span>
                </div>
                {q.answer && (
                  <div className="mt-2 flex gap-3">
                    <span className="smallcaps text-xs text-forest">A</span>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink/75">
                      {q.answer}
                    </p>
                  </div>
                )}
                <p className="mt-2 text-xs text-ink/45">
                  {q.isFaq ? "Klenich" : `Asked by ${q.asker}`}
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