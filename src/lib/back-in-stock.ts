import "server-only";
// Back-in-stock notification engine. Customers ask to be told when an
// out-of-stock variant returns; when it's restocked, everyone waiting (and not
// yet notified) is emailed and stamped, so they're never nudged twice for the
// same refill. Never import from client code.
import { prisma } from "@/lib/prisma";
import { sendBackInStockEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/constants";

// Notify everyone waiting on a specific variant, IF it's currently buyable.
// Idempotent: only un-notified alerts are sent, each stamped notifiedAt on
// success. Best-effort per recipient — a failed send leaves the alert pending
// so the daily sweep retries it. Safe to call after any stock write (a no-op
// when the variant is still out of stock or has no waiters).
export async function notifyBackInStockForVariant(variantId: string): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: { product: { select: { slug: true, name: true, active: true } } },
  });
  if (!variant || variant.stock <= 0 || !variant.active || !variant.product.active) {
    return { sent, failed };
  }

  const pending = await prisma.backInStockAlert.findMany({
    where: { variantId, notifiedAt: null },
  });
  if (pending.length === 0) return { sent, failed };

  const label = [variant.fragrance, variant.size].filter(Boolean).join(" · ");
  const productUrl = `${SITE_URL}/product/${variant.product.slug}${
    variant.fragrance ? `?fragrance=${encodeURIComponent(variant.fragrance)}` : ""
  }`;

  for (const alert of pending) {
    try {
      await sendBackInStockEmail({
        to: alert.email,
        productName: variant.product.name,
        variantLabel: label,
        pricePaise: variant.pricePaise,
        productUrl,
      });
      await prisma.backInStockAlert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } });
      sent++;
    } catch (err) {
      console.error(`Back-in-stock email failed for alert ${alert.id} (${alert.email}):`, err);
      failed++;
    }
  }
  return { sent, failed };
}

// Sweep EVERY variant that is back in stock with pending waiters. Backstop for
// restock paths that don't run the admin stock hook (a returned/cancelled order
// increments stock directly) and a retry for any failed sends. For the cron.
export async function runBackInStockSweep(): Promise<{ sent: number; failed: number; variants: number }> {
  const targets = await prisma.backInStockAlert.findMany({
    where: {
      notifiedAt: null,
      variant: { stock: { gt: 0 }, active: true, product: { active: true } },
    },
    distinct: ["variantId"],
    select: { variantId: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { variantId } of targets) {
    const r = await notifyBackInStockForVariant(variantId);
    sent += r.sent;
    failed += r.failed;
  }
  return { sent, failed, variants: targets.length };
}

// Per-variant count of people still waiting (un-notified) — for the admin stock
// page. Returns a Map keyed by variantId.
export async function pendingAlertCounts(): Promise<Map<string, number>> {
  const rows = await prisma.backInStockAlert.groupBy({
    by: ["variantId"],
    where: { notifiedAt: null },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.variantId, r._count._all]));
}
