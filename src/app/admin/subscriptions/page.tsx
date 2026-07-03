import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { intervalLabel } from "@/lib/subscriptions";
import { runSubscriptionReminders } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminSubscriptions() {
  await requireAdmin();

  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: [{ status: "asc" }, { nextDeliveryAt: "asc" }],
    include: {
      customer: { select: { email: true, name: true } },
      variant: { include: { product: { select: { name: true } } } },
    },
  });

  const activeCount = subs.filter((s) => s.status === "ACTIVE").length;
  const dueCount = subs.filter((s) => s.status === "ACTIVE" && s.nextDeliveryAt <= now).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Subscriptions</h1>
          <p className="mt-1 text-sm text-ink/55">
            {activeCount} active · {subs.length - activeCount} paused ·{" "}
            <span className={dueCount > 0 ? "text-brass-deep" : ""}>{dueCount} due now</span>
          </p>
        </div>
        <form action={runSubscriptionReminders}>
          <button
            className="smallcaps bg-forest px-5 py-2.5 text-bone btn-fill-forest disabled:opacity-50"
            disabled={dueCount === 0}
          >
            Send {dueCount > 0 ? `${dueCount} ` : ""}due reminder{dueCount === 1 ? "" : "s"}
          </button>
        </form>
      </div>

      <p className="mt-3 max-w-2xl text-xs text-ink/50">
        Managed model — no card is stored. Reminders email each due subscriber a one-tap reorder at
        their saved price, then roll the schedule forward one cycle. A daily Vercel Cron runs this
        automatically (<span className="font-mono">/api/cron/subscription-reminders</span>, 03:00 UTC);
        this button is the manual trigger for sending due reminders on demand.
      </p>

      {subs.length === 0 ? (
        <p className="mt-10 text-sm text-ink/50">No subscriptions yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-paper text-left smallcaps text-ink/60">
              <tr>
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Item</th>
                <th className="px-4 py-3 font-normal">Cadence</th>
                <th className="px-4 py-3 font-normal">Next</th>
                <th className="px-4 py-3 font-normal">Save</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const isDue = s.status === "ACTIVE" && s.nextDeliveryAt <= now;
                const variant = [s.variant.fragrance, s.variant.size].filter(Boolean).join(" · ");
                return (
                  <tr key={s.id} className="border-t border-line/70">
                    <td className="px-4 py-3">
                      <div className="text-ink">{s.customer.name ?? "—"}</div>
                      <div className="text-xs text-ink/55">{s.customer.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink">{s.variant.product.name}</div>
                      <div className="text-xs text-ink/55">
                        {variant}
                        {s.quantity > 1 ? ` · ×${s.quantity}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/70">{intervalLabel(s.intervalDays)}</td>
                    <td className={`px-4 py-3 ${isDue ? "font-medium text-brass-deep" : "text-ink/70"}`}>
                      {dateFmt(s.nextDeliveryAt)}
                      {isDue ? " · due" : ""}
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {s.discountPercent}% ({formatINR(Math.round(s.variant.pricePaise * (1 - s.discountPercent / 100)))})
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`smallcaps border px-2 py-0.5 text-xs ${
                          s.status === "ACTIVE"
                            ? "border-forest/40 bg-forest/5 text-forest"
                            : "border-line bg-bone text-ink/55"
                        }`}
                      >
                        {s.status === "ACTIVE" ? "Active" : "Paused"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
