import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";

const title = "Terms & Conditions";
const description = "Terms of sale and use for Klenich (Bharat Bliss Pvt Ltd).";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: { title, description },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-ink/75">
      <Reveal>
      <Kicker>Legal</Kicker>
      <h1 className="mt-3 font-serif text-4xl text-ink">Terms & Conditions</h1>
      <Ornament align="left" className="mt-4" />
      <p className="mt-2 text-sm text-ink/70">
        Last updated: 4 July 2026 · Operated by Bharat Bliss Pvt Ltd
      </p>
      </Reveal>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <Section title="1. About these terms">
          By using klenich.com and placing an order, you agree to these terms.
          The store is operated by Bharat Bliss Pvt Ltd, 91, Bus Route, beside
          Scale Karkhana, Rajarhat, Kanjialpara, Kolkata, West Bengal 700135.
          GSTIN: <span className="text-brass-deep underline">19AANCB7497G1ZY</span>.
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
        <Section title="5. Subscribe & Save">
          Subscribe &amp; Save is a reminder service, not an automatic payment
          plan: we don’t store your card and nothing is charged without you
          actively completing checkout each cycle. We’ll email you when a
          delivery is due with a one-tap reorder at your saved discount; you
          can pause or cancel anytime from your account.
        </Section>
        <Section title="6. Loyalty & referral program">
          Loyalty points are earned on settled orders at the rate shown on your
          account page and may be redeemed into a single-use discount voucher,
          subject to a minimum redemption amount and a voucher expiry period —
          both shown at redemption. Referral bonuses are credited on a referred
          customer’s first settled order. We may amend, pause, or end the
          program, or withhold rewards obtained through abuse of these terms
          (e.g. fraudulent accounts or self-referral), at our discretion.
        </Section>
        <Section title="7. Reviews & questions">
          Content you submit (reviews, ratings, product questions) must be your
          own genuine opinion or question, not false, defamatory, or infringing.
          We moderate submissions before they appear publicly and may edit for
          length or clarity, decline to publish, or remove content that
          violates these terms.
        </Section>
        <Section title="8. Safe use of products">
          Our products are household cleaners. Use as directed on the label, keep
          out of reach of children and pets, and do not mix with other cleaning
          chemicals. We are not liable for misuse.
        </Section>
        <Section title="9. Liability & governing law">
          To the extent permitted by law, our liability is limited to the order
          value. These terms are governed by the laws of India, subject to the
          courts of Kolkata, West Bengal.
        </Section>
        <Section title="10. Grievance Officer">
          In accordance with applicable Indian law, grievances regarding these
          terms may be addressed to our Grievance Officer:
          <br />
          Name: <span className="text-brass-deep">[Grievance Officer name — to be designated]</span>
          <br />
          Email: bharatblissofficial@gmail.com · Phone: +91 89812 21994
        </Section>
        <Section title="11. Contact">
          Email bharatblissofficial@gmail.com for any questions about these terms.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section>
        <h2 className="font-serif text-lg text-ink">{title}</h2>
        <p className="mt-2">{children}</p>
      </section>
    </Reveal>
  );
}