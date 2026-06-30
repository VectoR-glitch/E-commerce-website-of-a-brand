"use server";
// Admin mutations. Server Actions are reachable by direct POST, so EVERY one
// re-checks requireAdmin() — the UI gate alone is not a security boundary.
import { revalidatePath } from "next/cache";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendOrderStatusEmail, type OrderForEmail } from "@/lib/email";

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

  // Returns the order snapshot when the status actually changed (null otherwise),
  // so we only email the customer on a real transition.
  const changed = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order || order.status === status) return null;

    // Restock when leaving a stock-committed status for CANCELLED/RETURNED, so
    // inventory reflects the freed units. (Re-confirming a cancelled order does
    // NOT auto-decrement again — the admin should verify stock in that case.)
    const wasCommitted = STOCK_COMMITTED.includes(order.status);
    const nowFreed = status === "CANCELLED" || status === "RETURNED";
    if (wasCommitted && nowFreed) {
      for (const it of order.items) {
        if (it.variantId) {
          await tx.variant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.quantity } },
          });
        }
      }
    }
    await tx.order.update({ where: { id }, data: { status } });
    return order; // pre-update snapshot — items/ship/totals are unchanged by this
  });

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