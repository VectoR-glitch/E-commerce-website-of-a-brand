import type { Metadata } from "next";
import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";
import { getSession } from "@/lib/session";
import {
  LOYALTY_TIERS,
  POINT_VALUE_PAISE,
  LOYALTY_MIN_REDEEM_POINTS,
  LOYALTY_VOUCHER_TTL_DAYS,
  REFERRAL_REFERRER_BONUS_POINTS,
  REFERRAL_REFEREE_BONUS_POINTS,
} from "@/lib/constants";

const title = "Rewards";
const description =
  "Earn points on every order, redeem them for real discounts, and get ₹100 for every friend you bring to Klenich.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/rewards" },
  openGraph: { title, description },
};

const steps = [
  {
    title: "Shop and earn",
    body: `Every order earns points — ${LOYALTY_TIERS[0].earnPercent}% of what you spend, more as you go. 1 point is worth ₹${POINT_VALUE_PAISE / 100}.`,
  },
  {
    title: "Redeem for a discount",
    body: `Once you've got ${LOYALTY_MIN_REDEEM_POINTS}+ points, turn them into a voucher — good for ${LOYALTY_VOUCHER_TTL_DAYS} days on any order.`,
  },
  {
    title: "Level up",
    body: "The more you shop, the higher your tier climbs — and the more you earn on every order after that.",
  },
];

export default async function RewardsPage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-3xl px-8 py-24">
      <Reveal>
        <header className="text-center">
          <Kicker>Rewards</Kicker>
          <h1 className="mt-4 font-serif text-5xl leading-tight">Rewards that add up</h1>
          <Ornament className="mt-6" />
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink/65">
            No app, no card to carry — just points on every order, and real ₹ off when you redeem
            them.
          </p>
        </header>
      </Reveal>

      <Reveal delay={100}>
        <div className="mt-16 grid gap-px border border-line bg-line sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-paper p-7">
              <span className="smallcaps text-brass-deep">{`0${i + 1}`}</span>
              <h2 className="mt-2 font-serif text-xl">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{s.body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={180}>
        <div className="mt-16">
          <Kicker>Tiers</Kicker>
          <h2 className="mt-2 font-serif text-3xl">The more you shop, the more you earn</h2>
          <p className="mt-3 max-w-xl text-ink/70">
            Your tier is based on lifetime points earned — it only ever goes up, even if you redeem
            a voucher along the way.
          </p>
          <div className="mt-6 overflow-hidden border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-bone">
                  <th className="px-5 py-3 font-normal text-ink/60">Tier</th>
                  <th className="px-5 py-3 font-normal text-ink/60">Lifetime points</th>
                  <th className="px-5 py-3 font-normal text-ink/60">You earn</th>
                </tr>
              </thead>
              <tbody>
                {LOYALTY_TIERS.map((t) => (
                  <tr key={t.name} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-serif text-ink">{t.name}</td>
                    <td className="px-5 py-3 text-ink/70">{t.minLifetimePoints}+</td>
                    <td className="px-5 py-3 text-ink/70">{t.earnPercent}% back in points</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={240}>
        <div className="mt-16 border border-brass/30 bg-brass/[0.05] p-8 text-center">
          <Kicker>Refer a friend</Kicker>
          <h2 className="mt-2 font-serif text-3xl">
            Give ₹{REFERRAL_REFERRER_BONUS_POINTS}, get ₹{REFERRAL_REFEREE_BONUS_POINTS}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink/70">
            Share your referral link from your account. When a friend’s first order settles, you
            both get a one-off {REFERRAL_REFERRER_BONUS_POINTS}-point bonus — no minimum spend.
          </p>
        </div>
      </Reveal>

      <Reveal delay={300}>
        <div className="mt-16 text-center">
          {session ? (
            <Link
              href="/account/loyalty"
              className="smallcaps inline-block bg-forest px-9 py-4 text-bone btn-fill-forest"
            >
              View your points
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="smallcaps inline-block bg-forest px-9 py-4 text-bone btn-fill-forest"
              >
                Create an account to start earning
              </Link>
              <p className="mt-4 text-sm text-ink/60">
                Already have one?{" "}
                <Link href="/login" className="link-underline text-forest">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </Reveal>
    </div>
  );
}
