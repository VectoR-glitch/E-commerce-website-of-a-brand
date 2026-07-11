"use client";

import { useState } from "react";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-context";

// Quantity control: +/− buttons plus a directly editable number field. The
// field keeps a local draft so a customer can clear it and type freely; the
// cart only updates on a valid number (live for digits, committed on blur/Enter).
// Shared by the full cart page and the slide-out cart drawer.
export function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);

  // Re-sync the draft when the value changes elsewhere (e.g. the +/− buttons),
  // during render — React's recommended alternative to a syncing effect.
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  function commit(raw: string) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      setDraft(String(value)); // empty/invalid → snap back, never silently drop
      return;
    }
    const capped = Math.min(n, MAX_QTY_PER_ITEM);
    setDraft(String(capped));
    if (capped !== value) onChange(capped);
  }

  return (
    <div className="flex items-center border border-line">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => {
          // At qty 1, − removes the line entirely — confirm so a stray click
          // (easy to make right next to +) doesn't silently drop the item.
          if (value === 1 && !window.confirm("Remove this item from your cart?")) return;
          onChange(value - 1);
        }}
        className="px-3 py-1.5 text-lg hover:bg-bone"
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label="Quantity"
        value={draft}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
          setDraft(digits);
          const n = parseInt(digits, 10);
          if (Number.isFinite(n) && n >= 1) onChange(Math.min(n, MAX_QTY_PER_ITEM));
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-14 border-x border-line bg-transparent py-1.5 text-center text-sm tabular-nums outline-none focus:bg-bone"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className="px-3 py-1.5 text-lg hover:bg-bone"
      >
        +
      </button>
    </div>
  );
}
