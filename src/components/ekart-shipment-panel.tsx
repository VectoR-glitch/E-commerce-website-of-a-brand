"use client";
import { useActionState } from "react";
import {
  createEkartShipment,
  trackEkartShipment,
  cancelEkartShipment,
  type EkartActionState,
} from "@/app/admin/actions";

function fmtDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function EkartShipmentPanel({
  orderId,
  trackingId,
  wbn,
  status,
  lastTrackedAt,
}: {
  orderId: string;
  trackingId: string | null;
  wbn: string | null;
  status: string | null;
  lastTrackedAt: Date | null;
}) {
  const [createState, createAction, creating] = useActionState<EkartActionState, FormData>(createEkartShipment, {});
  const [trackState, trackAction, tracking] = useActionState<EkartActionState, FormData>(trackEkartShipment, {});
  const [cancelState, cancelAction, cancelling] = useActionState<EkartActionState, FormData>(cancelEkartShipment, {});

  if (!trackingId) {
    return (
      <div className="border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Ekart shipment</h2>
        <p className="mt-1 text-xs text-ink/55">Books a real shipment with Ekart and marks this order SHIPPED.</p>
        <form action={createAction} className="mt-3">
          <input type="hidden" name="orderId" value={orderId} />
          {createState?.error && (
            <p className="mb-2 border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {createState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="smallcaps bg-forest px-4 py-2 text-bone btn-fill-forest disabled:opacity-60"
          >
            {creating ? "Booking…" : "Book Ekart shipment"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-line bg-paper p-5 text-sm">
      <h2 className="smallcaps text-brass-deep">Ekart shipment</h2>
      <div className="mt-2 text-ink/80 leading-relaxed">
        <div>
          Tracking ID <span className="font-mono">{trackingId}</span>
        </div>
        {wbn && (
          <div className="text-xs text-ink/55">
            WBN <span className="font-mono">{wbn}</span>
          </div>
        )}
        <div className="mt-1 text-ink/70">{status ?? "Not yet tracked."}</div>
        {lastTrackedAt && (
          <div className="text-xs text-ink/50">Last checked {fmtDate(lastTrackedAt)}</div>
        )}
      </div>

      {(trackState?.error || cancelState?.error) && (
        <p className="mt-2 border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {trackState?.error ?? cancelState?.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <form action={trackAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <button
            type="submit"
            disabled={tracking}
            className="smallcaps border border-line px-3 py-1.5 text-xs text-ink/70 transition-colors hover:border-forest hover:text-forest disabled:opacity-60"
          >
            {tracking ? "Checking…" : "Refresh tracking"}
          </button>
        </form>
        <form
          action={cancelAction}
          onSubmit={(e) => {
            if (!window.confirm("Cancel this Ekart shipment? This can't be undone from here.")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="orderId" value={orderId} />
          <button
            type="submit"
            disabled={cancelling}
            className="smallcaps border border-line px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel shipment"}
          </button>
        </form>
      </div>
    </div>
  );
}
