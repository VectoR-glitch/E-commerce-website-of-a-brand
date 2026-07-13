"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { PENDING_COUPON_KEY } from "@/lib/constants";

// Adds a subscription's item to the cart and stashes its private discount code
// so checkout auto-applies the saved price (same mechanism as kits). This is the
// "reminder → 1-tap reorder" step of the managed subscription model.
export function SubscriptionOrderNow({
  item,
  quantity,
  couponCode,
}: {
  item: {
    variantId: string;
    sku: string;
    productSlug: string;
    name: string;
    fragrance?: string;
    size: string;
    image?: string;
    pricePaise: number;
  };
  quantity: number;
  couponCode: string;
}) {
  const { addItem } = useCart();
  const [done, setDone] = useState(false);

  function orderNow() {
    addItem(item, quantity);
    try {
      sessionStorage.setItem(PENDING_COUPON_KEY, couponCode);
    } catch {
      // ignore storage errors — the discount still applies once in cart if entered
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
    window.dispatchEvent(new Event("klen:cart-open"));
  }

  return (
    <button
      type="button"
      onClick={orderNow}
      className="smallcaps bg-forest px-5 py-2.5 text-bone btn-fill-forest transition-transform active:scale-[0.97]"
    >
      {done ? "Added ✓" : "Order now"}
    </button>
  );
}
