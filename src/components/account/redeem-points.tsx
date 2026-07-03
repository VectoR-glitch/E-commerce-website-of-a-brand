"use client";

import { useActionState, useState } from "react";
import { redeemPointsAction, type RedeemState } from "@/app/actions/loyalty";
import { formatINR } from "@/lib/catalog";

// Redeem-points panel for the loyalty page. Converts points into a discount
// voucher the customer applies at checkout. The server debits atomically and
// returns the minted code; we show it with a one-tap copy.
export function RedeemPoints({
  balance,
  minPoints,
  pointValuePaise,
}: {
  balance: number;
  minPoints: number;
  pointValuePaise: number;
}) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeemPointsAction, undefined);
  const [points, setPoints] = useState(String(balance));
  const [copied, setCopied] = useState(false);
  // On a successful redeem the balance drops — clear the input for the fresh
  // (lower) balance. Adjust-during-render (guarded by the minted code) is React's
  // recommended alternative to a setState-in-effect for "reset on prop/result".
  const [clearedFor, setClearedFor] = useState<string | undefined>(undefined);
  if (state?.ok && state.code && state.code !== clearedFor) {
    setClearedFor(state.code);
    setPoints("");
  }

  const parsed = Math.floor(Number(points)) || 0;
  const valid = parsed >= minPoints && parsed <= balance;
  const valuePaise = parsed * pointValuePaise;

  if (balance < minPoints) {
    return (
      <p className="text-sm text-ink/60">
        Earn at least <strong>{minPoints} points</strong> to redeem them for a
        discount voucher. You have {balance}.
      </p>
    );
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the code is visible to copy manually
    }
  }

  return (
    <div>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="smallcaps mb-2 block text-ink/70">Points to redeem</span>
          <input
            name="points"
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/[^\d]/g, ""))}
            className="w-36 border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
            placeholder={`${minPoints}+`}
          />
        </label>
        <button
          type="submit"
          disabled={pending || !valid}
          className="smallcaps border border-forest px-5 py-2.5 text-forest btn-fill disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Redeeming…" : valid ? `Redeem for ${formatINR(valuePaise)} off` : "Redeem"}
        </button>
      </form>
      <p className="mt-2 text-xs text-ink/50">
        Min {minPoints} points · 1 point = {formatINR(pointValuePaise)}. Your voucher
        is single-use and applies at checkout.
      </p>

      {state?.error && <p className="mt-3 text-sm text-[#b3402f]">{state.error}</p>}
      {state?.ok && state.code && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-forest/30 bg-forest/5 px-4 py-3">
          <span className="text-sm text-forest">
            Voucher ready — apply <strong className="font-mono">{state.code}</strong> at checkout.
          </span>
          <button
            type="button"
            onClick={() => copy(state.code!)}
            className="smallcaps shrink-0 border border-forest px-4 py-2 text-xs text-forest btn-fill"
          >
            {copied ? "Copied ✓" : "Copy code"}
          </button>
        </div>
      )}
    </div>
  );
}
