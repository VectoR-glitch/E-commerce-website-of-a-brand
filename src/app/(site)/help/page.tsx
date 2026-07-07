import type { Metadata } from "next";
import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";

export const metadata: Metadata = {
  title: "Help & FAQs",
  description: "Answers about Klenich products, safety, shipping, and orders.",
};

const faqs = [
  {
    q: "Are Klenich products safe to use around children and pets?",
    a: "Klenich is made without the harsh chemicals you don’t want around your family. Our dishwash is gentle on hands, and our floor cleaners are plant-powered with no harsh fumes. As with any cleaning product, keep bottles out of reach of children and pets, and let cleaned floors dry before walking on them.",
  },
  {
    q: "How do I use the Floor Cleaner?",
    a: "Add 1–2 caps of Floor Cleaner to a bucket of water and mop as usual. Always follow the dilution guidance on the pack — using it undiluted on some surfaces may leave residue.",
  },
  {
    q: "Is Klenich made in India?",
    a: "Yes — 100% formulated and made in India by Bharat Bliss Pvt Ltd.",
  },
  {
    q: "What fragrances are available?",
    a: "Dishwash Gel comes in Lime. Floor Cleaner comes in Jasmine, Lavender, and Lemongrass. Toilet Cleaner is a regular fragrance.",
  },
  {
    q: "How long does delivery take?",
    a: "We dispatch within 1 working day. Delivery time after that depends on your location and our courier partner. We ship across India.",
  },
  {
    q: "What is your return policy?",
    a: "For hygiene and safety reasons, we can only accept returns or issue refunds for items that arrive damaged or if you received the wrong product. Opened bottles can’t be returned. Damaged or wrong-item claims must include a valid uncut (continuous, unedited) unboxing video. See Shipping & Returns for details.",
  },
  {
    q: "How can I pay?",
    a: "You can pay securely online via UPI, cards, and netbanking at checkout. (Online payment is being finalised.)",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <Reveal>
      <header className="text-center">
        <Kicker>Help</Kicker>
        <h1 className="mt-4 font-serif text-5xl">Frequently asked questions</h1>
        <Ornament className="mt-6" />
      </header>
      </Reveal>

      <div className="mt-14 divide-y divide-line border-y border-line">
        {faqs.map((f) => (
          <Reveal key={f.q}>
          <details className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-serif text-xl">
              {f.q}
              <span className="text-brass-deep transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-ink/70">{f.a}</p>
          </details>
          </Reveal>
        ))}
      </div>

      <Reveal>
      <p className="mt-12 text-center text-ink/65">
        Still need help?{" "}
        <Link href="/contact" className="link-underline text-forest">
          Contact us
        </Link>
        .
      </p>
      </Reveal>
    </div>
  );
}