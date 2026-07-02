"use client";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import type { BundleLineItem } from "@/lib/bundles";

// Adds every component of a kit to the cart, then stashes the kit's coupon code
// so checkout auto-applies the bundle discount. (Checkout reads and clears the
// sessionStorage key on mount.)
export const PENDING_COUPON_KEY = "klenich.pendingCoupon";

export function AddBundleButton({
  items,
  couponCode,
}: {
  items: BundleLineItem[];
  couponCode: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        for (const it of items) {
          addItem(
            {
              variantId: it.variantId,
              sku: it.sku,
              productSlug: it.productSlug,
              name: it.productName,
              fragrance: it.fragrance,
              size: it.size,
              pricePaise: it.pricePaise,
            },
            it.quantity,
          );
        }
        try {
          sessionStorage.setItem(PENDING_COUPON_KEY, couponCode);
        } catch {
          // ignore storage errors — the code can still be entered manually
        }
        setAdded(true);
        setTimeout(() => setAdded(false), 1800);
      }}
      className="smallcaps w-full bg-forest px-6 py-3 text-center text-bone btn-fill-forest"
    >
      {added ? "Added ✓" : "Add kit to cart"}
    </button>
  );
}
