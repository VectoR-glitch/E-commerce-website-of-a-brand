"use client";

import { useEffect } from "react";
import { useRecentlyViewed, type RecentItem } from "@/lib/recently-viewed";

// Invisible PDP companion — records the product a shopper is viewing into the
// client-side recently-viewed list. Keyed on the slug so re-renders (e.g.
// switching fragrance) don't re-record. Renders nothing.
export function RecentlyViewedTracker({ item }: { item: RecentItem }) {
  const { record } = useRecentlyViewed();
  useEffect(() => {
    record(item);
    // Record once per product view; display fields ride along with the slug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slug]);
  return null;
}
