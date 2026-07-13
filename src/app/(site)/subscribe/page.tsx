import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import { SubscriptionPlanBuilder } from "@/components/subscription-plan-builder";
import { Reveal } from "@/components/reveal";
import { Ornament } from "@/components/ornament";
import { Kicker } from "@/components/kicker";

export const dynamic = "force-dynamic";

const title = "Build a subscription";
const description =
  "Pick your favorites, choose a delivery frequency, and save 10% on every recurring delivery.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/subscribe" },
  openGraph: { title, description },
};

export default async function SubscribePage() {
  const products = await getProducts();

  return (
    <section className="mx-auto max-w-6xl px-8 py-24">
      <Reveal className="mb-16 text-center">
        <Kicker>Subscribe &amp; Save</Kicker>
        <h1 className="mt-4 font-serif text-5xl">Build your box</h1>
        <p className="mx-auto mt-4 max-w-md text-ink/70">
          Pick your favorites, choose how often you&rsquo;d like them delivered, and save 10% every time.
        </p>
        <Ornament className="mt-6" />
      </Reveal>
      <Reveal delay={120}>
        <SubscriptionPlanBuilder products={products} />
      </Reveal>
    </section>
  );
}
