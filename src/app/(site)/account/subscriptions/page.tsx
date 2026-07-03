import Link from "next/link";
import Image from "next/image";
import { requireSession } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { getCustomerSubscriptions } from "@/lib/subscriptions";
import {
  pauseSubscription,
  resumeSubscription,
  skipSubscription,
  cancelSubscription,
} from "@/app/actions/subscriptions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubscriptionOrderNow } from "@/components/subscription-order-now";

export const dynamic = "force-dynamic";

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function SubscriptionsPage() {
  const session = await requireSession("/account/subscriptions");
  const subs = await getCustomerSubscriptions(session.sub);

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <Link href="/account" className="smallcaps text-ink/60 hover:text-forest">← Account</Link>
      <h1 className="mt-3 font-serif text-4xl">Subscriptions</h1>
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
    </div>
  );
}
