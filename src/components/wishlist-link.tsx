"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist-context";

// Header wishlist entry point — a heart with the saved count. Hidden until at
// least one item is saved, so it stays out of the way for shoppers who don't
// use it. Count is client-only (localStorage), like the cart.
export function WishlistLink() {
  const { count } = useWishlist();
  if (count === 0) return null;

  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist, ${count} item${count === 1 ? "" : "s"}`}
      className="btn-fill relative inline-flex items-center border border-ink px-3 py-2.5 text-brass-deep transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M10 17s-6.2-3.9-8-7.4C0.7 7 1.6 3.9 4.4 3.2 6.2 2.8 8 3.6 10 5.7c2-2.1 3.8-2.9 5.6-2.5 2.8 0.7 3.7 3.8 2.4 6.4C16.2 13.1 10 17 10 17z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="smallcaps ml-1.5 text-xs">{count}</span>
    </Link>
  );
}
