import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Public, approved reviews + the aggregate rating for a product (by slug).
export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  createdAt: Date;
};
export type ReviewSummary = { count: number; average: number };

const REVIEWS_PAGE_SIZE = 20;

// One review per delivered order, so this grows with order volume, not
// catalog size — a popular product's public page must not fetch every
// approved review's full text on every visit. The summary (count + average
// star rating) is computed via aggregate over ALL approved reviews so it
// stays accurate regardless of which page is displayed; only the rendered
// LIST is paginated.
export async function getProductReviews(
  slug: string,
  page = 1,
): Promise<{
  productId: string | null;
  reviews: PublicReview[];
  summary: ReviewSummary;
  hasNext: boolean;
}> {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) return { productId: null, reviews: [], summary: { count: 0, average: 0 }, hasNext: false };

  const where = { productId: product.id, approved: true };
  const [agg, rows] = await Promise.all([
    prisma.review.aggregate({ where, _count: true, _avg: { rating: true } }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE + 1,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const hasNext = rows.length > REVIEWS_PAGE_SIZE;
  return {
    productId: product.id,
    reviews: rows.slice(0, REVIEWS_PAGE_SIZE).map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      // First name only, for a little privacy; fall back to a neutral label.
      author: r.customer.name?.trim().split(/\s+/)[0] || "Verified buyer",
      createdAt: r.createdAt,
    })),
    summary: { count: agg._count, average: agg._avg.rating ?? 0 },
    hasNext,
  };
}

// For the signed-in customer: may they review this product (bought it, not
// cancelled), and their existing review if any (to prefill / show status).
export async function getReviewEligibility(productId: string): Promise<{
  canReview: boolean;
  existing: { rating: number; title: string | null; body: string; approved: boolean } | null;
}> {
  const session = await getSession();
  if (!session) return { canReview: false, existing: null };

  const [purchased, existing] = await Promise.all([
    prisma.orderItem.findFirst({
      where: {
        variant: { productId },
        // DELIVERED only — a PENDING/ON_HOLD order hasn't actually reached the
        // customer yet, and a RETURNED one was refunded, so neither should
        // count as a "verified purchase."
        order: { customerId: session.sub, status: "DELIVERED" },
      },
      select: { id: true },
    }),
    prisma.review.findUnique({
      where: { productId_customerId: { productId, customerId: session.sub } },
      select: { rating: true, title: true, body: true, approved: true },
    }),
  ]);

  return { canReview: purchased !== null, existing };
}
