import "server-only";
// Post-delivery review-request emails. One per order, gated by
// reviewRequestSentAt so a re-run of the sweep never double-sends. Only
// orders placed while signed in are eligible — Review.customerId is
// required, so a guest checkout (Order.customerId null) has no account to
// leave one under. Never import from client code.
import { prisma } from "@/lib/prisma";
import { sendReviewRequestEmail } from "@/lib/email";

const DAY_MS = 24 * 60 * 60 * 1000;
// Wait this long after delivery before asking (give the product a few days
// of actual use first), and don't bother once it's this stale — the
// purchase is no longer fresh enough to prompt a useful review.
const REQUEST_AFTER_MS = 5 * DAY_MS;
const REQUEST_MAX_AGE_MS = 30 * DAY_MS;

export async function runReviewRequestSweep(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const now = Date.now();
  const orders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      customerId: { not: null },
      reviewRequestSentAt: null,
      deliveredAt: {
        lt: new Date(now - REQUEST_AFTER_MS),
        gt: new Date(now - REQUEST_MAX_AGE_MS),
      },
    },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      customer: { select: { email: true, name: true } },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of orders) {
    if (!order.customerId || !order.customer) {
      skipped++;
      continue;
    }

    // Unique products in this order (a multi-variant order can repeat a product).
    const products = new Map<string, { name: string; slug: string }>();
    for (const it of order.items) {
      if (it.variant?.product) {
        products.set(it.variant.product.id, {
          name: it.variant.product.name,
          slug: it.variant.product.slug,
        });
      }
    }
    if (products.size === 0) {
      skipped++;
      continue;
    }

    // Skip (and mark done) if they've already reviewed at least one product
    // from this order — approximate rather than per-product, but avoids
    // re-nagging an already-engaged customer; not worth more precision here.
    const alreadyReviewed = await prisma.review.findFirst({
      where: { customerId: order.customerId, productId: { in: [...products.keys()] } },
      select: { id: true },
    });
    if (alreadyReviewed) {
      await prisma.order.update({
        where: { id: order.id },
        data: { reviewRequestSentAt: new Date() },
      });
      skipped++;
      continue;
    }

    // Claim this order before sending: a guarded update that only succeeds if
    // nobody else has claimed it (reviewRequestSentAt still null) — so an
    // overlapping or retried sweep invocation can never both see this order
    // as eligible and both send it. Explicitly released back to null on
    // failure so the next sweep retries, same as the old unguarded behavior.
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, reviewRequestSentAt: null },
      data: { reviewRequestSentAt: new Date() },
    });
    if (claimed.count === 0) {
      skipped++;
      continue;
    }

    try {
      await sendReviewRequestEmail({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: order.orderNumber,
        products: [...products.values()],
      });
      sent++;
    } catch (err) {
      // Release the claim so the next sweep retries (bounded by max age).
      console.error(`Review-request email failed for order ${order.orderNumber}:`, err);
      await prisma.order.update({ where: { id: order.id }, data: { reviewRequestSentAt: null } });
      failed++;
    }
  }

  return { sent, failed, skipped };
}
