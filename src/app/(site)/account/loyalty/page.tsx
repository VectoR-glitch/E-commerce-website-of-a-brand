import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getLoyaltySummary } from "@/lib/loyalty";
import { formatINR } from "@/lib/catalog";
import {
  LOYALTY_TIERS,
  LOYALTY_MIN_REDEEM_POINTS,
  POINT_VALUE_PAISE,
  REFERRAL_REFEREE_BONUS_POINTS,
  REFERRAL_REFERRER_BONUS_POINTS,
} from "@/lib/constants";
import { RedeemPoints } from "@/components/account/redeem-points";
import { ReferralShare } from "@/components/account/referral-share";
import { Kicker } from "@/components/kicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Loyalty Points" };

const REASON_LABEL: Record<string, string> = {
  order: "Earned on an order",
  referral: "Referral bonus",
  referee: "Welcome bonus",
  redeem: "Redeemed for a voucher",
  return: "Reversed for a return",
};

const VOUCHER_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "border-forest/40 text-forest" },
  used: { label: "Used", cls: "border-line text-ink/45" },
  expired: { label: "Expired", cls: "border-line text-ink/45" },
};

export default async function LoyaltyPage() {
  const session = await requireSession("/account/loyalty");
  const summary = await getLoyaltySummary(session.sub);

  // Progress within the current tier's band (not from zero), so the bar fills
  // from where this tier started, not from account creation.
  const currentThreshold = LOYALTY_TIERS.find((t) => t.name === summary.tier)?.minLifetimePoints ?? 0;
  const nextThreshold = summary.lifetimePoints + (summary.nextTier?.pointsNeeded ?? 0);
  const tierProgressPct = summary.nextTier
    ? Math.min(
        100,
        Math.round(((summary.lifetimePoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100),
      )
    : 100;

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Kicker>Rewards</Kicker>
          <h1 className="mt-2 font-serif text-4xl">Points &amp; referrals</h1>
        </div>
        <Link
          href="/account"
          className="smallcaps border border-line px-4 py-2 text-ink/70 transition-colors hover:border-forest hover:text-forest"
        >
          ← Account
        </Link>
      </header>

      {/* Balance */}
      <section className="mt-8 border border-forest/30 bg-forest/5 p-7 text-center">
        <p className="smallcaps text-forest">Your balance</p>
        <p className="mt-2 font-serif text-5xl text-forest">{summary.points}</p>
        <p className="mt-1 text-sm text-ink/60">
          points · worth {formatINR(summary.pointsValuePaise)}
        </p>
        <p className="mt-3">
          <span className="smallcaps border border-forest/40 bg-bone px-3 py-1 text-forest">
            {summary.tier} tier · {summary.tierEarnPercent}% back
          </span>
        </p>
      </section>

      {/* Tier progress */}
      <section className="mt-6 border border-line bg-paper p-6">
        {summary.nextTier ? (
          <>
            <p className="text-sm text-ink/70">
              <strong>{summary.nextTier.pointsNeeded} points</strong> to{" "}
              <strong>{summary.nextTier.name}</strong> tier.
            </p>
            <div className="mt-3 h-2 w-full rounded-r-[4px] bg-line">
              <div className="h-2 rounded-r-[4px] bg-forest" style={{ width: `${tierProgressPct}%` }} />
            </div>
          </>
        ) : (
          <p className="text-sm text-forest">You&rsquo;ve reached our top tier — thank you for your loyalty.</p>
        )}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/50">
          {LOYALTY_TIERS.map((t) => (
            <span key={t.name} className={t.name === summary.tier ? "font-medium text-forest" : ""}>
              {t.name} {t.earnPercent}%{t.minLifetimePoints > 0 ? ` (${t.minLifetimePoints}+ pts)` : ""}
            </span>
          ))}
        </p>
      </section>

      {/* How it works */}
      <p className="mt-4 text-center text-xs text-ink/55">
        Earn <strong>{summary.tierEarnPercent}% back</strong> as points on every order at
        your tier (1 point = {formatINR(POINT_VALUE_PAISE)}). Refer a friend and you both
        get bonus points on their first order.
      </p>

      {/* Redeem */}
      <section className="mt-10">
        <h2 className="smallcaps text-brass-deep">Redeem points</h2>
        <div className="mt-4 border border-line bg-paper p-6">
          <RedeemPoints
            balance={summary.points}
            minPoints={LOYALTY_MIN_REDEEM_POINTS}
            pointValuePaise={POINT_VALUE_PAISE}
          />
        </div>
      </section>

      {/* Vouchers */}
      {summary.vouchers.length > 0 && (
        <section className="mt-10">
          <h2 className="smallcaps text-brass-deep">Your vouchers</h2>
          <ul className="mt-4 divide-y divide-line border border-line bg-paper">
            {summary.vouchers.map((v) => {
              const status = VOUCHER_STATUS[v.status];
              return (
                <li key={v.code} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <span>
                    <span className="font-mono text-ink">{v.code}</span>
                    <span className="ml-2 text-ink/60">{formatINR(v.valuePaise)} off</span>
                    {v.expiresAt && v.status === "active" && (
                      <span className="mt-0.5 block text-xs text-ink/45">
                        Expires{" "}
                        {v.expiresAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </span>
                  <span className={`smallcaps shrink-0 border px-2.5 py-1 text-xs ${status.cls}`}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Referral */}
      <section className="mt-10">
        <h2 className="smallcaps text-brass-deep">Refer friends</h2>
        <p className="mt-1 text-sm text-ink/55">
          Share your link. When a friend signs up and places their first order,
          they get <strong>{REFERRAL_REFEREE_BONUS_POINTS} points</strong> and you
          get <strong>{REFERRAL_REFERRER_BONUS_POINTS} points</strong>.
          {summary.referredCount > 0 && (
            <> You&rsquo;ve referred {summary.referredCount} so far — thank you.</>
          )}
        </p>
        <div className="mt-4 border border-line bg-paper p-6">
          <ReferralShare code={summary.referralCode} url={summary.referralUrl} />
        </div>
      </section>

      {/* Activity */}
      {summary.ledger.length > 0 && (
        <section className="mt-10">
          <h2 className="smallcaps text-brass-deep">Recent activity</h2>
          <ul className="mt-4 divide-y divide-line border border-line bg-paper">
            {summary.ledger.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="text-ink/80">{REASON_LABEL[e.reason] ?? e.reason}</span>
                  <span className="mt-0.5 block text-xs text-ink/45">
                    {e.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
                <span className={e.delta >= 0 ? "text-forest" : "text-ink/60"}>
                  {e.delta >= 0 ? "+" : "−"}
                  {Math.abs(e.delta)} pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
