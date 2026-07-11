import "server-only";
// Abandoned-cart reminders. A signed-in customer's cart lives on the server, so
// when one sits untouched with items in it, we can nudge them back with a single
// email. One reminder per abandonment episode: reminderSentAt gates re-sends and
// is reset on any cart write (see writeCart), so a re-engaged cart can be nudged
// again but an untouched one never is. Guests (localStorage carts) have no server
// record, so they're out of scope by design. Never import from client code.
import { prisma } from "@/lib/prisma";
import { loadServerCartItems } from "@/lib/server-cart";
import { sendAbandonedCartEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/constants";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Wait this long after the last cart activity before nudging (let them finish on
// their own first), and never nudge a cart older than this (the intent's gone).
const ABANDON_AFTER_MS = 4 * HOUR_MS;
const ABANDON_MAX_AGE_MS = 7 * DAY_MS;

export async function runAbandonedCartSweep(): Promise<{ sent: number; failed: number; carts: number }> {
  const now = Date.now();
  const carts = await prisma.cart.findMany({
    where: {
      reminderSentAt: null, // not yet reminded this episode
      updatedAt: {
        lt: new Date(now - ABANDON_AFTER_MS), // inactive long enough
        gt: new Date(now - ABANDON_MAX_AGE_MS), // but not stale
      },
      items: { some: {} }, // has at least one item
    },
    select: { id: true, customerId: true, customer: { select: { email: true, name: true } } },
  });

  let sent = 0;
  let failed = 0;
  let carts_ = 0;
  for (const cart of carts) {
    // Hydrate to today's catalog (live price, drops inactive variants) — the same
    // resolution the storefront uses. If nothing survives, there's nothing to nudge.
    const items = await loadServerCartItems(cart.customerId);
    if (items.length === 0) continue;
    carts_++;

    const subtotalPaise = items.reduce((s, i) => s + i.pricePaise * i.quantity, 0);
    try {
      await sendAbandonedCartEmail({
        to: cart.customer.email,
        name: cart.customer.name,
        items: items.map((i) => ({
          name: i.name,
          fragrance: i.fragrance ?? null,
          size: i.size,
          quantity: i.quantity,
          pricePaise: i.pricePaise,
        })),
        subtotalPaise,
        cartUrl: `${SITE_URL}/cart`,
      });
      // Mark reminded so this episode won't nudge again; a later cart edit resets
      // this to null (writeCart), re-arming a fresh episode.
      await prisma.cart.update({ where: { id: cart.id }, data: { reminderSentAt: new Date() } });
      sent++;
    } catch (err) {
      // Leave reminderSentAt null so the next sweep retries (bounded by max age).
      console.error(`Abandoned-cart email failed for cart ${cart.id} (${cart.customer.email}):`, err);
      failed++;
    }
  }
  return { sent, failed, carts: carts_ };
}
