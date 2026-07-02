import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms of sale and use for Klenich (Bharat Bliss Pvt Ltd).",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-ink/75">
      <span className="smallcaps text-brass-deep">Legal</span>
      <h1 className="mt-3 font-serif text-4xl text-ink">Terms & Conditions</h1>
      <Ornament align="left" className="mt-4" />
      <p className="mt-2 text-sm text-ink/70">
        Last updated: 2 July 2026 · Operated by Bharat Bliss Pvt Ltd
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <Section title="1. About these terms">
          By using klenich.com and placing an order, you agree to these terms.
          The store is operated by Bharat Bliss Pvt Ltd, 91, Bus Route, beside
          Scale Karkhana, Rajarhat, Kanjialpara, Kolkata, West Bengal 700135.
          GSTIN: 19AANCB7497G1ZY.
        </Section>
        <Section title="2. Products & pricing">
          We aim to describe products accurately. Prices are in INR and inclusive
          of applicable taxes unless stated otherwise. We may correct errors and
          update prices at any time before you order.
        </Section>
        <Section title="3. Orders & payment">
          An order is confirmed once payment is successfully received. We reserve
          the right to cancel and refund an order (e.g. stock or pricing errors).
        </Section>
        <Section title="4. Shipping & returns">
          Delivery timelines and our return policy are described on the Shipping
          & Returns page, which forms part of these terms.
        </Section>
        <Section title="5. Safe use of products">
          Our products are household cleaners. Use as directed on the label, keep
          out of reach of children and pets, and do not mix with other cleaning
          chemicals. We are not liable for misuse.
        </Section>
        <Section title="6. Liability & governing law">
          To the extent permitted by law, our liability is limited to the order
          value. These terms are governed by the laws of India, subject to the
          courts of Kolkata, West Bengal.
        </Section>
        <Section title="7. Contact">
          Email bharatblissofficial@gmail.com for any questions about these terms.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-lg text-ink">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}