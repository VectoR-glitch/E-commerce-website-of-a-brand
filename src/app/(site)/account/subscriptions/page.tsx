import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { requireSession } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { getCustomerSubscriptions } from "@/lib/subscriptions";
import { getCustomerSubscriptionPlans } from "@/lib/subscription-plans";
import {
  pauseSubscription,
  resumeSubscription,
  skipSubscription,
  cancelSubscription,
} from "@/app/actions/subscriptions";
import {
  pauseSubscriptionPlan,
  resumeSubscriptionPlan,
  skipSubscriptionPlan,
  cancelSubscriptionPlan,
} from "@/app/actions/subscription-plans";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubscriptionOrderNow } from "@/components/subscription-order-now";
import { SubscriptionPlanOrderNow } from "@/components/subscription-plan-order-now";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscribe & Save" };

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function SubscriptionsPage() {
  const session = await requireSession("/account/subscriptions");
  const [subs, plans] = await Promise.all([
    getCustomerSubscriptions(session.sub),
    getCustomerSubscriptionPlans(session.sub),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <Link href="/account" className="smallcaps text-ink/60 hover:text-forest">← Account</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl">Subscriptions</h1>
        <Link href="/subscribe" className="smallcaps link-underline text-forest">
          + Build a new subscription
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/55">
        Your subscribe &amp; save deliveries. We email you before each one — nothing is charged
        automatically.
      </p>

      {subs.length === 0 ? (
        <div className="mt-10 border border-line bg-paper p-8 text-center">
          <p className="text-ink/60">You don&rsquo;t have any subscriptions yet.</p>
          <Link
            href="/shop"
            className="smallcaps mt-5 inline-block bg-forest px-6 py-2.5 text-bone btn-fill-forest"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {subs.map((s) => (
            <li key={s.id} className="border border-line bg-paper p-5">
              <div className="flex gap-4">
                <div className="relative h-20 w-20 shrink-0 border border-line bg-bone">
                  {s.image ? (
                    <Image src={s.image} alt={s.productName} fill sizes="80px" className="object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl">
                      <span aria-hidden>🧴</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-serif text-xl">{s.productName}</h2>
                      <p className="text-sm text-ink/60">
                        {[s.fragrance, s.size].filter(Boolean).join(" · ")}
                        {s.quantity > 1 ? ` · ×${s.quantity}` : ""}
                      </p>
                    </div>
                    <span
                      className={`smallcaps border px-2.5 py-1 text-xs ${
                        s.status === "ACTIVE"
                          ? "border-forest/40 bg-forest/5 text-forest"
                          : "border-line bg-bone text-ink/55"
                      }`}
                    >
                      {s.status === "ACTIVE" ? "Active" : "Paused"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm">
                    <span className="font-serif text-lg">{formatINR(s.unitDiscountedPaise)}</span>
                    <span className="ml-2 text-ink/45 line-through">{formatINR(s.unitPaise)}</span>
                    <span className="smallcaps ml-2 text-brass-deep">save {s.discountPercent}%</span>
                  </p>
                  <p className="mt-1 text-sm text-ink/60">
                    {s.intervalLabel}
                    {s.status === "ACTIVE" && ` · next around ${dateFmt(s.nextDeliveryAt)}`}
                  </p>

                  {!s.available && (
                    <p className="mt-2 text-xs text-red-600">
                      This item is currently unavailable — you can pause or cancel below.
                    </p>
                  )}

                  {/* Controls */}
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {s.status === "ACTIVE" && s.available && (
                      <SubscriptionOrderNow
                        item={{
                          variantId: s.variantId,
                          sku: s.sku,
                          productSlug: s.productSlug,
                          name: s.productName,
                          fragrance: s.fragrance ?? undefined,
                          size: s.size,
                          image: s.image,
                          pricePaise: s.unitPaise,
                        }}
                        quantity={s.quantity}
                        couponCode={s.couponCode}
                      />
                    )}
                    {s.status === "ACTIVE" && (
                      <>
                        <form action={skipSubscription}>
                          <input type="hidden" name="subscriptionId" value={s.id} />
                          <button className="smallcaps border border-line px-4 py-2.5 text-ink/70 transition-colors hover:border-ink">
                            Skip cycle
                          </button>
                        </form>
                        <form action={pauseSubscription}>
                          <input type="hidden" name="subscriptionId" value={s.id} />
                          <button className="smallcaps border border-line px-4 py-2.5 text-ink/70 transition-colors hover:border-ink">
                            Pause
                          </button>
                        </form>
                      </>
                    )}
                    {s.status === "PAUSED" && (
                      <form action={resumeSubscription}>
                        <input type="hidden" name="subscriptionId" value={s.id} />
                        <button className="smallcaps bg-forest px-5 py-2.5 text-bone btn-fill-forest">
                          Resume
                        </button>
                      </form>
                    )}
                    <form action={cancelSubscription}>
                      <input type="hidden" name="subscriptionId" value={s.id} />
                      <ConfirmSubmit
                        message={`Cancel your ${s.productName} subscription?`}
                        className="smallcaps px-4 py-2.5 text-ink/45 transition-colors hover:text-red-600"
                      >
                        Cancel
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {plans.length > 0 && (
        <>
          <h2 className="mt-14 font-serif text-2xl">Subscription boxes</h2>
          <p className="mt-1 text-sm text-ink/55">
            Multi-item plans built at{" "}
            <Link href="/subscribe" className="text-forest underline">
              /subscribe
            </Link>
            .
          </p>
          <ul className="mt-6 space-y-4">
            {plans.map((p) => (
              <li key={p.id} className="border border-line bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <ul className="min-w-0 space-y-1 text-sm text-ink/70">
                    {p.items.map((it) => (
                      <li key={it.variantId}>
                        {it.productName}
                        <span className="text-ink/45">
                          {" "}
                          {[it.fragrance, it.size].filter(Boolean).join(" · ")} × {it.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span
                    className={`smallcaps shrink-0 border px-2.5 py-1 text-xs ${
                      p.status === "ACTIVE"
                        ? "border-forest/40 bg-forest/5 text-forest"
                        : "border-line bg-bone text-ink/55"
                    }`}
                  >
                    {p.status === "ACTIVE" ? "Active" : "Paused"}
                  </span>
                </div>

                <p className="mt-3 text-sm">
                  <span className="font-serif text-lg">{formatINR(p.totalDiscountedPaise)}</span>
                  <span className="smallcaps ml-2 text-brass-deep">save {p.discountPercent}%</span>
                </p>
                <p className="mt-1 text-sm text-ink/60">
                  {p.intervalLabel}
                  {p.status === "ACTIVE" && ` · next around ${dateFmt(p.nextDeliveryAt)}`}
                </p>

                {!p.available && (
                  <p className="mt-2 text-xs text-red-600">
                    Every item in this box is currently unavailable — you can pause or cancel below.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  {p.status === "ACTIVE" && p.available && (
                    <SubscriptionPlanOrderNow
                      items={p.items
                        .filter((it) => it.available)
                        .map((it) => ({
                          variantId: it.variantId,
                          sku: it.sku,
                          productSlug: it.productSlug,
                          name: it.productName,
                          fragrance: it.fragrance ?? undefined,
                          size: it.size,
                          image: it.image,
                          pricePaise: it.unitPaise,
                          quantity: it.quantity,
                        }))}
                      couponCode={p.couponCode}
                    />
                  )}
                  {p.status === "ACTIVE" && (
                    <>
                      <form action={skipSubscriptionPlan}>
                        <input type="hidden" name="planId" value={p.id} />
                        <button className="smallcaps border border-line px-4 py-2.5 text-ink/70 transition-colors hover:border-ink">
                          Skip cycle
                        </button>
                      </form>
                      <form action={pauseSubscriptionPlan}>
                        <input type="hidden" name="planId" value={p.id} />
                        <button className="smallcaps border border-line px-4 py-2.5 text-ink/70 transition-colors hover:border-ink">
                          Pause
                        </button>
                      </form>
                    </>
                  )}
                  {p.status === "PAUSED" && (
                    <form action={resumeSubscriptionPlan}>
                      <input type="hidden" name="planId" value={p.id} />
                      <button className="smallcaps bg-forest px-5 py-2.5 text-bone btn-fill-forest">
                        Resume
                      </button>
                    </form>
                  )}
                  <form action={cancelSubscriptionPlan}>
                    <input type="hidden" name="planId" value={p.id} />
                    <ConfirmSubmit
                      message="Cancel this subscription box?"
                      className="smallcaps px-4 py-2.5 text-ink/45 transition-colors hover:text-red-600"
                    >
                      Cancel
                    </ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
