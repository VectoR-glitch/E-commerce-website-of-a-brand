"use server";
// Admin mutations. Server Actions are reachable by direct POST, so EVERY one
// re-checks requireAdmin() — the UI gate alone is not a security boundary.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus, PaymentStatus, DiscountType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendOrderStatusEmail, type OrderForEmail } from "@/lib/email";
import { bundleCouponCode } from "@/lib/bundles";
import { sendDueSubscriptionReminders } from "@/lib/subscriptions";
import { notifyBackInStockForVariant } from "@/lib/back-in-stock";

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);

// Image upload constraints — stored directly in Postgres, so keep them small.
const ALLOWED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
function isAllowedImage(type: string, size: number): boolean {
  return ALLOWED_IMAGE_TYPES.includes(type) && size > 0 && size <= MAX_IMAGE_BYTES;
}

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
    const restock =
      wasCommitted && nowFreed
        ? changed.items
            .filter((it) => it.variantId)
            .map((it) =>
              prisma.variant.update({
                where: { id: it.variantId! },
                data: { stock: { increment: it.quantity } },
              }),
            )
        : [];

    // Batch all writes into a single short-lived transaction — restock (if any)
    // and the status update commit together, atomically. The status write is
    // guarded on the value we read (updateMany allows the non-unique `status`
    // filter), so a concurrent admin transition can't re-write it — matches 0
    // rows instead.
    await prisma.$transaction([
      ...restock,
      prisma.order.updateMany({ where: { id, status: changed.status }, data: { status } }),
    ]);
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  // Notify the customer of the new status. Best-effort: never let an email
  // failure surface as a failed status update (the change is already committed).
  if (changed) {
    try {
      await sendOrderStatusEmail(toOrderForEmail(changed), status);
    } catch (err) {
      console.error(`status email failed for order ${id}:`, err);
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
  if (!id || !name) return;

  // Empty text → null; one item per line for the list fields.
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const lines = (k: string) =>
    String(formData.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  await prisma.product.update({
    where: { id },
    data: {
      name,
      active,
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
  if (!id || !size || !Number.isFinite(pricePaise) || pricePaise < 0) return;
  if (weightGrams !== null && (!Number.isFinite(weightGrams) || weightGrams < 0)) return;

  await prisma.variant.update({
    where: { id },
    data: { fragrance, size, pricePaise, weightGrams, active },
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
export async function uploadProductImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  const fragrance = String(formData.get("fragrance") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim() || null;
  const alt = String(formData.get("alt") ?? "").trim() || null;
  if (!productId || !(file instanceof File) || !isAllowedImage(file.type, file.size)) return;

  const data = Buffer.from(await file.arrayBuffer());

  // First image for a product becomes the primary (card/PDP default).
  const count = await prisma.productImage.count({ where: { productId } });
  await prisma.productImage.create({
    data: {
      productId,
      data,
      contentType: file.type,
      alt,
      fragrance,
      size,
      isPrimary: count === 0,
      sortOrder: count,
    },
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("imageId") ?? "");
  if (!id) return;
  const img = await prisma.productImage.findUnique({
    where: { id },
    select: { productId: true },
  });
  if (!img) return;
  await prisma.productImage.delete({ where: { id } });
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
  if (!productId || !sku || !size || !Number.isFinite(pricePaise) || pricePaise < 0) return;

  // Unique SKU — bail quietly if it already exists rather than throwing.
  const clash = await prisma.variant.findUnique({ where: { sku } });
  if (clash) return;

  await prisma.variant.create({
    data: { productId, sku, fragrance, size, pricePaise, stock: Math.max(0, stock) },
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/stock");
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
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return;
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
    // Exact slot.
    await prisma.bundleItem.create({ data: { bundleId, variantId, quantity } });
  } else if (productId) {
    // Flexible product slot (any variant of the product, optional size lock).
    await prisma.bundleItem.create({ data: { bundleId, productId, size, quantity } });
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
  if (!id) return;
  await prisma.bundleItem.delete({ where: { id } });
  if (bundleId) revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/shop");
}

export async function uploadBundleImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const bundleId = String(formData.get("bundleId") ?? "");
  const file = formData.get("file");
  if (!bundleId || !(file instanceof File) || !isAllowedImage(file.type, file.size)) return;

  const data = Buffer.from(await file.arrayBuffer());
  await prisma.bundle.update({
    where: { id: bundleId },
    data: { imageData: data, imageType: file.type },
  });
  revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/shop");
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

export async function createBlogPost(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!title || !SLUG_RE.test(slug)) return;

  const clash = await prisma.blogPost.findUnique({ where: { slug } });
  if (clash) return;

  // Created as an empty draft; the edit page fills in excerpt/body/cover next.
  const post = await prisma.blogPost.create({ data: { title, slug, excerpt: "", body: "" } });
  revalidatePath("/admin/blog");
  redirect(`/admin/blog/${post.id}`);
}

export async function updateBlogPost(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("blogPostId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const metaDescription = String(formData.get("metaDescription") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  if (!id || !title || !SLUG_RE.test(slug) || !excerpt || !body) return;

  const existing = await prisma.blogPost.findUnique({
    where: { id },
    select: { slug: true, publishedAt: true },
  });
  if (!existing) return;

  if (slug !== existing.slug) {
    const clash = await prisma.blogPost.findUnique({ where: { slug } });
    if (clash) return;
  }

  await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug,
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

export async function uploadBlogImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const blogPostId = String(formData.get("blogPostId") ?? "");
  const file = formData.get("file");
  if (!blogPostId || !(file instanceof File) || !isAllowedImage(file.type, file.size)) return;

  const data = Buffer.from(await file.arrayBuffer());
  const post = await prisma.blogPost.update({
    where: { id: blogPostId },
    data: { coverImageData: data, coverImageType: file.type },
    select: { slug: true },
  });
  revalidatePath(`/admin/blog/${blogPostId}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
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