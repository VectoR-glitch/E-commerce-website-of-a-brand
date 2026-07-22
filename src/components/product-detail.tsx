"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FRAGRANCE_HEX, formatINR, type Product } from "@/lib/catalog";
import {
  LOW_STOCK_THRESHOLD,
  SUBSCRIBE_SAVE_PERCENT,
  SUBSCRIBE_INTERVALS,
  MANUFACTURER_DECLARATION,
} from "@/lib/constants";
import { useCart } from "@/lib/cart-context";
import { flyToCart } from "@/lib/fly-to-cart";
import { createSubscription } from "@/app/actions/subscriptions";
import { Ornament } from "@/components/ornament";
import { WishlistButton } from "@/components/wishlist-button";
import { BackInStockForm } from "@/components/back-in-stock-form";
import { DeliveryCheck } from "@/components/delivery-check";

export function ProductDetail({
  product,
  initialFragrance,
  defaultEmail = "",
}: {
  product: Product;
  initialFragrance?: string;
  /** signed-in customer's email, to prefill the back-in-stock form */
  defaultEmail?: string;
}) {
  const hasFragrance = product.fragrances.length > 0;
  const { addItem, authenticated } = useCart();
  const imageRef = useRef<HTMLDivElement>(null);
  const addRowRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement>(null);
  // Hover-to-zoom: magnify the image toward the cursor on desktop. `null` while
  // the pointer is away; otherwise the cursor position as 0–100% of the frame,
  // used as the transform-origin so the area under the cursor scales up.
  const [hoverZoom, setHoverZoom] = useState<{ x: number; y: number } | null>(null);
  // Which image in the current gallery is shown — reset to 0 whenever the
  // fragrance/size selection changes the gallery's contents.
  const [activeIndex, setActiveIndex] = useState(0);
  const [fragrance, setFragrance] = useState<string | undefined>(
    hasFragrance
      ? initialFragrance && product.fragrances.includes(initialFragrance)
        ? initialFragrance
        : product.fragrances[0]
      : undefined,
  );
  const [size, setSize] = useState<string>(product.sizes[0]);
  // Subscribe & save state.
  const [subInterval, setSubInterval] = useState<number>(SUBSCRIBE_INTERVALS[0].days);
  const [subOk, setSubOk] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subPending, startSub] = useTransition();

  const selected = useMemo(
    () =>
      product.variants.find(
        (v) => v.size === size && (!hasFragrance || v.fragrance === fragrance),
      ),
    [product.variants, size, fragrance, hasFragrance],
  );
  const outOfStock =
    !!selected && typeof selected.stock === "number" && selected.stock <= 0;
  // Genuine low-stock cue — only from real numbers, so it stays truthful.
  const lowStock =
    !!selected &&
    typeof selected.stock === "number" &&
    selected.stock > 0 &&
    selected.stock <= LOW_STOCK_THRESHOLD;

  // Show the photo matching the selected fragrance AND size, with fallbacks.
  // Used for cart/wishlist thumbnails, which want one representative image
  // regardless of which gallery photo is currently being looked at.
  const image =
    product.variantImages?.[`${fragrance ?? ""}|${size}`] ||
    (fragrance ? product.fragranceImages?.[fragrance] : undefined) ||
    product.image;
  // Every photo uploaded for the selected fragrance/size (falls back the same
  // way `image` does, so a product with only one photo per key still works).
  const galleryImages = useMemo(() => {
    const arr =
      product.imageGallery?.[`${fragrance ?? ""}|${size}`] ||
      (fragrance ? product.imageGallery?.[fragrance] : undefined) ||
      product.imageGallery?.[""];
    return arr && arr.length ? arr : image ? [image] : [];
  }, [product.imageGallery, fragrance, size, image]);
  const activeImage = galleryImages[activeIndex] ?? galleryImages[0] ?? image;
  // A newly-added product may have no image yet — fall back to the emoji
  // placeholder rather than rendering <Image src="">.
  const hasImage = Boolean(activeImage);

  function showImage(i: number) {
    setActiveIndex(((i % galleryImages.length) + galleryImages.length) % galleryImages.length);
  }

  // Reveal the mobile sticky bar once the main add-to-cart row scrolls off-screen.
  useEffect(() => {
    const el = addRowRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) =>
        setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Lightbox: lock body scroll, trap focus, and close on Esc while the zoomed
  // view is open. The close button is the only focusable element inside, so
  // trapping just means keeping focus pinned there rather than letting Tab
  // escape to the page underneath; focus returns to the zoom trigger on close.
  useEffect(() => {
    if (!zoomed) return;
    const trigger = zoomTriggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lightboxCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
      else if (e.key === "Tab") {
        e.preventDefault();
        lightboxCloseRef.current?.focus();
      } else if (e.key === "ArrowRight") showImage(activeIndex + 1);
      else if (e.key === "ArrowLeft") showImage(activeIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-binding on every activeIndex change would thrash focus/scroll-lock; showImage/galleryImages.length are derived from it anyway
  }, [zoomed, activeIndex]);

  function addToCart(source: HTMLElement | null) {
    if (!selected || outOfStock || !selected.id) return;
    flyToCart(source, image);
    addItem({
      variantId: selected.id,
      sku: selected.sku,
      productSlug: product.slug,
      name: product.name,
      fragrance: selected.fragrance,
      size: selected.size,
      image,
      pricePaise: selected.pricePaise,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  const subDiscountedPaise = selected
    ? Math.round(selected.pricePaise * (1 - SUBSCRIBE_SAVE_PERCENT / 100))
    : 0;

  function subscribe() {
    if (!selected?.id) return;
    const variantId = selected.id;
    setSubError(null);
    startSub(async () => {
      const res = await createSubscription({ variantId, intervalDays: subInterval, quantity: 1 });
      if (res?.ok) setSubOk(true);
      else setSubError(res?.error ?? "Couldn't set up the subscription. Please try again.");
    });
  }

  // Switching the variant invalidates the "Subscribed ✓" confirmation.
  // Fragrance/size options are the UNION across all of a product's variants,
  // not a per-variant cross product — so a fragrance and a size can each be
  // individually valid while their combination isn't (e.g. one fragrance only
  // ships in a size the other doesn't). Snap the OTHER axis to a size/
  // fragrance that's actually available for the one just picked, instead of
  // silently landing on a dead combination (price "—", Add to Cart disabled
  // with no explanation).
  function pickFragrance(f: string) {
    setFragrance(f);
    const availableSizes = product.variants.filter((v) => v.fragrance === f).map((v) => v.size);
    if (availableSizes.length > 0 && !availableSizes.includes(size)) {
      setSize(availableSizes[0]);
    }
    setActiveIndex(0);
    setSubOk(false);
    setSubError(null);
  }
  function pickSize(s: string) {
    setSize(s);
    if (hasFragrance) {
      const availableFragrances = product.variants
        .filter((v) => v.size === s)
        .map((v) => v.fragrance)
        .filter((f): f is string => Boolean(f));
      if (availableFragrances.length > 0 && fragrance && !availableFragrances.includes(fragrance)) {
        setFragrance(availableFragrances[0]);
      }
    }
    setActiveIndex(0);
    setSubOk(false);
    setSubError(null);
  }

  return (
    <>
    <div className="mt-10 grid gap-16 md:grid-cols-2">
      {/* Visual — fragrance-aware */}
      <div>
      <div
        ref={imageRef}
        onMouseMove={
          hasImage
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoverZoom({
                  x: ((e.clientX - rect.left) / rect.width) * 100,
                  y: ((e.clientY - rect.top) / rect.height) * 100,
                });
              }
            : undefined
        }
        onMouseLeave={() => setHoverZoom(null)}
        className="relative min-h-[460px] overflow-hidden border border-line bg-paper"
      >
        {hasImage ? (
          <>
            <Image
              key={activeImage}
              src={activeImage}
              alt={`${product.name}${fragrance ? ` — ${fragrance}` : ""}${galleryImages.length > 1 ? ` — photo ${activeIndex + 1} of ${galleryImages.length}` : ""}`}
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              style={
                hoverZoom
                  ? {
                      transform: "scale(2)",
                      transformOrigin: `${hoverZoom.x}% ${hoverZoom.y}%`,
                    }
                  : undefined
              }
              className="object-contain variant-in transition-transform duration-200 ease-out"
              priority
            />
            {/* Tap/click to enlarge — full-cover button keeps it keyboard-accessible. */}
            <button
              ref={zoomTriggerRef}
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="Zoom image"
              className="group absolute inset-0 cursor-zoom-in"
            >
              <span className="smallcaps absolute bottom-3 right-3 flex items-center gap-1.5 border border-line bg-bone/85 px-2.5 py-1 text-ink/70 opacity-100 backdrop-blur transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7.6 7.6L10.5 10.5M5 3.5v3M3.5 5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Zoom
              </span>
            </button>
            {/* Prev/next — only when there's more than one photo to cycle through */}
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => showImage(activeIndex - 1)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-bone/85 text-ink/70 backdrop-blur transition-colors hover:text-forest"
                >
                  <svg width="9" height="14" viewBox="0 0 9 14" fill="none" aria-hidden="true">
                    <path d="M8 1L2 7l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => showImage(activeIndex + 1)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-bone/85 text-ink/70 backdrop-blur transition-colors hover:text-forest"
                >
                  <svg width="9" height="14" viewBox="0 0 9 14" fill="none" aria-hidden="true">
                    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="smallcaps absolute bottom-3 left-3 bg-bone/85 px-2 py-1 text-ink/70 backdrop-blur">
                  {activeIndex + 1} / {galleryImages.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-8xl">
            <span aria-hidden>{product.placeholder}</span>
          </div>
        )}
      </div>
      {/* Thumbnails — clickable, only shown when there's a gallery to browse */}
      {galleryImages.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {galleryImages.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => showImage(i)}
              aria-label={`Show photo ${i + 1} of ${galleryImages.length}`}
              aria-current={i === activeIndex}
              className={`relative h-16 w-16 shrink-0 overflow-hidden border bg-paper transition-colors ${
                i === activeIndex ? "border-forest" : "border-line hover:border-ink/40"
              }`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Details */}
      <div className="flex flex-col">
        <span className="smallcaps text-brass-deep">{product.claim}</span>
        <h1 className="mt-4 font-serif text-5xl">{product.name}</h1>
        <p className="mt-3 text-lg text-ink/70">{product.tagline}</p>
        <Ornament align="left" className="mt-5" />

        <div className="mt-10 flex flex-col gap-8">
          {hasFragrance && (
            <div>
              <p className="smallcaps mb-3 text-ink/70">Fragrance</p>
              <div className="flex flex-wrap gap-3">
                {product.fragrances.map((f) => {
                  const active = f === fragrance;
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pickFragrance(f)}
                      className={`flex items-center gap-2 border px-4 py-2.5 text-sm transition-colors ${
                        active
                          ? "border-forest bg-forest text-bone"
                          : "border-line hover:border-ink"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ background: FRAGRANCE_HEX[f] }}
                      />
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="smallcaps mb-3 text-ink/70">Size</p>
            <div className="flex flex-wrap gap-3">
              {product.sizes.map((s) => {
                const active = s === size;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pickSize(s)}
                    className={`border px-5 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-forest bg-forest text-bone"
                        : "border-line hover:border-ink"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            ref={addRowRef}
            className="flex items-center justify-between border-t border-line pt-7"
          >
            <div className="flex flex-col">
              <span className="font-serif text-3xl">
                {selected ? formatINR(selected.pricePaise) : "—"}
              </span>
              {selected && (
                <span className="smallcaps mt-1.5 text-ink/60">
                  SKU {selected.sku}
                </span>
              )}
              {lowStock && (
                <span className="smallcaps mt-1.5 text-brass-deep">
                  Only {selected!.stock} left
                </span>
              )}
            </div>
            <div className="flex items-stretch gap-3">
              <WishlistButton
                variant="inline"
                item={{
                  slug: product.slug,
                  fragrance,
                  name: product.name,
                  image,
                  fromPaise: selected?.pricePaise ?? 0,
                }}
              />
              <button
                type="button"
                disabled={!selected || outOfStock}
                onClick={() => addToCart(imageRef.current)}
                className="smallcaps bg-forest px-9 py-4 text-bone btn-fill-forest disabled:cursor-not-allowed disabled:opacity-40"
              >
                {outOfStock ? "Out of Stock" : justAdded ? "Added ✓" : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>

        {/* Delivery estimate — check serviceability + fee before adding to cart */}
        {selected?.id && <DeliveryCheck key={selected.id} variantId={selected.id} />}

        {/* Back-in-stock alert — only when the chosen variant is sold out */}
        {outOfStock && selected?.id && (
          <BackInStockForm
            key={selected.id}
            variantId={selected.id}
            variantLabel={[fragrance, size].filter(Boolean).join(" · ")}
            defaultEmail={defaultEmail}
          />
        )}

        {/* Subscribe & save */}
        {selected && (
          <div className="mt-8 border border-brass/30 bg-brass/[0.05] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="smallcaps text-brass-deep">
                Subscribe &amp; save {SUBSCRIBE_SAVE_PERCENT}%
              </span>
              <span className="text-sm text-ink/60">
                <span className="font-serif text-lg text-ink">{formatINR(subDiscountedPaise)}</span>
                <span className="ml-2 text-ink/45 line-through">{formatINR(selected.pricePaise)}</span>
                <span className="ml-1">/ delivery</span>
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/65">
              Scheduled deliveries at a standing discount. Skip, pause or cancel anytime —
              no card kept on file; we email you before each delivery.
            </p>
            {authenticated ? (
              subOk ? (
                <p className="mt-3 text-sm text-forest">
                  Subscribed ✓ ·{" "}
                  <Link href="/account/subscriptions" className="underline">
                    Manage in your account
                  </Link>
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    value={subInterval}
                    onChange={(e) => setSubInterval(Number(e.target.value))}
                    className="border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
                  >
                    {SUBSCRIBE_INTERVALS.map((i) => (
                      <option key={i.days} value={i.days}>{i.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={subscribe}
                    disabled={subPending || outOfStock}
                    className="smallcaps border border-brass bg-brass/10 px-6 py-2.5 text-brass-deep transition-colors hover:bg-brass/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {subPending ? "Setting up…" : "Subscribe"}
                  </button>
                </div>
              )
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`}
                className="smallcaps mt-4 inline-block border border-brass bg-brass/10 px-6 py-2.5 text-brass-deep transition-colors hover:bg-brass/20"
              >
                Sign in to subscribe
              </Link>
            )}
            {subError && <p className="mt-2 text-sm text-red-600">{subError}</p>}
          </div>
        )}

        <div className="mt-8 space-y-2 border-t border-line pt-7 text-sm text-ink/70">
          <p>🌱 Plant-powered formula, made in India</p>
          <p>🚚 Dispatched within 1 working day · delivery rates calculated live for your pincode</p>
          <p>↩️ Returns on damaged or wrong items</p>
        </div>
      </div>
    </div>

    {/* Editorial depth — description, benefits, ritual, safety */}
    {(product.description ||
      product.benefits?.length ||
      product.howToUse?.length) && (
      <div className="mt-20 grid gap-14 border-t border-line pt-16 md:grid-cols-2">
        <div>
          <span className="smallcaps text-brass-deep">About this product</span>
          <Ornament align="left" className="mt-3 mb-7" />
          {product.description && (
            <p className="text-lg leading-relaxed text-ink/75">
              {product.description}
            </p>
          )}
          {product.benefits && product.benefits.length > 0 && (
            <ul className="mt-9 space-y-3.5">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink/80">
                  <span className="mt-2 h-2 w-2 shrink-0 rotate-45 bg-brass" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {product.howToUse && product.howToUse.length > 0 && (
          <div>
            <span className="smallcaps text-brass-deep">The Ritual</span>
            <Ornament align="left" className="mt-3 mb-7" />
            <ol className="space-y-7">
              {product.howToUse.map((step, i) => (
                <li key={i} className="flex gap-5">
                  <span className="font-serif text-3xl leading-none text-brass-deep/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="pt-1 leading-relaxed text-ink/75">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            {product.safety && (
              <p className="mt-9 border-l-2 border-brass/50 bg-brass/[0.06] px-5 py-4 text-sm leading-relaxed text-ink/65">
                <strong className="smallcaps text-brass-deep">Safety</strong>
                <br />
                {product.safety}
              </p>
            )}
          </div>
        )}
      </div>
    )}

    {/* Brand promise badges */}
    <div className="mt-16 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
      {[
        ["🇮🇳", "Made in India"],
        ["🌱", "Plant-Powered"],
        ["🐇", "Not Tested on Animals"],
        ["📦", "Ships in 1 Day"],
      ].map(([icon, label]) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 bg-paper px-4 py-7 text-center"
        >
          <span className="text-2xl">{icon}</span>
          <span className="smallcaps text-ink/70">{label}</span>
        </div>
      ))}
    </div>

    {/* Legal Metrology (Packaged Commodities) Rules, 2011 declarations —
        mandatory for pre-packaged consumer goods. */}
    {selected && (
      <div className="mt-10 border border-line bg-paper/60 p-5 text-xs leading-relaxed text-ink/60">
        <p className="smallcaps mb-2 text-ink/70">Product declarations</p>
        <p>
          MRP {formatINR(selected.pricePaise)} (incl. of all taxes) · Net Qty {size}
        </p>
        <p className="mt-1">
          Manufactured &amp; packed by: {MANUFACTURER_DECLARATION.name},{" "}
          {MANUFACTURER_DECLARATION.addressLines.join(" ")}
        </p>
        <p className="mt-1">Month &amp; year of manufacture/packing: see product label</p>
        <p className="mt-1">
          Consumer care: {MANUFACTURER_DECLARATION.consumerCareEmail} ·{" "}
          {MANUFACTURER_DECLARATION.consumerCarePhone}
        </p>
      </div>
    )}

    {/* Mobile sticky add-to-cart — appears after the main row scrolls away */}
    <div
      ref={stickyRef}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone/95 px-5 py-3 backdrop-blur transition-transform duration-300 ease-out md:hidden ${
        showSticky ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-serif text-base leading-tight">
            {product.name}
          </span>
          <span className="text-sm text-ink/55">
            {selected ? formatINR(selected.pricePaise) : "—"}
            {lowStock && (
              <span className="text-brass-deep"> · Only {selected!.stock} left</span>
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={!selected || outOfStock}
          onClick={() => addToCart(stickyRef.current)}
          className="smallcaps shrink-0 bg-forest px-6 py-3 text-bone btn-fill-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          {outOfStock ? "Out of Stock" : justAdded ? "Added ✓" : "Add"}
        </button>
      </div>
    </div>

    {/* Image lightbox */}
    {zoomed && hasImage && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} — enlarged image`}
        onClick={() => setZoomed(false)}
        className="fade-in fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 p-6 backdrop-blur-sm"
      >
        <button
          ref={lightboxCloseRef}
          type="button"
          onClick={() => setZoomed(false)}
          aria-label="Close zoom"
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center text-bone/80 transition-colors hover:text-bone"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative h-full max-h-[85vh] w-full max-w-3xl"
        >
          <Image
            key={activeImage}
            src={activeImage}
            alt={`${product.name}${fragrance ? ` — ${fragrance}` : ""}${galleryImages.length > 1 ? ` — photo ${activeIndex + 1} of ${galleryImages.length}` : ""}`}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain"
          />
          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => showImage(activeIndex - 1)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-bone/80 transition-colors hover:text-bone"
              >
                <svg width="11" height="18" viewBox="0 0 9 14" fill="none" aria-hidden="true">
                  <path d="M8 1L2 7l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => showImage(activeIndex + 1)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-bone/80 transition-colors hover:text-bone"
              >
                <svg width="11" height="18" viewBox="0 0 9 14" fill="none" aria-hidden="true">
                  <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="smallcaps absolute bottom-2 left-1/2 -translate-x-1/2 text-bone/80">
                {activeIndex + 1} / {galleryImages.length}
              </span>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}