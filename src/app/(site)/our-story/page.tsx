import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "The story behind Klenich — a Bharat Bliss Pvt Ltd brand making plant-powered home care the Indian standard.",
};

export default function OurStoryPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-24">
      <Reveal>
      <header className="text-center">
        <Kicker>Our Story</Kicker>
        <h1 className="mt-4 font-serif text-5xl">Bliss in Every Drop</h1>
        <Ornament className="mt-6" />
        <p className="smallcaps mt-6 text-ink/70">
          A letter from our founder, Alok Das
        </p>
      </header>
      </Reveal>

      <Reveal delay={120} className="mt-12 space-y-6 text-lg leading-relaxed text-ink/75">
        <p className="dropcap">
          It began, as these things often do, with a small moment in an ordinary
          kitchen.
        </p>
        <p>
          A few years ago I was wiping down a counter at home — the same counter
          my family eats at every day — and I stopped to actually read the back
          of the bottle in my hand. I couldn’t pronounce most of it. What I{" "}
          <em>could</em> understand was a row of warnings: keep away from
          children, avoid skin contact, ensure ventilation. And yet here it was,
          in the most intimate room of our home, on the surfaces we touch the
          most.
        </p>
        <p>
          It struck me as a strange bargain. We had quietly agreed that a clean
          home and a safe one were two different things — that to get one, you
          had to make peace with the other. The harsher it smelled, the more we
          trusted it was working.
        </p>
        <p>I didn’t accept that trade. So I set out to undo it.</p>
        <p>
          Klenich began as a simple, stubborn question: could cleaning feel less
          like handling a chemical and more like caring for a home? I spent the
          next stretch of my life learning what most people never have to think
          about — formulation, sourcing, the difference between what a label
          says and what a product actually is. I met chemists. I sent samples
          back, again and again, when “good enough” wasn’t.
        </p>
        <p>
          I wanted something I’d be glad to keep on the counter, not under the
          sink. Something honest enough to read aloud. Something that felt
          considered — because a home, and the people in it, deserve to be.
        </p>
        <p>
          Klenich is that work, bottled. It carries the name of my company,{" "}
          <strong>Bharat Bliss</strong>, and the standard I hold it to: that you
          should never have to choose between a home that’s clean and a home
          that’s cared for.
        </p>
        <p>Thank you for letting us into yours.</p>
      </Reveal>

      <Reveal delay={100}>
      <p className="mt-12 border-t border-line pt-8 text-center font-serif text-2xl italic text-forest">
        “Safe cleaning, the rule in every Indian home — not the exception in a
        few.”
      </p>
      </Reveal>

      {/* Founder signature */}
      <Reveal delay={140}>
      <figure className="mt-14 flex flex-col items-center text-center">
        <figcaption className="font-serif text-4xl italic text-forest">
          Alok Das
        </figcaption>
        <svg
          width="150"
          height="22"
          viewBox="0 0 150 22"
          fill="none"
          aria-hidden="true"
          className="mt-1 text-brass-deep"
        >
          <path
            d="M4 14 C 30 4, 55 4, 80 11 C 100 17, 120 17, 146 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <p className="smallcaps mt-4 text-ink/70">
          Founder · Bharat Bliss Pvt Ltd
        </p>
      </figure>
      </Reveal>
    </div>
  );
}