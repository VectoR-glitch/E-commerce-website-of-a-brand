// Shared order-tracking lookup, used by both the customer-facing /track-order
// manual-lookup page (order# + email) and the tokened link opened from the
// order confirmation email (/track-order/[token]). Internal OrderStatus is
// always available (no external dependency); Ekart's last-known courier
// status is layered on top once a shipment has been booked.
import { prisma } from "@/lib/prisma";
import { trackShipment, EkartUnavailableError } from "@/lib/ekart";
import type { OrderStatus } from "@prisma/client";

export type OrderTracking = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  shipCity: string;
  shipState: string;
  courier: { status: string; lastTrackedAt: string | null } | null;
};

const SELECT = {
  id: true,
  orderNumber: true,
  email: true,
  status: true,
  createdAt: true,
  deliveredAt: true,
  shipCity: true,
  shipState: true,
  ekartTrackingId: true,
  ekartStatus: true,
  ekartLastTrackedAt: true,
} as const;

type OrderRow = {
  id: string;
  orderNumber: string;
  email: string;
  status: OrderStatus;
  createdAt: Date;
  deliveredAt: Date | null;
  shipCity: string;
  shipState: string;
  ekartTrackingId: string | null;
  ekartStatus: string | null;
  ekartLastTrackedAt: Date | null;
};

// Only re-poll Ekart if the cached status is missing or older than this — a
// customer refreshing the page repeatedly shouldn't burn an API call (and its
// timeout) on every load. Same throttle idea as the abandoned-cart reminder's
// claim window elsewhere in this codebase; a courier status is not something
// that needs to be real-time-fresh on every request.
const REFRESH_STALE_MS = 30 * 60 * 1000;

async function toTracking(order: OrderRow): Promise<OrderTracking> {
  let courierStatus = order.ekartStatus;
  let lastTrackedAt = order.ekartLastTrackedAt;

  if (order.ekartTrackingId) {
    const stale = !lastTrackedAt || Date.now() - lastTrackedAt.getTime() > REFRESH_STALE_MS;
    if (stale) {
      try {
        const live = await trackShipment(order.ekartTrackingId);
        courierStatus = live.status;
        lastTrackedAt = new Date();
        await prisma.order.update({
          where: { id: order.id },
          data: { ekartStatus: courierStatus, ekartLastTrackedAt: lastTrackedAt },
        });
      } catch (err) {
        // A courier-API hiccup must never break the customer's tracking page —
        // fall back to whatever was last cached (possibly nothing yet).
        if (!(err instanceof EkartUnavailableError)) throw err;
      }
    }
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    shipCity: order.shipCity,
    shipState: order.shipState,
    courier: order.ekartTrackingId
      ? { status: courierStatus ?? "Booked — awaiting first courier scan", lastTrackedAt: lastTrackedAt?.toISOString() ?? null }
      : null,
  };
}

export async function getOrderTrackingByToken(token: string): Promise<OrderTracking | null> {
  const order = await prisma.order.findUnique({ where: { trackingToken: token }, select: SELECT });
  if (!order) return null;
  return toTracking(order);
}

/**
 * Manual lookup for the /track-order form. Requires the order number AND its
 * matching email — guards against enumerating other customers' orders by
 * order number alone. Returns null for either a wrong order number or a
 * mismatched email, so the caller can show one generic error either way.
 */
export async function getOrderTrackingByNumberAndEmail(
  orderNumber: string,
  email: string,
): Promise<OrderTracking | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.trim() },
    select: SELECT,
  });
  if (!order || order.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return toTracking(order);
}
