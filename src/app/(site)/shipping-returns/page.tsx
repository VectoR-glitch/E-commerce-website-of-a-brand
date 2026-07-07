import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "Klenich shipping timelines, charges, and return policy.",
};

export default function ShippingReturnsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20">
      <Reveal>
      <header>
        <span className="smallcaps text-brass-deep">Policy</span>
        <h1 className="mt-3 font-serif text-4xl">Shipping & Returns</h1>
        <Ornament align="left" className="mt-5" />
      </header>
      </Reveal>

      <div className="mt-10 space-y-10 text-ink/75">
        <Reveal>
        <section>
          <h2 className="font-serif text-2xl text-ink">Shipping</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>We ship across India.</li>
            <li>Orders are dispatched within <strong>1 working day</strong>.</li>
            <li>
              Delivery time after dispatch depends on your location and our
              courier partner.
            </li>
            <li>
              <strong>Flat-rate delivery</strong>: ₹64 within West Bengal and
              ₹160 to the rest of India, added at checkout based on your
              delivery address.
            </li>
          </ul>
        </section>
        </Reveal>

        <Reveal>
        <section>
          <h2 className="font-serif text-2xl text-ink">Returns & Refunds</h2>
          <p className="mt-4">
            Because our products are cleaning liquids, for hygiene and safety
            reasons we can only accept returns or issue refunds in these cases:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>The item arrived <strong>damaged or leaking</strong>.</li>
            <li>You received the <strong>wrong product</strong>.</li>
          </ul>
          <p className="mt-4">
            Opened bottles cannot be returned. To raise a claim, contact us
            within <strong>3 days</strong> of delivery with your order number, a
            photo of the issue, and a valid uncut unboxing video (see below).
          </p>
          <p className="mt-4 rounded bg-brass/10 p-4 text-sm">
            <strong>Uncut unboxing video required.</strong> For any damaged or
            wrong-item claim, you must share a single, continuous (uncut and
            unedited) video that begins <em>before</em> the sealed package is
            opened and clearly shows the parcel, the shipping label, and the
            issue. Claims without a valid uncut unboxing video cannot be accepted.
          </p>
        </section>
        </Reveal>

        <Reveal>
        <section>
          <h2 className="font-serif text-2xl text-ink">Refund timeline</h2>
          <p className="mt-4">
            Approved refunds are processed to your original payment method within
            <strong> 3 business days</strong>.
          </p>
        </section>
        </Reveal>
      </div>
    </div>
  );
}