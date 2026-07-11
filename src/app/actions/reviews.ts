"use server";
// Customer-facing review submission. Server Actions are POST-reachable, so this
// re-checks auth AND the verified-purchase rule itself — the UI gate is not a
// security boundary. New/edited reviews always land unapproved (approved=false)
// and only show publicly once an admin approves them (see admin/actions.ts).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type ReviewState = { ok?: boolean; error?: string } | undefined;

// Has this customer bought the product? Only a DELIVERED order counts — a
// PENDING/ON_HOLD order hasn't reached them yet, and a RETURNED one was
// refunded, so neither is a legitimate "verified purchase". (variantId can be
// null once a variant is deleted, but the join simply won't match those —
// acceptable.)
async function hasPurchased(customerId: string, productId: string): Promise<boolean> {
  const item = await prisma.orderItem.findFirst({
    where: {
      variant: { productId },
      order: { customerId, status: "DELIVERED" },
    },
    select: { id: true },
  });
  return item !== null;
}

export async function submitReviewAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to write a review." };

  const productId = String(formData.get("productId") ?? "");
  const rating = Math.round(Number(formData.get("rating")));
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const slug = String(formData.get("slug") ?? "");

  if (!productId) return { error: "Missing product." };
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { error: "Please choose a rating from 1 to 5 stars." };
  }
  if (body.length < 10) return { error: "Please write at least a sentence (10+ characters)." };
  if (body.length > 2000) return { error: "Please keep your review under 2000 characters." };

  if (!(await hasPurchased(session.sub, productId))) {
    return { error: "Only customers who've bought this product can review it." };
  }

  // One review per customer/product. Editing an existing one sends it back to
  // the moderation queue (approved reset to false).
  await prisma.review.upsert({
    where: { productId_customerId: { productId, customerId: session.sub } },
    create: { productId, customerId: session.sub, rating, title, body, approved: false },
    update: { rating, title, body, approved: false },
  });

  if (slug) revalidatePath(`/product/${slug}`);
  revalidatePath("/admin/reviews");
  return { ok: true };
}
