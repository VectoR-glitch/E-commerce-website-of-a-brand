import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABEL } from "@/lib/order-display";
import type { OrderTracking } from "@/lib/order-tracking";

// The linear happy-path steps shown as a stepper. ON_HOLD/CANCELLED/RETURNED
// are exceptions to this path (a cancelled order never "arrives"), so they're
// rendered as a plain status note instead — see EXCEPTION_STATUSES below.
const HAPPY_PATH: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];
const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};
const EXCEPTION_NOTE: Partial<Record<OrderStatus, string>> = {
  ON_HOLD: "Our team is reviewing this order and will be in touch shortly.",
  CANCELLED: "Any eligible refund follows to your original payment method.",
  RETURNED: "This order's return has been processed. Any eligible refund follows to your original payment method.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function OrderTrackingView({ tracking }: { tracking: OrderTracking }) {
  const exceptionNote = EXCEPTION_NOTE[tracking.status];
  const currentStepIdx = HAPPY_PATH.indexOf(tracking.status);

  return (
    <div className="border border-line bg-paper p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-5">
        <div>
          <p className="smallcaps text-brass-deep">Order</p>
          <p className="font-serif text-2xl text-ink">{tracking.orderNumber}</p>
        </div>
        <p className="text-sm text-ink/60">Placed {formatDate(tracking.createdAt)}</p>
      </div>

      {exceptionNote ? (
        <div className="mt-6">
          <p className="font-serif text-xl text-ink">{ORDER_STATUS_LABEL[tracking.status]}</p>
          <p className="mt-2 text-sm text-ink/70">{exceptionNote}</p>
        </div>
      ) : (
        <ol className="mt-8">
          {HAPPY_PATH.map((status, i) => {
            const done = currentStepIdx >= 0 && i <= currentStepIdx;
            const isLast = i === HAPPY_PATH.length - 1;
            return (
              <li key={status} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                      done ? "border-forest bg-forest text-bone" : "border-line bg-white text-ink/40"
                    }`}
                    aria-hidden="true"
                  >
                    {done ? "✓" : ""}
                  </span>
                  {!isLast && (
                    <span
                      className={`w-px flex-1 ${done && i < currentStepIdx ? "bg-forest" : "bg-line"}`}
                      style={{ minHeight: 28 }}
                    />
                  )}
                </div>
                <div className={`pb-7 ${done ? "text-ink" : "text-ink/40"}`}>
                  <p className="smallcaps text-sm">{STEP_LABEL[status]}</p>
                  {status === "DELIVERED" && done && tracking.deliveredAt && (
                    <p className="mt-0.5 text-xs text-ink/60">{formatDate(tracking.deliveredAt)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {tracking.courier && (
        <div className="mt-2 border-t border-line pt-5 text-sm text-ink/70">
          <p className="smallcaps text-brass-deep">Courier status</p>
          <p className="mt-1 text-ink">{tracking.courier.status}</p>
          {tracking.courier.lastTrackedAt && (
            <p className="mt-1 text-xs text-ink/50">Last checked {formatDate(tracking.courier.lastTrackedAt)}</p>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-line pt-4 text-xs text-ink/50">
        Shipping to {tracking.shipCity}, {tracking.shipState}
      </div>
    </div>
  );
}
