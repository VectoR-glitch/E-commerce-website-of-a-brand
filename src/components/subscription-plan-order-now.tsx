"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { PENDING_COUPON_KEY } from "@/lib/constants";

// Adds every item in a subscription plan to the cart and stashes the plan's
// private discount code so checkout auto-applies it — the multi-item sibling
// of SubscriptionOrderNow. This is an ordinary swappable-discount checkout
// from here on (the plan already exists; no activation-linkage concern for a
// reorder, unlike the plan's founding order).
export function SubscriptionPlanOrderNow({
  items,
  couponCode,
}: {
  items: {
    variantId: string;
    sku: string;
    productSlug: string;
    name: string;
    fragrance?: string;
    size: string;
    image?: string;
    pricePaise: number;
    quantity: number;
  }[];
  couponCode: string;
}) {
  const { addItem } = useCart();
  const [done, setDone] = useState(false);

  function orderNow() {
    for (const item of items) {
      addItem(
        {
          variantId: item.variantId,
          sku: item.sku,
          productSlug: item.productSlug,
          name: item.name,
          fragrance: item.fragrance,
          size: item.size,
          image: item.image,
          pricePaise: item.pricePaise,
        },
        item.quantity,
      );
    }
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
