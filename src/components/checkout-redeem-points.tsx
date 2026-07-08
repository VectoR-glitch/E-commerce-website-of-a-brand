"use client";

import { useState } from "react";
import { formatINR } from "@/lib/catalog";

// Inline "redeem your points" control for checkout — converts points into a
// discount voucher via /api/account/redeem-points and hands the code straight
// to the parent's coupon-apply flow, so a customer never has to detour
// through /account/loyalty mid-order.
export function CheckoutRedeemPoints({
  balance,
  minPoints,
  pointValuePaise,
  maxRedeemablePaise,
  onApply,
}: {
  balance: number;
  minPoints: number;
  pointValuePaise: number;
  maxRedeemablePaise: number;
  onApply: (code: string, pointsUsed: number) => void;
}) {
  // Capped by both the customer's balance and what this cart's subtotal can
  // actually absorb — the minted voucher's minOrderPaise equals its own value,
  // so redeeming more than the subtotal would mint a voucher this cart can't use.
  const maxPoints = Math.min(balance, Math.floor(maxRedeemablePaise / pointValuePaise));
  const [points, setPoints] = useState(String(maxPoints));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (maxPoints < minPoints) return null;

  const parsed = Math.floor(Number(points)) || 0;
  const valid = parsed >= minPoints && parsed <= maxPoints;

  async function redeem() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/redeem-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: parsed }),
      });
      const data = await res.json();
      if (data?.ok && data.code) {
        // Left submitting — the widget unmounts once the parent's coupon
        // state flips to this code, so there's no success state to show here.
        onApply(data.code, parsed);
      } else {
        setError(data?.error ?? "Couldn't redeem those points. Please try again.");
        setSubmitting(false);
      }
    } catch {
      setError("Couldn't redeem those points. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-3 border border-line bg-white p-3">
      <p className="smallcaps text-ink/70">
        You have {balance} points · {formatINR(balance * pointValuePaise)}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value.replace(/[^\d]/g, ""))}
          className="w-24 border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest"
        />
        <button
          type="button"
          onClick={redeem}
          disabled={submitting || !valid}
          className="smallcaps shrink-0 flex-1 border border-forest px-4 py-2 text-forest btn-fill disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Redeeming…" : `Redeem for ${formatINR(parsed * pointValuePaise)} off`}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink/50">
        Min {minPoints} points · 1 point = {formatINR(pointValuePaise)}.
      </p>
      {error && <p className="mt-1.5 text-xs text-[#b3402f]">{error}</p>}
    </div>
  );
}
