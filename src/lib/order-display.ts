import type { OrderStatus, PaymentMethod } from "@prisma/client";

// Customer-facing labels + badge tone for an order's fulfilment status. (The
// admin console shows the raw enum; shoppers get friendlier wording.)
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Payment pending",
  CONFIRMED: "Confirmed",
  ON_HOLD: "On hold",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  CONFIRMED: "border-forest/30 bg-forest/5 text-forest",
  ON_HOLD: "border-amber-300 bg-amber-50 text-amber-800",
  PACKED: "border-forest/30 bg-forest/5 text-forest",
  SHIPPED: "border-forest/30 bg-forest/5 text-forest",
  DELIVERED: "border-forest/40 bg-forest/10 text-forest",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  RETURNED: "border-red-200 bg-red-50 text-red-700",
};

export function orderStatusBadgeClass(status: OrderStatus): string {
  return STATUS_TONE[status];
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return method === "COD" ? "Cash on Delivery" : "Paid online";
}