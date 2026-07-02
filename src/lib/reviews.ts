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

export async function getProductReviews(slug: string): Promise<{
  productId: string | null;
  reviews: PublicReview[];
  summary: ReviewSummary;
}> {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) return { productId: null, reviews: [], summary: { count: 0, average: 0 } };

  const rows = await prisma.review.findMany({
    where: { productId: product.id, approved: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
  });

  const count = rows.length;
  const average = count ? rows.reduce((s, r) => s + r.rating, 0) / count : 0;
  return {
    productId: product.id,
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      // First name only, for a little privacy; fall back to a neutral label.
      author: r.customer.name?.trim().split(/\s+/)[0] || "Verified buyer",
      createdAt: r.createdAt,
    })),
    summary: { count, average },
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
        order: { customerId: session.sub, status: { not: "CANCELLED" } },
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
