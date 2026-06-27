"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartProvider } from "@/lib/cart-context";
import { Ornament } from "@/components/ornament";

// Root error boundary: catches unexpected runtime errors in the (site) tree.
// Like not-found, it sits outside the (site) layout, so it brings its own
// header/footer + cart. `unstable_retry` re-renders the failed segment.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surface the error in logs (swap for a reporting service post-launch).
    console.error(error);
  }, [error]);

  return (
    <CartProvider>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto flex max-w-2xl flex-col items-center px-8 py-32 text-center">
          <span className="smallcaps text-brass-deep">Something spilled</span>
          <h1 className="mt-5 font-serif text-5xl md:text-6xl">
            A little mess on our end
          </h1>
          <Ornament className="mt-7" />
          <p className="mt-7 max-w-md text-lg leading-relaxed text-ink/65">
            Something went wrong while loading this page. It’s not you — give it
            another try, and if it keeps happening, we’d love to hear from you.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="smallcaps bg-forest px-9 py-4 text-bone btn-fill-forest"
            >
              Try again
            </button>
            <Link
              href="/"
              className="smallcaps border border-ink px-9 py-4 btn-fill"
            >
              Back home
            </Link>
          </div>
          {error.digest && (
            <p className="smallcaps mt-10 text-xs text-ink/35">
              Reference {error.digest}
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </CartProvider>
  );
}
