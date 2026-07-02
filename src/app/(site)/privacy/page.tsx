import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Klenich (Bharat Bliss Pvt Ltd) collects and uses your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-ink/75">
      <span className="smallcaps text-brass-deep">Legal</span>
      <h1 className="mt-3 font-serif text-4xl text-ink">Privacy Policy</h1>
      <Ornament align="left" className="mt-4" />
      <p className="mt-2 text-sm text-ink/70">
        Last updated: 2 July 2026 · Operated by Bharat Bliss Pvt Ltd
      </p>

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
          provider — we do not store full card details); and basic usage data.
        </Section>
        <Section title="3. How we use it">
          To process and deliver your orders, send order updates, provide
          support, and — only with your consent — marketing emails you can
          unsubscribe from anytime.
        </Section>
        <Section title="4. Sharing">
          We share data with service providers strictly to run the store:
          payment gateway (Razorpay), shipping partners, and email provider. We
          do not sell your personal data.
        </Section>
        <Section title="5. Data retention & your rights">
          We keep order records as required by law. You may request access to,
          correction of, or deletion of your data by contacting bharatblissofficial@gmail.com.
        </Section>
        <Section title="6. Contact">
          Questions about this policy? Email bharatblissofficial@gmail.com.
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