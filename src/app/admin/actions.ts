"use server";
// Admin mutations. Server Actions are reachable by direct POST, so EVERY one
// re-checks requireAdmin() — the UI gate alone is not a security boundary.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus, PaymentStatus, DiscountType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendOrderStatusEmail, type OrderForEmail } from "@/lib/email";
import { sendOrderStatusWhatsApp } from "@/lib/whatsapp";
import { awardLoyaltyForDeliveredOrder, reverseLoyaltyForOrder } from "@/lib/loyalty";
import { bundleCouponCode } from "@/lib/bundles";
import { sendDueSubscriptionReminders, subscriptionCouponCode } from "@/lib/subscriptions";
import { notifyBackInStockForVariant } from "@/lib/back-in-stock";
import { isSystemCouponCode } from "@/lib/coupons";

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);

// Image upload constraints — stored directly in Postgres, so keep them small.
const ALLOWED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Statuses where stock has been committed (decremented at settlement). Moving
// from one of these INTO a cancelled/returned state returns the units.
const STOCK_COMMITTED: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

export async function updateOrderStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!id || !ORDER_STATUSES.includes(status)) return;

  // Read the current order OUTSIDE any transaction — keeping the read out of the
  // transaction means we only ever open one for the writes, which pooled Postgres
  // connections (Neon/pgBouncer) handle far more reliably than a long-lived
  // interactive transaction (the cause of "Unable to start a transaction in time").
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  // `changed` holds the pre-update snapshot only on a real transition, so we email
  // the customer just once when the status actually moves.
  const changed = !order || order.status === status ? null : order;

  if (changed) {
    // Restock when leaving a stock-committed status for CANCELLED/RETURNED, so
    // inventory reflects the freed units. (Re-confirming a cancelled order does
    // NOT auto-decrement again — the admin should verify stock in that case.)
    const wasCommitted = STOCK_COMMITTED.includes(changed.status);
    const nowFreed = status === "CANCELLED" || status === "RETURNED";

    // One short-lived interactive transaction: restock (if any), the guarded
    // status write, and — only on a real transition INTO DELIVERED, or back
    // OUT of a stock-committed status into CANCELLED/RETURNED — the matching
    // loyalty credit/reversal, all commit together atomically. The status
    // write is guarded on the value we read, so a concurrent admin transition
    // can't re-write it — matches 0 rows instead, and we skip the loyalty side
    // effect for a claim we lost.
    await prisma.$transaction(async (tx) => {
      if (wasCommitted && nowFreed) {
        for (const it of changed.items.filter((it) => it.variantId)) {
          await tx.variant.update({
            where: { id: it.variantId! },
            data: { stock: { increment: it.quantity } },
          });
        }
      }

      const claimed = await tx.order.updateMany({
        where: { id, status: changed.status },
        data: { status },
      });
      if (claimed.count === 0) return;

      // Loyalty points are granted only once an order is actually DELIVERED —
      // not at payment settlement — so a returned/cancelled order never earns
      // points it shouldn't have.
      if (status === "DELIVERED") {
        await awardLoyaltyForDeliveredOrder(tx, {
          id: changed.id,
          customerId: changed.customerId,
          subtotalPaise: changed.subtotalPaise,
          discountPaise: changed.discountPaise,
        });
      }

      // Mirror image of the above: a DELIVERED (or otherwise stock-committed)
      // order that's cancelled/returned gives back whatever points it earned —
      // same condition as the restock above, so inventory and loyalty always
      // move together. A no-op if this order never actually earned loyalty.
      if (wasCommitted && nowFreed) {
        await reverseLoyaltyForOrder(tx, changed.id);
      }
    });
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  // Notify the customer of the new status. Best-effort: never let a
  // notification failure surface as a failed status update (the change is
  // already committed).
  if (changed) {
    try {
      await sendOrderStatusEmail(toOrderForEmail(changed), status);
    } catch (err) {
      console.error(`status email failed for order ${id}:`, err);
    }
    try {
      await sendOrderStatusWhatsApp(changed.phone, changed.orderNumber, status);
    } catch (err) {
      console.error(`status WhatsApp failed for order ${id}:`, err);
    }
  }
}

// Maps an order row (with items) to the shape the email templates expect.
type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
function toOrderForEmail(order: OrderWithItems): OrderForEmail {
  return {
    orderNumber: order.orderNumber,
    email: order.email,
    shipName: order.shipName,
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPincode: order.shipPincode,
    subtotalPaise: order.subtotalPaise,
    shippingPaise: order.shippingPaise,
    discountPaise: order.discountPaise,
    couponCode: order.couponCode,
    totalPaise: order.totalPaise,
    amountPaidPaise: order.amountPaidPaise,
    paymentMethod: order.paymentMethod,
    items: order.items.map((it) => ({
      productName: it.productName,
      fragrance: it.fragrance,
      size: it.size,
      quantity: it.quantity,
      linePaise: it.linePaise,
    })),
  };
}

export async function updatePaymentStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "") as PaymentStatus;
  if (!id || !PAYMENT_STATUSES.includes(paymentStatus)) return;

  await prisma.order.update({ where: { id }, data: { paymentStatus } });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}

export async function updateStock(formData: FormData): Promise<void> {
  await requireAdmin();
  const variantId = String(formData.get("variantId") ?? "");
  const raw = Number(formData.get("stock"));
  if (!variantId || !Number.isFinite(raw) || raw < 0) return;
  const stock = Math.floor(raw);

  await prisma.variant.update({ where: { id: variantId }, data: { stock } });

  // Restocked → notify anyone waiting on this variant. Best-effort: a failure
  // here must never break the stock update, and the daily sweep retries any
  // that don't send. No-op when stock is still 0 or nobody's waiting.
  if (stock > 0) {
    try {
      await notifyBackInStockForVariant(variantId);
    } catch {
      // swallowed — the cron sweep is the backstop
    }
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin");
}

// ── Products & variants ─────────────────────────────────────────────────────
export async function createProduct(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  // slug becomes the storefront route segment (/product/<slug>).
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;

  const clash = await prisma.product.findUnique({ where: { slug } });
  if (clash) return; // unique slug — bail quietly

  await prisma.product.create({ data: { name, slug } });
  revalidatePath("/admin/products");
}

export async function updateProduct(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("productId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  const hsnCode = String(formData.get("hsnCode") ?? "").trim();
  const gstPercent = Math.round(Number(formData.get("gstPercent")));
  if (!id || !name || !hsnCode || !Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) return;

  // Empty text → null; one item per line for the list fields.
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const lines = (k: string) =>
    String(formData.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  await prisma.product.update({
    where: { id },
    data: {
      name,
      active,
      hsnCode,
      gstPercent,
      tagline: text("tagline"),
      claim: text("claim"),
      claimTone: text("claimTone"),
      description: text("description"),
      safety: text("safety"),
      placeholder: text("placeholder"),
      benefits: lines("benefits"),
      howToUse: lines("howToUse"),
    },
  });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}

// EAN-13 barcode, per the schema's documented format. Blank stays null.
const BARCODE_RE = /^\d{13}$/;

export async function updateVariant(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("variantId") ?? "");
  const fragrance = String(formData.get("fragrance") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim();
  const pricePaise = Math.round(Number(formData.get("priceRupees")) * 100);
  const weightRaw = formData.get("weightGrams");
  const weightGrams =
    weightRaw === null || String(weightRaw).trim() === ""
      ? null
      : Math.floor(Number(weightRaw));
  const active = formData.get("active") === "on";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  if (!id || !size || !Number.isFinite(pricePaise) || pricePaise < 0) return;
  if (weightGrams !== null && (!Number.isFinite(weightGrams) || weightGrams < 0)) return;
  if (barcode !== null && !BARCODE_RE.test(barcode)) return;

  // Unique constraint guard — bail quietly rather than throwing, same as SKU.
  if (barcode !== null) {
    const clash = await prisma.variant.findFirst({ where: { barcode, id: { not: id } } });
    if (clash) return;
  }

  await prisma.variant.update({
    where: { id },
    data: { fragrance, size, pricePaise, weightGrams, active, barcode },
  });
  revalidatePath("/admin/products");
  revalidatePath("/admin/stock");
}

// SKU is the live identity key for the cart and checkout (both resolve variants
// `where: { sku }`), so editing it is gated behind a deliberate, double-confirmed
// flow — type it twice + acknowledge — and ALL of that is re-checked here, since
// a Server Action is reachable by direct POST and the UI gate is not a boundary.
export type SkuUpdateState = { error?: string; ok?: boolean };
const SKU_RE = /^[A-Za-z0-9-]{1,32}$/;

export async function updateVariantSku(
  _prev: SkuUpdateState | undefined,
  formData: FormData,
): Promise<SkuUpdateState> {
  await requireAdmin();
  const variantId = String(formData.get("variantId") ?? "");
  const newSku = String(formData.get("newSku") ?? "").trim();
  const confirmSku = String(formData.get("confirmSku") ?? "").trim();
  const ack = formData.get("ack") === "on";

  if (!variantId) return { error: "Missing variant." };
  if (!newSku) return { error: "Enter a new SKU." };
  if (!SKU_RE.test(newSku)) return { error: "SKU may only contain letters, numbers and hyphens (max 32)." };
  if (newSku !== confirmSku) return { error: "The two SKU entries don't match." };
  if (!ack) return { error: "Please tick the box to confirm you understand the change." };

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { sku: true, productId: true },
  });
  if (!variant) return { error: "Variant not found." };
  if (variant.sku === newSku) return { error: "That is already this variant's SKU." };

  // Unique constraint guard — bail with a clear message rather than throwing.
  const clash = await prisma.variant.findUnique({ where: { sku: newSku }, select: { id: true } });
  if (clash) return { error: `SKU "${newSku}" is already used by another variant.` };

  await prisma.variant.update({ where: { id: variantId }, data: { sku: newSku } });
  revalidatePath(`/admin/products/${variant.productId}`);
  revalidatePath("/admin/stock");
  return { ok: true };
}

// ── Product images (stored as bytes in Postgres) ────────────────────────────
// Shared shape for the three image-upload actions below — lets the upload
// forms surface a rejection (wrong type, too large) instead of silently
// doing nothing, which is what a bare `Promise<void>` return produced before.
export type ImageUploadState = { error?: string };

function imageValidationError(file: FormDataEntryValue | null): string | undefined {
  if (!(file instanceof File) || file.size === 0) return "Choose a file first.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Unsupported file type — use WebP, JPEG, PNG, or AVIF.";
  }
  if (file.size > MAX_IMAGE_BYTES) return "Image is too large — 5 MB max.";
  return undefined;
}

export async function uploadProductImage(
  _prev: ImageUploadState | undefined,
  formData: FormData,
): Promise<ImageUploadState> {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  const fragrance = String(formData.get("fragrance") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim() || null;
  const alt = String(formData.get("alt") ?? "").trim() || null;
  if (!productId) return { error: "Missing product." };
  const fileError = imageValidationError(file);
  if (fileError) return { error: fileError };
  const image = file as File;

  const data = Buffer.from(await image.arrayBuffer());

  // First image for a product becomes the primary (card/PDP default).
  const count = await prisma.productImage.count({ where: { productId } });
  await prisma.productImage.create({
    data: {
      productId,
      data,
      contentType: image.type,
      alt,
      fragrance,
      size,
      isPrimary: count === 0,
      sortOrder: count,
    },
  });
  revalidatePath(`/admin/products/${productId}`);
  return {};
}

export async function deleteProductImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("imageId") ?? "");
  if (!id) return;
  const img = await prisma.productImage.findUnique({
    where: { id },
    select: { productId: true, isPrimary: true },
  });
  if (!img) return;
  await prisma.productImage.delete({ where: { id } });

  // Deleting the primary image left none flagged — promote the next one
  // (by sort order) so the admin gallery always shows a clear primary, same
  // as the storefront's own fallback in products.ts (hydrate: images[0]).
  if (img.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId: img.productId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (next) {
      await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  revalidatePath(`/admin/products/${img.productId}`);
}

export async function setPrimaryImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("imageId") ?? "");
  if (!id) return;
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) return;
  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId: img.productId }, data: { isPrimary: false } }),
    prisma.productImage.update({ where: { id }, data: { isPrimary: true } }),
  ]);
  revalidatePath(`/admin/products/${img.productId}`);
}

export async function createVariant(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const fragrance = String(formData.get("fragrance") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim();
  const pricePaise = Math.round(Number(formData.get("priceRupees")) * 100);
  const stock = Math.floor(Number(formData.get("stock")) || 0);
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  if (!productId || !sku || !SKU_RE.test(sku) || !size || !Number.isFinite(pricePaise) || pricePaise < 0) return;
  if (barcode !== null && !BARCODE_RE.test(barcode)) return;

  // Unique SKU — bail quietly if it already exists rather than throwing.
  const clash = await prisma.variant.findUnique({ where: { sku } });
  if (clash) return;

  if (barcode !== null) {
    const barcodeClash = await prisma.variant.findUnique({ where: { barcode } });
    if (barcodeClash) return;
  }

  // Same product + fragrance + size would be indistinguishable to the
  // storefront's variant picker (keyed on fragrance/size, not variant id).
  const dupe = await prisma.variant.findFirst({ where: { productId, fragrance, size } });
  if (dupe) return;

  await prisma.variant.create({
    data: { productId, sku, fragrance, size, pricePaise, stock: Math.max(0, stock), barcode },
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/stock");
}

// Deactivates the private SUB-<id> coupon for every non-cancelled subscription
// on the given variants, so a variant/product delete never leaves an orphaned
// coupon that keeps discounting orders with no subscription left to cancel it.
async function cancelSubscriptionCouponsForVariants(variantIds: string[]): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { variantId: { in: variantIds }, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (subs.length === 0) return;
  await prisma.coupon.deleteMany({
    where: { code: { in: subs.map((s) => subscriptionCouponCode(s.id)) } },
  });
}

// Permanently remove a variant. Safe for order history: OrderItem.variantId is
// optional (nulled on delete) and each OrderItem keeps its own snapshot (sku,
// name, size, price); cart references cascade away. To just hide a variant from
// the store without deleting, untick its "Active" box instead.
export async function deleteVariant(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("variantId") ?? "");
  if (!id) return;
  const variant = await prisma.variant.findUnique({
    where: { id },
    select: { productId: true },
  });
  if (!variant) return;

  // Deleting the variant cascades away any Subscription row for it (required
  // FK), but NOT that subscription's private SUB-<id> coupon — Coupon has no
  // FK relation, so without this it would stay active forever with no
  // subscription left to cancel it from.
  await cancelSubscriptionCouponsForVariants([id]);

  await prisma.variant.delete({ where: { id } });
  revalidatePath(`/admin/products/${variant.productId}`);
  revalidatePath("/admin/stock");
}

// Permanently remove a product and all its variants + images. Product→Variant
// is a required relation (Postgres would RESTRICT the delete), so drop the
// variants first, then the product (images cascade). Order history survives via
// the OrderItem snapshots. To just hide a product, untick "Active" instead.
export async function deleteProduct(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("productId") ?? "");
  if (!id) return;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (!product) return;

  await cancelSubscriptionCouponsForVariants(product.variants.map((v) => v.id));

  await prisma.$transaction([
    prisma.variant.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/products");
  revalidatePath("/admin/stock");
  redirect("/admin/products");
}

// ── Reviews (moderation) ────────────────────────────────────────────────────
export async function approveReview(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  const review = await prisma.review.update({
    where: { id },
    data: { approved: true },
    select: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
}

// Pull an approved review back into the moderation queue without deleting it
// — for a complaint or policy issue where the review itself is still worth
// keeping on record. Mirrors unpublishQuestion below.
export async function unapproveReview(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  const review = await prisma.review.update({
    where: { id },
    data: { approved: false },
    select: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
}

export async function deleteReview(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  const review = await prisma.review.findUnique({
    where: { id },
    select: { product: { select: { slug: true } } },
  });
  if (!review) return;
  await prisma.review.delete({ where: { id } });
  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
}

// ── Product Q&A ───────────────────────────────────────────────────────────────
// Answer a customer question. Saving an answer publishes it in one step (it's
// the answer that makes a question worth showing). Editing an already-published
// answer just updates it in place.
export async function answerQuestion(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("questionId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!id || answer.length < 2) return;
  const q = await prisma.productQuestion.update({
    where: { id },
    data: { answer, answeredAt: new Date(), published: true },
    select: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/questions");
  revalidatePath(`/product/${q.product.slug}`);
}

// Pull a published question back into the moderation queue without deleting it.
export async function unpublishQuestion(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("questionId") ?? "");
  if (!id) return;
  const q = await prisma.productQuestion.update({
    where: { id },
    data: { published: false },
    select: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/questions");
  revalidatePath(`/product/${q.product.slug}`);
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("questionId") ?? "");
  if (!id) return;
  const q = await prisma.productQuestion.findUnique({
    where: { id },
    select: { product: { select: { slug: true } } },
  });
  if (!q) return;
  await prisma.productQuestion.delete({ where: { id } });
  revalidatePath("/admin/questions");
  revalidatePath(`/product/${q.product.slug}`);
}

// ── Coupons ─────────────────────────────────────────────────────────────────
const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,23}$/;

export async function createCoupon(formData: FormData): Promise<void> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "") as DiscountType;
  const valueRaw = Number(formData.get("value"));
  const minRupees = Number(formData.get("minOrderRupees")) || 0;
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();

  if (!COUPON_CODE_RE.test(code)) return; // letters/numbers/hyphens, 2–24 chars
  if (type !== "PERCENT" && type !== "FIXED") return;
  if (!Number.isFinite(valueRaw) || valueRaw <= 0) return;
  if (type === "PERCENT" && valueRaw > 100) return;

  // PERCENT stores a whole percent; FIXED stores paise.
  const value = type === "PERCENT" ? Math.round(valueRaw) : Math.round(valueRaw * 100);
  const minOrderPaise = Math.max(0, Math.round(minRupees * 100));
  const maxUses = maxUsesRaw ? Math.max(1, Math.floor(Number(maxUsesRaw))) : null;
  if (maxUses !== null && !Number.isFinite(maxUses)) return;
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return;

  const clash = await prisma.coupon.findUnique({ where: { code } });
  if (clash) return; // unique code — bail quietly

  await prisma.coupon.create({
    data: { code, type, value, minOrderPaise, maxUses, expiresAt },
  });
  revalidatePath("/admin/coupons");
}

export async function toggleCoupon(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("couponId") ?? "");
  if (!id) return;
  const c = await prisma.coupon.findUnique({ where: { id }, select: { active: true } });
  if (!c) return;
  await prisma.coupon.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("couponId") ?? "");
  if (!id) return;
  const c = await prisma.coupon.findUnique({ where: { id }, select: { code: true } });
  if (!c || isSystemCouponCode(c.code)) return;
  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/coupons");
}

// ── Bundles (curated kits) ──────────────────────────────────────────────────
// A bundle's discount is realised through a mirrored coupon (code KIT-<slug>),
// so every bundle write keeps that coupon in sync.
async function syncBundleCoupon(
  slug: string,
  type: DiscountType,
  value: number,
  active: boolean,
): Promise<void> {
  const code = bundleCouponCode(slug);
  await prisma.coupon.upsert({
    where: { code },
    create: { code, type, value, minOrderPaise: 0, active },
    update: { type, value, active },
  });
}

export async function createBundle(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const type = String(formData.get("discountType") ?? "") as DiscountType;
  const valueRaw = Number(formData.get("discountValue"));
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
  if (type !== "PERCENT" && type !== "FIXED") return;
  if (!Number.isFinite(valueRaw) || valueRaw <= 0) return;
  if (type === "PERCENT" && valueRaw > 100) return;
  const discountValue = type === "PERCENT" ? Math.round(valueRaw) : Math.round(valueRaw * 100);

  const clash = await prisma.bundle.findUnique({ where: { slug } });
  if (clash) return;

  await prisma.bundle.create({ data: { name, slug, discountType: type, discountValue } });
  await syncBundleCoupon(slug, type, discountValue, true);
  revalidatePath("/admin/bundles");
  revalidatePath("/shop");
}

export async function updateBundle(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("bundleId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const type = String(formData.get("discountType") ?? "") as DiscountType;
  const valueRaw = Number(formData.get("discountValue"));
  const active = formData.get("active") === "on";
  if (!id || !name) return;
  if (type !== "PERCENT" && type !== "FIXED") return;
  if (!Number.isFinite(valueRaw) || valueRaw <= 0) return;
  if (type === "PERCENT" && valueRaw > 100) return;
  const discountValue = type === "PERCENT" ? Math.round(valueRaw) : Math.round(valueRaw * 100);

  const bundle = await prisma.bundle.update({
    where: { id },
    data: { name, description, discountType: type, discountValue, active },
    select: { slug: true },
  });
  await syncBundleCoupon(bundle.slug, type, discountValue, active);
  revalidatePath("/admin/bundles");
  revalidatePath(`/admin/bundles/${id}`);
  revalidatePath("/shop");
}

export async function deleteBundle(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("bundleId") ?? "");
  if (!id) return;
  const bundle = await prisma.bundle.findUnique({ where: { id }, select: { slug: true } });
  if (!bundle) return;
  await prisma.bundle.delete({ where: { id } }); // items cascade
  await prisma.coupon.deleteMany({ where: { code: bundleCouponCode(bundle.slug) } });
  revalidatePath("/admin/bundles");
  revalidatePath("/shop");
  redirect("/admin/bundles");
}

export async function addBundleItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const bundleId = String(formData.get("bundleId") ?? "");
  const variantId = String(formData.get("variantId") ?? "").trim() || null;
  const productId = String(formData.get("productId") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim() || null;
  const quantity = Math.max(1, Math.floor(Number(formData.get("quantity")) || 1));
  if (!bundleId) return;

  if (variantId) {
    // Exact slot — merge into an existing identical slot instead of creating
    // a second line item for the same variant.
    const existing = await prisma.bundleItem.findFirst({ where: { bundleId, variantId } });
    if (existing) {
      await prisma.bundleItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await prisma.bundleItem.create({ data: { bundleId, variantId, quantity } });
    }
  } else if (productId) {
    // Flexible product slot (any variant of the product, optional size lock)
    // — same merge, keyed on product + size lock.
    const existing = await prisma.bundleItem.findFirst({ where: { bundleId, productId, size } });
    if (existing) {
      await prisma.bundleItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await prisma.bundleItem.create({ data: { bundleId, productId, size, quantity } });
    }
  } else {
    return;
  }
  revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/shop");
}

export async function removeBundleItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("bundleItemId") ?? "");
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!id || !bundleId) return;
  // Scope the delete to the posted bundle too — a stale/copy-pasted form
  // shouldn't be able to delete an item from a different kit.
  const { count } = await prisma.bundleItem.deleteMany({ where: { id, bundleId } });
  if (count === 0) return;
  revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/shop");
}

export async function uploadBundleImage(
  _prev: ImageUploadState | undefined,
  formData: FormData,
): Promise<ImageUploadState> {
  await requireAdmin();
  const bundleId = String(formData.get("bundleId") ?? "");
  const file = formData.get("file");
  if (!bundleId) return { error: "Missing kit." };
  const fileError = imageValidationError(file);
  if (fileError) return { error: fileError };
  const image = file as File;

  const data = Buffer.from(await image.arrayBuffer());
  await prisma.bundle.update({
    where: { id: bundleId },
    data: { imageData: data, imageType: image.type },
  });
  revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/shop");
  return {};
}

export async function removeBundleImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!bundleId) return;
  await prisma.bundle.update({
    where: { id: bundleId },
    data: { imageData: null, imageType: null },
  });
  revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/shop");
}

// ── Blog / journal ───────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BlogPostState = { error?: string } | undefined;

export async function createBlogPost(
  _prev: BlogPostState,
  formData: FormData,
): Promise<BlogPostState> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!title) return { error: "Enter a title." };
  if (!SLUG_RE.test(slug)) {
    return { error: "Slug may only contain lowercase letters, numbers, and hyphens." };
  }

  const clash = await prisma.blogPost.findFirst({
    where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
  });
  if (clash) return { error: `Slug "${slug}" is already used by another post.` };

  // Created as an empty draft; the edit page fills in excerpt/body/cover next.
  const post = await prisma.blogPost.create({ data: { title, slug, excerpt: "", body: "" } });
  revalidatePath("/admin/blog");
  redirect(`/admin/blog/${post.id}`);
}

export async function updateBlogPost(
  _prev: BlogPostState,
  formData: FormData,
): Promise<BlogPostState> {
  await requireAdmin();
  const id = String(formData.get("blogPostId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const metaDescription = String(formData.get("metaDescription") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  if (!id) return { error: "Missing post." };
  if (!title) return { error: "Enter a title." };
  if (!SLUG_RE.test(slug)) {
    return { error: "Slug may only contain lowercase letters, numbers, and hyphens." };
  }
  if (!excerpt) return { error: "Enter an excerpt." };
  if (!body) return { error: "Enter the post body." };

  const existing = await prisma.blogPost.findUnique({
    where: { id },
    select: { slug: true, publishedAt: true, previousSlugs: true },
  });
  if (!existing) return { error: "Post not found." };

  if (slug !== existing.slug) {
    const clash = await prisma.blogPost.findFirst({
      where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
    });
    if (clash) return { error: `Slug "${slug}" is already used by another post.` };
  }

  await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug,
      // Remember the old slug so a bookmarked/indexed URL still redirects
      // instead of 404ing once the post moves to a new one.
      previousSlugs:
        slug !== existing.slug
          ? [...existing.previousSlugs.filter((s) => s !== slug), existing.slug]
          : existing.previousSlugs,
      excerpt,
      body,
      metaDescription,
      published,
      // Set once, the first time a post goes live; re-publishing after
      // unpublishing doesn't reset it — it's the stable "posted on" date.
      publishedAt: published && !existing.publishedAt ? new Date() : existing.publishedAt,
    },
  });
  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${existing.slug}`);
  if (slug !== existing.slug) revalidatePath(`/blog/${slug}`);
  return {};
}

export async function deleteBlogPost(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("blogPostId") ?? "");
  if (!id) return;
  const post = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true } });
  if (!post) return;
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  redirect("/admin/blog");
}

export async function uploadBlogImage(
  _prev: ImageUploadState | undefined,
  formData: FormData,
): Promise<ImageUploadState> {
  await requireAdmin();
  const blogPostId = String(formData.get("blogPostId") ?? "");
  const file = formData.get("file");
  if (!blogPostId) return { error: "Missing post." };
  const fileError = imageValidationError(file);
  if (fileError) return { error: fileError };
  const image = file as File;

  const data = Buffer.from(await image.arrayBuffer());
  const post = await prisma.blogPost.update({
    where: { id: blogPostId },
    data: { coverImageData: data, coverImageType: image.type },
    select: { slug: true },
  });
  revalidatePath(`/admin/blog/${blogPostId}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return {};
}

export async function removeBlogImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const blogPostId = String(formData.get("blogPostId") ?? "");
  if (!blogPostId) return;
  const post = await prisma.blogPost.update({
    where: { id: blogPostId },
    data: { coverImageData: null, coverImageType: null },
    select: { slug: true },
  });
  revalidatePath(`/admin/blog/${blogPostId}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
}

// ── Subscriptions ───────────────────────────────────────────────────────────
// Manually run the "subscribe & save" reminder batch (a daily cron should call
// sendDueSubscriptionReminders() in production; this button is the interim
// trigger + a way to test it). Rolls each reminded subscription forward a cycle.
export async function runSubscriptionReminders(): Promise<void> {
  await requireAdmin();
  await sendDueSubscriptionReminders();
  revalidatePath("/admin/subscriptions");
}