"use client";

import Link from "next/link";
import Image from "next/image";
import { formatINR } from "@/lib/catalog";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { Ornament } from "@/components/ornament";

// A rail of products the shopper looked at recently (client-side, per-device).
// `excludeSlug` drops the product currently on screen so a PDP never lists
// itself. Renders nothing until there's at least one other product to show, so
// it stays invisible for first-time visitors.
export function RecentlyViewed({ excludeSlug }: { excludeSlug?: string }) {
  const { items } = useRecentlyViewed();
  const shown = items.filter((i) => i.slug !== excludeSlug);
  if (shown.length === 0) return null;

  return (
    <div className="mt-20 border-t border-line pt-12">
      <div className="text-center">
        <span className="smallcaps text-brass-deep">Recently viewed</span>
        <Ornament className="mx-auto mt-3" />
      </div>
      <div className="mt-8 flex gap-5 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-px sm:overflow-visible sm:border sm:border-line sm:bg-line lg:grid-cols-4">
        {shown.map((it) => (
          <Link
            key={it.slug}
            href={`/product/${it.slug}`}
            className="group flex w-56 shrink-0 flex-col bg-paper transition-colors hover:bg-white sm:w-auto"
          >
            <div className="relative h-44 overflow-hidden border-b border-line">
              {it.image ? (
                <Image
                  src={it.image}
                  alt={it.name}
                  fill
                  sizes="(max-width: 640px) 60vw, 260px"
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-bone text-5xl">
                  <span aria-hidden>🧴</span>
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col items-center px-4 py-5 text-center">
              <h3 className="font-serif text-lg">{it.name}</h3>
              {it.fromPaise > 0 && (
                <span className="mt-1.5 text-sm text-ink/70">from {formatINR(it.fromPaise)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
