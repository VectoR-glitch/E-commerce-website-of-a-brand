import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";

// Live order tracking is post-launch (see docs/tracking-plan.md). Until then this
// page is intentionally a static, honest pointer to support — NOT a form that
// looks functional but does nothing.
export default function TrackOrderPage() {
  return (
    <div className="mx-auto max-w-xl px-8 py-20">
      <Reveal>
      <header className="text-center">
        <Kicker>Track Order</Kicker>
        <h1 className="mt-4 font-serif text-5xl">Where’s my order?</h1>
        <Ornament className="mt-6" />
      </header>
      </Reveal>

      <Reveal delay={120}>
      <div className="mt-10 border border-line bg-paper p-8 text-center text-ink/70">
        <p className="font-serif text-xl text-ink">Live tracking is coming soon</p>
        <p className="mt-3 text-sm leading-relaxed">
          We’re putting the finishing touches on order tracking. In the meantime,
          email us your order number and we’ll check its status for you right away.
        </p>
        <Link
          href="/contact"
          className="smallcaps mt-6 inline-block bg-forest px-7 py-3 text-bone btn-fill-forest"
        >
          Contact us
        </Link>
      </div>
      </Reveal>
    </div>
  );
}