"use client";
import { useRef, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/catalog";
import { flyToCart } from "@/lib/fly-to-cart";
import type { BundleSlot } from "@/lib/bundles";

// "Add kit to cart" stashes the kit's coupon so checkout auto-applies the
// discount (gated server-side on the kit's items being present).
export const PENDING_COUPON_KEY = "klenich.pendingCoupon";

export function KitPicker({
  slots,
  discountType,
  discountValue,
  couponCode,
  imageUrl,
}: {
  slots: BundleSlot[];
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  couponCode: string;
  imageUrl?: string | null;
}) {
  const { addItem } = useCart();
  const btnRef = useRef<HTMLButtonElement>(null);
  // For each product slot, the chosen variantId (defaults to the first option).
  const [choice, setChoice] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of slots) if (s.kind === "product") init[s.id] = s.options[0]?.variantId ?? "";
    return init;
  });
  const [added, setAdded] = useState(false);

  const resolved = slots.map((s) => {
    const option =
      s.kind === "exact"
        ? s.option
        : s.options.find((o) => o.variantId === choice[s.id]) ?? s.options[0];
    return { slot: s, option };
  });

  const subtotal = resolved.reduce((sum, r) => sum + (r.option?.pricePaise ?? 0) * r.slot.quantity, 0);
  const discount = Math.min(
    discountType === "PERCENT" ? Math.round(subtotal * (discountValue / 100)) : discountValue,
    subtotal,
  );
  const total = subtotal - discount;
  const allChosen = resolved.every((r) => r.option);

  function addKit() {
    for (const r of resolved) {
      if (!r.option) continue;
      addItem(
        {
          variantId: r.option.variantId,
          sku: r.option.sku,
          productSlug: r.slot.productSlug,
          name: r.slot.productName,
          fragrance: r.option.fragrance,
          size: r.option.size,
          pricePaise: r.option.pricePaise,
        },
        r.slot.quantity,
      );
    }
    try {
      sessionStorage.setItem(PENDING_COUPON_KEY, couponCode);
    } catch {
      // ignore storage errors — the code can still be entered manually
    }
    // Arc a clone of the kit photo into the header cart (matches the PDP).
    flyToCart(btnRef.current, imageUrl ?? undefined);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="flex flex-1 flex-col">
      <ul className="space-y-2.5 text-sm">
        {resolved.map(({ slot, option }) => (
          <li key={slot.id}>
            <div className="flex justify-between gap-3 text-ink/75">
              <span>
                {slot.quantity}× {slot.productName}
                {slot.kind === "exact" && option && (
                  <span className="text-ink/50"> — {option.label}</span>
                )}
                {slot.kind === "product" && (
                  <span className="text-ink/45"> — your choice{slot.size ? ` · ${slot.size}` : ""}</span>
                )}
              </span>
              <span className="whitespace-nowrap">
                {formatINR((option?.pricePaise ?? 0) * slot.quantity)}
              </span>
            </div>
            {slot.kind === "product" && (
              <select
                value={choice[slot.id]}
                onChange={(e) => setChoice((c) => ({ ...c, [slot.id]: e.target.value }))}
                className="mt-1.5 w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest"
              >
                {slot.options.map((o) => (
                  <option key={o.variantId} value={o.variantId}>{o.label}</option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <div className="mt-5 flex flex-wrap items-baseline gap-2.5 border-t border-line pt-4">
          <span className="font-serif text-2xl">{formatINR(total)}</span>
          {discount > 0 && (
            <>
              <span className="text-sm text-ink/45 line-through">{formatINR(subtotal)}</span>
              <span className="smallcaps text-xs text-forest">save {formatINR(discount)}</span>
            </>
          )}
        </div>
        <button
          ref={btnRef}
          type="button"
          onClick={addKit}
          disabled={!allChosen}
          className={`smallcaps mt-4 w-full bg-forest px-6 py-3 text-center text-bone btn-fill-forest transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${added ? "scale-[1.02]" : ""}`}
        >
          <span className={`inline-block transition-transform ${added ? "animate-[kit-pop_0.35s_ease-out]" : ""}`}>
            {added ? "Added ✓" : "Add kit to cart"}
          </span>
        </button>
      </div>
    </div>
  );
}
