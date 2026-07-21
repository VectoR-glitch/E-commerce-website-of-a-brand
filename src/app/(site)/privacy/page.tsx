import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";

const title = "Privacy Policy";
const description = "How Klenich (Bharat Bliss Pvt Ltd) collects and uses your data.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title, description },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-ink/75">
      <Reveal>
      <Kicker>Legal</Kicker>
      <h1 className="mt-3 font-serif text-4xl text-ink">Privacy Policy</h1>
      <Ornament align="left" className="mt-4" />
      <p className="mt-2 text-sm text-ink/70">
        Last updated: 21 July 2026 · Operated by Bharat Bliss Pvt Ltd
      </p>
      </Reveal>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <Section title="1. Who we are">
          Klenich is a brand operated by Bharat Bliss Pvt Ltd (“we”, “us”).
          Registered address: Bharat Bliss, 91, Bus Route, beside Scale Karkhana,
          Rajarhat, Kanjialpara, Kolkata, West Bengal 700135. Contact:
          bharatblissofficial@gmail.com / +91 89812 21994.
        </Section>
        <Section title="2. Information we collect">
          Name, email, phone, and shipping address you provide at checkout;
          order and payment status (payments are processed by our payment
          provider — we do not store full card details). If you create an
          account, we also hold: product reviews and questions you submit
          (shown publicly alongside your first name once approved); your
          wishlist; your loyalty points balance and referral activity
          (including a link between your account and whoever referred you, or
          whoever you refer, so referral rewards can be credited); your
          Subscribe &amp; Save schedule, if any; and back-in-stock alert
          requests. We also keep basic usage data needed to run the store.
        </Section>
        <Section title="3. How we use it">
          To process and deliver your orders, send order updates, run the
          loyalty/referral and subscription programs you opt into, provide
          support, and send service reminders tied to your own activity —
          such as a nudge about items left in your cart, or a note that a
          product you wanted is back in stock. These service reminders aren’t
          general marketing and you can ask us to stop them anytime. Separate,
          optional marketing emails are only ever sent with your consent and
          can be unsubscribed from anytime.
        </Section>
        <Section title="4. Sharing">
          We share data with service providers strictly to run the store:
          payment gateway (Razorpay), shipping partners, email provider, and
          — if you provide a phone number — WhatsApp (Meta Platforms) to send
          order-status updates. We also use Google Analytics and the Meta
          Pixel to understand site usage and measure ad performance; these
          send browsing data (such as pages viewed and purchase events) to
          Google and Meta, who may use it under their own privacy policies.
          We do not sell your personal data.
        </Section>
        <Section title="5. Cookies & browser storage">
          Signed-out visitors have their cart, wishlist, and recently-viewed
          products stored locally in their own browser (not on our servers) so
          the site remembers them between visits — functional storage needed
          for the site to work. Signing in moves this into your account.
          Separately, Google Analytics and the Meta Pixel (see Section 4) set
          their own cookies to measure usage and ad performance.
        </Section>
        <Section title="6. Data retention & your rights">
          We keep order records as required by law. You may request access to,
          correction of, or deletion of your data by contacting bharatblissofficial@gmail.com.
        </Section>
        <Section title="7. Grievance Officer">
          In accordance with applicable Indian law, grievances or complaints
          regarding this policy may be addressed to our Grievance Officer:
          <br />
          Name: <span className="text-brass-deep">Alok Subhash Das</span>
          <br />
          Email: bharatblissofficial@gmail.com · Phone: +91 89812 21994
        </Section>
        <Section title="8. Contact">
          Questions about this policy? Email bharatblissofficial@gmail.com.
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