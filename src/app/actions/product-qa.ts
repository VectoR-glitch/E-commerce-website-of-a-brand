"use server";
// Customer-facing question submission. Server Actions are POST-reachable, so this
// re-checks auth itself — the UI gate is not a security boundary. No verified-
// purchase rule (unlike reviews): questions are usually asked BEFORE buying.
// New questions always land unpublished and only show once an admin answers +
// publishes them (see admin/actions.ts answerQuestion).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MAX_PENDING_QUESTIONS_PER_PRODUCT } from "@/lib/product-qa";

export type QuestionState = { ok?: boolean; error?: string } | undefined;

export async function askQuestionAction(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to ask a question." };

  const productId = String(formData.get("productId") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const slug = String(formData.get("slug") ?? "");

  if (!productId) return { error: "Missing product." };
  if (question.length < 10) return { error: "Please write a full question (10+ characters)." };
  if (question.length > 500) return { error: "Please keep your question under 500 characters." };

  // Soft anti-spam: cap how many unanswered questions one customer can stack up
  // on a single product.
  const pending = await prisma.productQuestion.count({
    where: { productId, customerId: session.sub, answer: null },
  });
  if (pending >= MAX_PENDING_QUESTIONS_PER_PRODUCT) {
    return { error: "You already have questions awaiting a reply on this product. Please hold on for those first." };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });

  await prisma.productQuestion.create({
    data: {
      productId,
      customerId: session.sub,
      askedName: customer?.name?.trim() || null,
      question,
      published: false,
      isFaq: false,
    },
  });

  if (slug) revalidatePath(`/product/${slug}`);
  revalidatePath("/admin/questions");
  return { ok: true };
}
