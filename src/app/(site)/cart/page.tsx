"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/catalog";
import { MAX_ORDER_PAISE } from "@/lib/constants";
import { Reveal } from "@/components/reveal";
import { Ornament } from "@/components/ornament";
import { QuantityStepper } from "@/components/quantity-stepper";

export default function CartPage() {
  const { items, subtotalPaise, setQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-8 py-24 text-center">
        <span className="smallcaps text-brass-deep">Your Cart</span>
        <h1 className="mt-4 font-serif text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-ink/70">
          Plant-powered cleaning is a click away.
        </p>
        <Link
          href="/shop"
          className="smallcaps mt-8 inline-block bg-forest px-9 py-4 text-bone btn-fill-forest"
        >
          Shop the Collection
        </Link>
      </section>
    );
  }

  // Delivery is a flat, state-based charge added at checkout (we don't know the
  // destination state here), so the cart shows the goods subtotal only.
  const overLimit = subtotalPaise > MAX_ORDER_PAISE;

  return (
    <section className="mx-auto max-w-5xl px-8 py-16">
      <Reveal>
        <span className="smallcaps text-brass-deep">Your Cart</span>
        <h1 className="mt-4 font-serif text-4xl">Cart</h1>
        <Ornament align="left" className="mt-5" />
      </Reveal>

      <div className="mt-10 grid gap-12 md:grid-cols-[1fr_320px]">
        {/* Line items */}
        <div className="border-t border-line">
          {items.map((item, i) => (
            <Reveal
              key={item.variantId}
              delay={100 + i * 70}
              className="flex gap-5 border-b border-line py-6"
            >
              <Link
                href={`/product/${item.productSlug}`}
                className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-line bg-paper"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl">🧴</span>
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-xl">{item.name}</h2>
                    <p className="text-sm text-ink/55">
                      {[item.fragrance, item.size].filter(Boolean).join(" · ")}
                    </p>
                    <p className="smallcaps mt-1 text-ink/40">SKU {item.sku}</p>
                  </div>
                  <span className="font-serif text-lg">
                    {formatINR(item.pricePaise * item.quantity)}
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(n) => setQuantity(item.variantId, n)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="smallcaps text-ink/45 hover:text-forest"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Summary */}
        <Reveal delay={160} className="md:w-[320px]">
        <aside className="h-fit border border-line bg-paper p-7">
          <p className="smallcaps text-brass-deep">Summary</p>

          <div className="mt-5 flex justify-between border-t border-line pt-5 font-serif text-xl">
            <span>Subtotal</span>
            <span>{formatINR(subtotalPaise)}</span>
          </div>
          <p className="mt-3 text-xs text-ink/55">
            Delivery calculated at checkout — ₹64 within West Bengal, ₹160 across
            the rest of India.
          </p>
          {overLimit && (
            <p className="mt-5 border border-brass/40 bg-brass/10 px-4 py-3 text-xs text-ink/70">
              Online payment is limited to{" "}
              <span className="font-medium text-ink">
                {formatINR(MAX_ORDER_PAISE)}
              </span>{" "}
              per order. Please reduce some quantities to continue — or{" "}
              <Link href="/contact" className="text-forest underline">
                contact us
              </Link>{" "}
              for a large order.
            </p>
          )}
          {overLimit ? (
            <span
              aria-disabled="true"
              className="smallcaps mt-7 block cursor-not-allowed bg-forest/40 px-6 py-4 text-center text-bone"
            >
              Checkout
            </span>
          ) : (
            <Link
              href="/checkout"
              className="smallcaps mt-7 block bg-forest px-6 py-4 text-center text-bone btn-fill-forest"
            >
              Checkout
            </Link>
          )}
          <Link
            href="/shop"
            className="smallcaps mt-3 block py-2 text-center text-ink/55 hover:text-forest"
          >
            Continue shopping
          </Link>
        </aside>
        </Reveal>
      </div>
    </section>
  );
}