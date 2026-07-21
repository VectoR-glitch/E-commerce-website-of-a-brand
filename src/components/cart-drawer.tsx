"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/catalog";
import { QuantityStepper } from "@/components/quantity-stepper";

// Slide-out cart. Opened by the header cart button via the `klen:cart-open`
// window event (same lightweight event pattern as `klen:cart-bump`). The full
// /cart page remains the canonical, linkable cart; this is the quick-glance view.
export function CartDrawer() {
  const { items, subtotalPaise, setQuantity, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Open on the header's request.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("klen:cart-open", onOpen);
    return () => window.removeEventListener("klen:cart-open", onOpen);
  }, []);

  // While open: lock body scroll, close on Esc, move focus into the panel,
  // trap Tab within it (the rest of the page is only visually obscured by
  // the overlay — without this, Tab can walk past the drawer's last link
  // into the hidden header/main content behind it), and restore focus to
  // whatever triggered the drawer (the header cart button) on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusable(): HTMLElement[] {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-bone shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="smallcaps text-brass-deep">Your Cart</span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center text-ink/70 transition-colors hover:text-forest"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-serif text-2xl">Your cart is empty</p>
            <p className="mt-2 text-sm text-ink/55">
              Plant-powered cleaning is a click away.
            </p>
            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              className="smallcaps mt-7 inline-block bg-forest px-8 py-3.5 text-bone btn-fill-forest"
            >
              Shop the Collection
            </Link>
          </div>
        ) : (
          <>
            {/* Line items */}
            <div className="flex-1 overflow-y-auto px-6">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-4 border-b border-line py-5">
                  <Link
                    href={`/product/${item.productSlug}`}
                    onClick={() => setOpen(false)}
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-line bg-paper"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-2xl">🧴</span>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-base">{item.name}</h3>
                        <p className="text-xs text-ink/55">
                          {[item.fragrance, item.size].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 font-serif text-sm">
                        {formatINR(item.pricePaise * item.quantity)}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
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
                </div>
              ))}
            </div>

            {/* Footer */}
            <footer className="border-t border-line px-6 py-5">
              <div className="flex justify-between font-serif text-lg">
                <span>Subtotal</span>
                <span>{formatINR(subtotalPaise)}</span>
              </div>
              <p className="mt-1 text-xs text-ink/45">
                Delivery calculated live at checkout, based on your pincode.
              </p>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="smallcaps mt-4 block bg-forest px-6 py-4 text-center text-bone btn-fill-forest"
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="smallcaps mt-2 block py-1.5 text-center text-ink/55 hover:text-forest"
              >
                View full cart
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
