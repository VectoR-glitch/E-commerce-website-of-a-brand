import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";
import { OrderTrackingView } from "@/components/order-tracking-view";
import { getOrderTrackingByToken } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Track Order",
  robots: { index: false, follow: false },
};

export default async function TrackOrderTokenPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const tracking = await getOrderTrackingByToken(token);
  if (!tracking) notFound();

  return (
    <div className="mx-auto max-w-xl px-8 py-20">
      <Reveal>
        <header className="text-center">
          <Kicker>Track Order</Kicker>
          <h1 className="mt-4 font-serif text-5xl">Where&rsquo;s my order?</h1>
          <Ornament className="mt-6" />
        </header>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-10">
          <OrderTrackingView tracking={tracking} />
        </div>
      </Reveal>
    </div>
  );
}
