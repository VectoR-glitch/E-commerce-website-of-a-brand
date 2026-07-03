"use client";

import { useWishlist, type WishlistItem } from "@/lib/wishlist-context";

// Heart toggle for saving a product to the wishlist. Two looks:
//  · "overlay"  — floating circle for the top-right of a product card
//  · "inline"   — bordered pill button for the PDP details column
// On a card the button sits inside a <Link>, so we stop the click from
// navigating/bubbling to the parent.
export function WishlistButton({
  item,
  variant = "overlay",
  className = "",
}: {
  item: WishlistItem;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const saved = has(item.slug, item.fragrance);
  const label = saved ? "Remove from wishlist" : "Save to wishlist";

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  };

  const heart = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill={saved ? "currentColor" : "none"}
      aria-hidden="true"
      className="transition-transform duration-150 group-active:scale-90"
    >
      <path
        d="M10 17s-6.2-3.9-8-7.4C0.7 7 1.6 3.9 4.4 3.2 6.2 2.8 8 3.6 10 5.7c2-2.1 3.8-2.9 5.6-2.5 2.8 0.7 3.7 3.8 2.4 6.4C16.2 13.1 10 17 10 17z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        className={`smallcaps group flex items-center gap-2 border px-5 py-4 transition-colors ${
          saved
            ? "border-brass bg-brass/10 text-brass-deep"
            : "border-line text-ink/70 hover:border-ink"
        } ${className}`}
      >
        {heart}
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`group absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition-colors ${
        saved
          ? "border-brass/40 bg-bone/90 text-brass-deep"
          : "border-line bg-bone/80 text-ink/50 hover:text-brass-deep"
      } ${className}`}
    >
      {heart}
    </button>
  );
}
