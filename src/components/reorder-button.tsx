"use client";

import { useState } from "react";
import { useCart, type CartItem } from "@/lib/cart-context";

// One-click re-add of a past order's items to the cart, then opens the cart
// drawer. `items` are pre-resolved server-side to current, buyable variants
// (see buildReorderItems); `unavailableCount` is how many original lines can no
// longer be bought, surfaced honestly rather than silently dropped.
export function ReorderButton({
  items,
  unavailableCount = 0,
  className = "",
  label = "Reorder",
}: {
  items: CartItem[];
  unavailableCount?: number;
  className?: string;
  label?: string;
}) {
  const { addItem } = useCart();
  const [done, setDone] = useState(false);

  if (items.length === 0) {
    // Nothing from this order is still buyable — say so instead of a dead button.
    return (
      <span className={`smallcaps text-ink/40 ${className}`} title="These items are no longer available">
        Unavailable
      </span>
    );
  }

  function reorder(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    for (const { quantity, ...rest } of items) addItem(rest, quantity);
    setDone(true);
    setTimeout(() => setDone(false), 1600);
    window.dispatchEvent(new Event("klen:cart-open"));
  }

  return (
    <button
      type="button"
      onClick={reorder}
      title={unavailableCount > 0 ? `${unavailableCount} item(s) no longer available were skipped` : undefined}
      className={`smallcaps border border-ink btn-fill px-5 py-2.5 transition-transform active:scale-[0.97] ${className}`}
    >
      {done ? "Added ✓" : label}
      {unavailableCount > 0 && !done ? ` (${items.length})` : ""}
    </button>
  );
}
