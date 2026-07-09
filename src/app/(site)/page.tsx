import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { Ornament } from "@/components/ornament";
import { Ticker } from "@/components/ticker";
import { Carousel } from "@/components/carousel";
import { Kicker } from "@/components/kicker";

export const dynamic = "force-dynamic";

// Title/description/openGraph already match the root layout's defaults — this
// only adds the canonical URL, which the root doesn't set (it can't know a
// child page's path).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const promises = [
  "Plant-Based",
  "Gentle On Hands",
  "No Harsh Fumes",
  "Family & Pet Friendly Floors",
  "Made In India",
];

const banners = [
  "Flat delivery — ₹64 in West Bengal, ₹160 across India",
  "Plant-powered home care — proudly made in India",
  "Gentle on hands · Tough on grime",
];

const trustBadges = [
  ["🇮🇳", "Made in India"],
  ["🌱", "Plant-Powered"],
  ["🐇", "Not Tested on Animals"],
  ["💧", "No Harsh Chemicals"],
];

export default async function HomePage() {
  const products = await getProducts();
  return (
    <>
      {/* Rotating promo banner */}
      <div className="border-b border-line bg-paper">
        <Carousel
          showArrows={false}
          showDots={false}
          interval={5000}
          ariaLabel="Promotions"
          className="mx-auto max-w-6xl px-8 py-4"
          slides={banners.map((b) => (
            <p
              key={b}
              className="text-center font-serif text-base italic text-forest sm:text-lg"
            >
              <span className="not-italic text-brass-deep">◆</span> {b}
            </p>
          ))}
        />
      </div>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl md:grid-cols-2">
        <div className="flex flex-col justify-center px-8 py-24 md:py-36 md:pr-20">
          <Reveal>
            <Kicker>A Bharat Bliss Brand</Kicker>
            <h1 className="mt-6 font-serif text-6xl leading-[1.02] font-normal md:text-7xl">
              Bliss in
              <br />
              <em className="italic">Every Drop</em>
            </h1>
            <Ornament align="left" className="mt-7" />
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 max-w-md text-lg font-light text-ink/70">
              Plant-powered cleaning, made in India. Gentle where it touches
              you — powerful where it needs to be.
            </p>
            <div className="mt-9">
              <Link
                href="/shop"
                className="smallcaps inline-block bg-forest px-9 py-4 text-bone btn-fill-forest"
              >
                Shop the Collection
              </Link>
            </div>
          </Reveal>
        </div>
        <div className="relative flex min-h-[34rem] items-center justify-center border-l border-line bg-paper">
          <span className="smallcaps absolute top-10 right-10 z-10 text-brass-deep">
            Made in India
          </span>
          <div className="soft-in relative h-[500px] w-full">
            <Image
              src="/products/dishwash-gel-lime.webp"
              alt="Klenich Dishwash Gel — Lime"
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-contain"
              priority
            />
          </div>
        </div>
      </section>

      {/* Promise ticker */}
      <Ticker items={promises} />

      {/* Collection */}
      <section className="mx-auto max-w-6xl px-8 py-32">
        <Reveal className="mb-16 text-center">
          <Kicker>The Collection</Kicker>
          <h2 className="mt-4 font-serif text-5xl">Three essentials. Done right.</h2>
          <Ornament className="mt-6" />
        </Reveal>
        <Reveal delay={120}>
          <div className="grid gap-px border border-line bg-line md:grid-cols-3">
            {products.map((product, i) => (
              <ProductCard key={product.slug} product={product} index={i} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* Promise band */}
      <section className="border-y border-brass/25 bg-forest py-36 text-center text-bone">
        <Reveal>
          <Ornament className="mb-8" />
          <Kicker>The Klenich Promise</Kicker>
          <h2 className="mx-auto mt-6 max-w-4xl px-8 font-serif text-5xl leading-tight text-paper">
            Gentle where it touches you,
            <br />
            <em className="italic text-sage">powerful</em> where it needs to be.
          </h2>
          <Ornament className="mt-8" />
        </Reveal>
      </section>

      {/* Trust badges */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {trustBadges.map(([icon, label]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2.5 bg-paper px-4 py-10 text-center"
            >
              <span className="text-3xl">{icon}</span>
              <span className="smallcaps text-ink/70">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}