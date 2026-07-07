import type { Metadata } from "next";
import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";
import { LeafIcon } from "@/components/leaf-icon";

export const metadata: Metadata = {
  title: "Why Klenich",
  description:
    "Plant-powered home care made in India — gentle where it touches you, powerful where it needs to be.",
};

const pillars = [
  {
    title: "Gentle where it touches you",
    body: "Our dishwash is formulated to be gentle on hands you use every day. No harsh, drying chemicals on the surfaces — and the skin — you live with.",
  },
  {
    title: "Powerful where it needs to be",
    body: "Tough jobs get tough formulas. Our toilet and floor cleaners cut through grime and stains, so 'gentle' never means 'weak'.",
  },
  {
    title: "Plant-powered, no harsh fumes",
    body: "Naturally-derived fragrances — Lime, Jasmine, Lavender, Lemongrass — for a home that smells like bliss, not chemicals.",
  },
  {
    title: "100% Made in India",
    body: "Proudly formulated and made in India, by Bharat Bliss Pvt Ltd. Safe home care shouldn't be a luxury import — it should be the standard.",
  },
];

export default function WhyKlenichPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-24">
      <Reveal>
      <header className="text-center">
        <Kicker>Why Klenich</Kicker>
        <h1 className="mt-4 font-serif text-5xl leading-tight">
          Safe cleaning,
          <br />
          <em className="italic">the Indian standard.</em>
        </h1>
        <Ornament className="mt-6" />
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink/65">
          We started Klenich on a simple belief: a clean home shouldn’t cost you
          your health, your skin, or your peace of mind.
        </p>
      </header>
      </Reveal>

      <div className="mt-16 grid gap-px border border-line bg-line sm:grid-cols-2">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 80} className="bg-paper p-9">
            <LeafIcon className="h-5 w-5 text-brass" />
            <h2 className="mt-3 font-serif text-2xl">{p.title}</h2>
            <p className="mt-3 text-ink/65">{p.body}</p>
          </Reveal>
        ))}
      </div>

      <Reveal>
      <section className="mt-16 border border-line bg-forest p-10 text-center text-bone">
        <Kicker>Made for family homes</Kicker>
        <p className="mx-auto mt-4 max-w-2xl font-serif text-2xl text-paper">
          Formulated without the harsh chemicals you don’t want around your kids
          and pets.
        </p>
      </section>
      </Reveal>

      <div className="mt-14 text-center">
        <Link
          href="/shop"
          className="smallcaps inline-block bg-forest px-9 py-4 text-bone btn-fill-forest"
        >
          Shop the Collection
        </Link>
      </div>
    </div>
  );
}