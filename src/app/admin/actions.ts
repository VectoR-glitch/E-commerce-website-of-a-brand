"use server";
// Admin mutations. Server Actions are reachable by direct POST, so EVERY one
// re-checks requireAdmin() — the UI gate alone is not a security boundary.
import { revalidatePath } from "next/cache";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);

// Statuses where stock has been committed (decremented at settlement). Moving
// from one of these INTO a cancelled/returned state returns the units.
const STOCK_COMMITTED: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

export async function updateOrderStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!id || !ORDER_STATUSES.includes(status)) return;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order || order.status === status) return;

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
  });

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
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
  // slug must match the storefront route segment + Sanity convention.
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