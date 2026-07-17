"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatINR, type Product, type Variant } from "@/lib/catalog";
import {
  SUBSCRIBE_INTERVALS,
  SUBSCRIBE_SAVE_PERCENT,
  PENDING_SUBSCRIPTION_INTERVAL_KEY,
  MAX_QTY_PER_ITEM,
} from "@/lib/constants";

type DraftItem = {
  variantId: string;
  productSlug: string;
  productName: string;
  fragrance?: string;
  size: string;
  sku: string;
  image?: string;
  pricePaise: number;
  quantity: number;
};

function resolveImage(product: Product, variant: Variant): string | undefined {
  const frag = variant.fragrance;
  return (
    product.variantImages?.[`${frag ?? ""}|${variant.size}`] ??
    (frag ? product.fragranceImages?.[frag] : undefined) ??
    product.image
  );
}

// The "build a box" catalogue picker for /subscribe: freely add any product
// variant + quantity into a draft list (no server call — same pattern as
// kit-picker's synchronous addKit), pick one shared delivery interval, see a
// live discount preview, then hand off to the real checkout. Mirrors
// kit-picker.tsx's cart-building mechanics, generalized to a customer-chosen
// combination instead of an admin-curated bundle.
export function SubscriptionPlanBuilder({ products }: { products: Product[] }) {
  const { addItem, clear, authenticated } = useCart();
  const router = useRouter();
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [intervalDays, setIntervalDays] = useState(SUBSCRIBE_INTERVALS[0].days);
  const [starting, setStarting] = useState(false);

  function addToDraft(product: Product, variant: Variant) {
    if (!variant.id) return;
    const variantId = variant.id;
    setDraft((d) => {
      const existing = d.find((it) => it.variantId === variantId);
      if (existing) {
        return d.map((it) =>
          it.variantId === variantId ? { ...it, quantity: Math.min(it.quantity + 1, MAX_QTY_PER_ITEM) } : it,
        );
      }
      return [
        ...d,
        {
          variantId,
          productSlug: product.slug,
          productName: product.name,
          fragrance: variant.fragrance,
          size: variant.size,
          sku: variant.sku,
          image: resolveImage(product, variant),
          pricePaise: variant.pricePaise,
          quantity: 1,
        },
      ];
    });
  }

  function setQty(variantId: string, quantity: number) {
    setDraft((d) =>
      quantity <= 0
        ? d.filter((it) => it.variantId !== variantId)
        : d.map((it) =>
            it.variantId === variantId ? { ...it, quantity: Math.min(quantity, MAX_QTY_PER_ITEM) } : it,
          ),
    );
  }

  function removeItem(variantId: string) {
    setDraft((d) => d.filter((it) => it.variantId !== variantId));
  }

  const subtotalPaise = draft.reduce((s, it) => s + it.pricePaise * it.quantity, 0);
  const discountPaise = Math.round(subtotalPaise * (SUBSCRIBE_SAVE_PERCENT / 100));
  const totalPaise = subtotalPaise - discountPaise;

  function startSubscription() {
    if (draft.length === 0 || starting) return;
    setStarting(true);
    // Checkout treats the WHOLE cart as this subscription's contents (the
    // discount and the SubscriptionPlan it creates on settlement both derive
    // from Order.items, unfiltered) — any item already sitting in the cart
    // from an earlier, unrelated visit would otherwise get silently swept
    // into the new permanent recurring plan. Start from an empty cart.
    clear();
    for (const it of draft) {
      addItem(
        {
          variantId: it.variantId,
          sku: it.sku,
          productSlug: it.productSlug,
          name: it.productName,
          fragrance: it.fragrance,
          size: it.size,
          image: it.image,
          pricePaise: it.pricePaise,
        },
        it.quantity,
      );
    }
    try {
      sessionStorage.setItem(PENDING_SUBSCRIPTION_INTERVAL_KEY, String(intervalDays));
    } catch {
      // ignore storage errors — checkout just won't auto-detect subscription mode
    }
    router.push("/checkout");
  }

  return (
    <div className="grid gap-12 md:grid-cols-[1fr_360px]">
      {/* Catalogue */}
      <div className="space-y-10">
        {products.map((product) => (
          <div key={product.slug} className="border border-line bg-paper p-6">
            <h3 className="font-serif text-2xl">{product.name}</h3>
            {product.tagline && <p className="mt-1 text-sm text-ink/60">{product.tagline}</p>}
            <div className="mt-5 space-y-2">
              {product.variants.map((v) => {
                const inDraft = draft.find((it) => it.variantId === v.id);
                const label = [v.fragrance, v.size].filter(Boolean).join(" · ");
                const outOfStock = typeof v.stock === "number" && v.stock <= 0;
                return (
                  <div
                    key={v.id ?? v.sku}
                    className="flex items-center justify-between gap-3 border-t border-line/70 pt-2 first:border-t-0 first:pt-0"
                  >
                    <div className="text-sm">
                      <span className="text-ink/80">{label || product.name}</span>
                      <span className="ml-2 text-ink/50">{formatINR(v.pricePaise)}</span>
                    </div>
                    {inDraft ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${product.name}${label ? ` ${label}` : ""}`}
                          onClick={() => setQty(v.id!, inDraft.quantity - 1)}
                          className="h-7 w-7 border border-line text-sm hover:border-forest"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{inDraft.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${product.name}${label ? ` ${label}` : ""}`}
                          onClick={() => setQty(v.id!, inDraft.quantity + 1)}
                          className="h-7 w-7 border border-line text-sm hover:border-forest"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={outOfStock || !v.id}
                        onClick={() => addToDraft(product, v)}
                        className="smallcaps border border-forest px-4 py-1.5 text-xs text-forest btn-fill disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {outOfStock ? "Out of stock" : "Add"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Plan summary */}
      <aside className="h-fit border border-line bg-paper p-7">
        <p className="smallcaps text-brass-deep">Your subscription box</p>
        {draft.length === 0 ? (
          <p className="mt-4 text-sm text-ink/55">Add products from the catalogue to build your box.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {draft.map((it) => (
              <li key={it.variantId} className="flex items-start justify-between gap-3">
                <span className="text-ink/70">
                  {it.productName}
                  <span className="text-ink/45">
                    {" "}
                    {[it.fragrance, it.size].filter(Boolean).join(" · ")} × {it.quantity}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <span>{formatINR(it.pricePaise * it.quantity)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.variantId)}
                    aria-label={`Remove ${it.productName}`}
                    className="text-xs text-ink/40 hover:text-forest"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <label htmlFor="plan-interval" className="smallcaps mb-2 block text-ink/70">
            Delivery frequency
          </label>
          <select
            id="plan-interval"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
          >
            {SUBSCRIBE_INTERVALS.map((i) => (
              <option key={i.days} value={i.days}>
                {i.label}
              </option>
            ))}
          </select>
        </div>

        {draft.length > 0 && (
          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/70">Subtotal</dt>
              <dd>{formatINR(subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between text-forest">
              <dt>Subscribe &amp; Save {SUBSCRIBE_SAVE_PERCENT}%</dt>
              <dd>−{formatINR(discountPaise)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-serif text-lg text-ink">
              <dt>First delivery</dt>
              <dd>{formatINR(totalPaise)}</dd>
            </div>
          </dl>
        )}

        {authenticated ? (
          <button
            type="button"
            disabled={draft.length === 0 || starting}
            onClick={startSubscription}
            className="smallcaps mt-6 block w-full bg-forest px-6 py-3.5 text-center text-bone btn-fill-forest disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start subscription"}
          </button>
        ) : (
          <Link
            href="/login?next=/subscribe"
            className="smallcaps mt-6 block w-full border border-forest px-6 py-3.5 text-center text-forest btn-fill"
          >
            Sign in to build a subscription
          </Link>
        )}
        <p className="mt-3 text-xs text-ink/50">
          Pay for your first delivery now, then skip, pause or cancel future cycles anytime — no card kept on file.
        </p>
      </aside>
    </div>
  );
}
