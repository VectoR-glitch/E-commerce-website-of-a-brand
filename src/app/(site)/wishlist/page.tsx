"use client";

import Link from "next/link";
import Image from "next/image";
import { formatINR } from "@/lib/catalog";
import { useWishlist, wishlistKey } from "@/lib/wishlist-context";
import { Ornament } from "@/components/ornament";

export default function WishlistPage() {
  const { items, remove, clear } = useWishlist();

  return (
    <div className="mx-auto max-w-5xl px-8 py-16">
      <div className="text-center">
        <span className="smallcaps text-brass-deep">Saved for later</span>
        <h1 className="mt-2 font-serif text-4xl">Your wishlist</h1>
        <Ornament className="mx-auto mt-4" />
      </div>

      {items.length === 0 ? (
        <div className="mx-auto mt-12 max-w-md border border-line bg-paper p-10 text-center">
          <p className="text-ink/60">
            Nothing saved yet. Tap the heart on any product to keep it here.
          </p>
          <Link
            href="/shop"
            className="smallcaps mt-6 inline-block bg-forest px-6 py-2.5 text-bone btn-fill-forest"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const key = wishlistKey(it.slug, it.fragrance);
              const href = it.fragrance
                ? `/product/${it.slug}?fragrance=${encodeURIComponent(it.fragrance)}`
                : `/product/${it.slug}`;
              return (
                <div key={key} className="flex flex-col bg-paper">
                  <Link href={href} className="group relative block h-56 overflow-hidden border-b border-line">
                    {it.image ? (
                      <Image
                        src={it.image}
                        alt={it.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 300px"
                        className="object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-bone text-6xl">
                        <span aria-hidden>🧴</span>
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col items-center px-6 py-6 text-center">
                    <h3 className="font-serif text-xl">{it.name}</h3>
                    {it.fragrance && (
                      <p className="mt-1 text-sm text-ink/60">{it.fragrance}</p>
                    )}
                    {it.fromPaise > 0 && (
                      <span className="mt-2 font-serif text-lg">{formatINR(it.fromPaise)}</span>
                    )}
                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={href}
                        className="smallcaps btn-fill border border-ink px-5 py-2.5"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(key)}
                        className="smallcaps text-ink/50 transition-colors hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={clear}
              className="smallcaps text-ink/45 transition-colors hover:text-red-600"
            >
              Clear wishlist
            </button>
          </div>
        </>
      )}
    </div>
  );
}
