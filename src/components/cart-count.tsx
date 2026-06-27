"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

export function CartCount() {
  const { count } = useCart();
  const [bump, setBump] = useState(false);

  // Pop when an item lands in the cart. The PDP's fly-to-cart fires this event
  // the moment the flying image arrives, so the pop is synced to the landing.
  useEffect(() => {
    function onBump() {
      setBump(false);
      requestAnimationFrame(() => setBump(true));
    }
    window.addEventListener("klen:cart-bump", onBump);
    return () => window.removeEventListener("klen:cart-bump", onBump);
  }, []);

  useEffect(() => {
    if (!bump) return;
    const t = setTimeout(() => setBump(false), 500);
    return () => clearTimeout(t);
  }, [bump]);

  // Opens the slide-out drawer (CartDrawer listens for this). Keeps id
  // "cart-link" so the PDP fly-to-cart animation still targets this element.
  return (
    <button
      id="cart-link"
      type="button"
      aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
      onClick={() => window.dispatchEvent(new Event("klen:cart-open"))}
      className={`smallcaps btn-fill inline-block border border-ink px-4 py-2.5 ${
        bump ? "cart-bump" : ""
      }`}
    >
      Cart ({count})
    </button>
  );
}