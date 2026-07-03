import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Public, published Q&A for a product (by slug). Store FAQ and answered customer
// questions share one list; only `published` rows ever surface here.
export type PublicQuestion = {
  id: string;
  question: string;
  answer: string | null;
  asker: string; // "Klenich" for store FAQ, else the asker's first name
  isFaq: boolean;
  answeredAt: Date | null;
};

export async function getProductQuestions(slug: string): Promise<{
  productId: string | null;
  questions: PublicQuestion[];
}> {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) return { productId: null, questions: [] };

  const rows = await prisma.productQuestion.findMany({
    where: { productId: product.id, published: true },
    // FAQ first (by curated order), then answered customer questions newest-first.
    orderBy: [{ isFaq: "desc" }, { sortOrder: "asc" }, { answeredAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      question: true,
      answer: true,
      isFaq: true,
      askedName: true,
      answeredAt: true,
    },
  });

  return {
    productId: product.id,
    questions: rows.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      isFaq: r.isFaq,
      answeredAt: r.answeredAt,
      // First name only for a little privacy; store FAQ is authored as the brand.
      asker: r.isFaq ? "Klenich" : r.askedName?.trim().split(/\s+/)[0] || "A customer",
    })),
  };
}

// Whether the signed-in customer may ask a question, plus how many of their own
// are still awaiting an answer (used to soft-limit spam in the ask action/UI).
export async function getAskEligibility(productId: string): Promise<{
  canAsk: boolean;
  pendingCount: number;
}> {
  const session = await getSession();
  if (!session) return { canAsk: false, pendingCount: 0 };

  const pendingCount = await prisma.productQuestion.count({
    where: { productId, customerId: session.sub, answer: null },
  });

  return { canAsk: pendingCount < MAX_PENDING_QUESTIONS_PER_PRODUCT, pendingCount };
}

// A signed-in shopper can have at most this many unanswered questions open on a
// single product before the form asks them to wait — light spam containment.
export const MAX_PENDING_QUESTIONS_PER_PRODUCT = 3;
