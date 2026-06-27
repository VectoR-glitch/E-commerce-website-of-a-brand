import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartProvider } from "@/lib/cart-context";
import { Ornament } from "@/components/ornament";

// Root not-found: rendered for unmatched URLs and notFound() calls. It sits
// outside the (site) layout, so it brings its own header/footer + cart.
export default function NotFound() {
  return (
    <CartProvider>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto flex max-w-2xl flex-col items-center px-8 py-32 text-center">
          <span className="smallcaps text-brass-deep">Error 404</span>
          <h1 className="mt-5 font-serif text-5xl md:text-6xl">
            This page slipped down the drain
          </h1>
          <Ornament className="mt-7" />
          <p className="mt-7 max-w-md text-lg leading-relaxed text-ink/65">
            The page you’re looking for has been cleaned away — or never existed.
            Let’s get you back to something fresh.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/"
              className="smallcaps bg-forest px-9 py-4 text-bone btn-fill-forest"
            >
              Back home
            </Link>
            <Link
              href="/shop"
              className="smallcaps border border-ink px-9 py-4 btn-fill"
            >
              Shop the collection
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </CartProvider>
  );
}
