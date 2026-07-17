import { PaymentStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { toIST } from "@/lib/gst";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Midnight IST for the calendar day containing `date`, as a real UTC instant
// (safe to compare against stored UTC timestamps). Klenich operates in IST —
// bucketing by UTC calendar day instead put an order placed 00:00–05:29 IST
// in the previous day's bucket, up to 5.5h off from the business's own
// "today." Mirrors toIST()'s shift-then-read-UTC-getters technique, just run
// in reverse (IST wall-clock midnight -> real UTC instant) to get a boundary
// usable in a Prisma `createdAt` filter.
function istMidnight(date: Date): Date {
  const ist = toIST(date);
  const shiftedMidnight = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  return new Date(shiftedMidnight.getTime() - IST_OFFSET_MS);
}
// Orders that actually resulted in a sale — excludes abandoned checkouts
// (PENDING), failed payments, and refunds, so revenue/AOV/retention all mean
// "real, kept business" rather than raw order-row volume.
const SETTLED: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID];
// paymentStatus alone isn't enough: cancelling/returning an order doesn't
// automatically flip paymentStatus to REFUNDED (that's a separate manual
// admin step), so a cancelled order can sit PAID/PARTIALLY_PAID indefinitely
// while its refund is pending — excluding these order statuses stops that
// from silently inflating revenue/AOV/top-products/coupon stats.
const NOT_VOIDED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.RETURNED];

function deltaNode(curr: number, prev: number): React.ReactNode {
  if (prev <= 0) {
    return curr > 0 ? <span className="text-forest">▲ new vs prior 30d</span> : null;
  }
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return <span className="text-ink/50">flat vs prior 30d</span>;
  const up = pct > 0;
  return (
    <span className={up ? "text-forest" : "text-red-700"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% vs prior 30d
    </span>
  );
}

export default async function AdminAnalytics() {
  await requireAdmin();

  const now = new Date();
  // Calendar-day aligned (IST) so the headline stats and the daily chart
  // always agree on exactly which orders are "in the window."
  const todayIST = istMidnight(now);
  const windowEnd = new Date(todayIST.getTime() + DAY_MS); // exclusive, start of tomorrow
  const windowStart = new Date(todayIST.getTime() - 29 * DAY_MS); // 30 days incl. today
  const prevWindowStart = new Date(windowStart.getTime() - 30 * DAY_MS);
  const topProductsSince = new Date(todayIST.getTime() - 89 * DAY_MS); // 90 days incl. today

  const [
    currentOrders,
    prevAgg,
    inWindowCustomers,
    allCustomerFirstOrder,
    activeSubs,
    topProducts,
    couponUsage,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        paymentStatus: { in: SETTLED },
        status: { notIn: NOT_VOIDED },
        createdAt: { gte: windowStart, lt: windowEnd },
      },
      select: { totalPaise: true, createdAt: true },
    }),
    prisma.order.aggregate({
      where: {
        paymentStatus: { in: SETTLED },
        status: { notIn: NOT_VOIDED },
        createdAt: { gte: prevWindowStart, lt: windowStart },
      },
      _sum: { totalPaise: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: {
        paymentStatus: { in: SETTLED },
        status: { notIn: NOT_VOIDED },
        customerId: { not: null },
        createdAt: { gte: windowStart, lt: windowEnd },
      },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { paymentStatus: { in: SETTLED }, status: { notIn: NOT_VOIDED }, customerId: { not: null } },
      _count: true,
      _min: { createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { quantity: true, discountPercent: true, intervalDays: true, variant: { select: { pricePaise: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productName"],
      where: {
        order: {
          paymentStatus: { in: SETTLED },
          status: { notIn: NOT_VOIDED },
          createdAt: { gte: topProductsSince, lt: windowEnd },
        },
      },
      _sum: { linePaise: true, quantity: true },
      orderBy: { _sum: { linePaise: "desc" } },
      take: 6,
    }),
    prisma.order.groupBy({
      by: ["couponCode"],
      where: { paymentStatus: { in: SETTLED }, status: { notIn: NOT_VOIDED }, couponCode: { not: null } },
      _sum: { discountPaise: true },
      _count: true,
      orderBy: { _sum: { discountPaise: "desc" } },
      take: 8,
    }),
  ]);

  const revenueCurr = currentOrders.reduce((s, o) => s + o.totalPaise, 0);
  const ordersCurr = currentOrders.length;
  const revenuePrev = prevAgg._sum.totalPaise ?? 0;
  const ordersPrev = prevAgg._count;
  const aov = ordersCurr > 0 ? Math.round(revenueCurr / ordersCurr) : 0;

  const firstOrderMap = new Map(allCustomerFirstOrder.map((r) => [r.customerId, r]));
  const totalCustomersWithOrders = allCustomerFirstOrder.length;
  const repeatCustomers = allCustomerFirstOrder.filter((r) => r._count >= 2).length;
  const repeatRate =
    totalCustomersWithOrders > 0 ? Math.round((repeatCustomers / totalCustomersWithOrders) * 100) : 0;

  let newInWindow = 0;
  let returningInWindow = 0;
  for (const row of inWindowCustomers) {
    const first = firstOrderMap.get(row.customerId);
    if (first?._min.createdAt && first._min.createdAt < windowStart) returningInWindow++;
    else newInWindow++;
  }

  const mrrPaise = Math.round(
    activeSubs.reduce((sum, s) => {
      const cycleRevenue = s.variant.pricePaise * s.quantity * (1 - s.discountPercent / 100);
      return sum + cycleRevenue * (30 / s.intervalDays);
    }, 0),
  );

  const stats: { label: string; value: string; caption?: React.ReactNode }[] = [
    { label: "Revenue (30d)", value: formatINR(revenueCurr), caption: deltaNode(revenueCurr, revenuePrev) },
    { label: "Orders (30d)", value: String(ordersCurr), caption: deltaNode(ordersCurr, ordersPrev) },
    {
      label: "Avg order value",
      value: formatINR(aov),
      caption: <span className="text-ink/50">across {ordersCurr} order{ordersCurr === 1 ? "" : "s"}</span>,
    },
    {
      label: "New customers (30d)",
      value: String(newInWindow),
      caption: <span className="text-ink/50">{returningInWindow} returning</span>,
    },
    {
      label: "Repeat customer rate",
      value: `${repeatRate}%`,
      caption: (
        <span className="text-ink/50">
          {repeatCustomers} of {totalCustomersWithOrders} customers
        </span>
      ),
    },
    {
      label: "Recurring revenue",
      value: `${formatINR(mrrPaise)}/mo`,
      caption: <span className="text-ink/50">{activeSubs.length} active subscription{activeSubs.length === 1 ? "" : "s"}</span>,
    },
  ];

  // Daily revenue buckets for the trend chart — same window/filter as the
  // headline stats above, so the chart total always matches the tile.
  const dayBuckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    // IST calendar-date key: shift then read back via toISOString (same
    // technique as istMidnight/financialYearLabel), not the UTC date the
    // instant itself would print as.
    dayBuckets.set(toIST(new Date(windowStart.getTime() + i * DAY_MS)).toISOString().slice(0, 10), 0);
  }
  for (const o of currentOrders) {
    const key = toIST(o.createdAt).toISOString().slice(0, 10);
    if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + o.totalPaise);
  }
  const days = Array.from(dayBuckets.entries()).map(([date, paise]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
    paise,
  }));
  const maxDayPaise = Math.max(1, ...days.map((d) => d.paise));

  const maxProductPaise = Math.max(1, ...topProducts.map((p) => p._sum.linePaise ?? 0));

  return (
    <div>
      <h1 className="font-serif text-3xl">Analytics</h1>
      <p className="mt-1 text-sm text-ink/55">
        Revenue, retention and subscriptions — last 30 days vs. the 30 days before.
      </p>

      <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-paper p-5">
            <p className="smallcaps text-ink/55">{s.label}</p>
            <p className="mt-1.5 font-serif text-2xl text-ink">{s.value}</p>
            {s.caption && <p className="mt-1 text-xs">{s.caption}</p>}
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <h2 className="mt-10 smallcaps text-brass-deep">Revenue, last 30 days</h2>
      <div className="mt-4 overflow-x-auto border border-line bg-paper p-5">
        <div className="flex min-w-[680px] items-end gap-[2px]" style={{ height: 120 }}>
          {days.map((d) => {
            const heightPx = Math.max(2, Math.round((d.paise / maxDayPaise) * 112));
            return (
              <div
                key={d.date}
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${formatINR(d.paise)}`}
                className="group relative w-full shrink-0 outline-none"
              >
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-bone group-hover:block group-focus:block">
                  {d.label} · {formatINR(d.paise)}
                </span>
                <span
                  title={`${d.label}: ${formatINR(d.paise)}`}
                  className="block w-full rounded-t-[4px] bg-forest transition-colors group-hover:bg-brass-deep group-focus:bg-brass-deep"
                  style={{ height: heightPx }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <details className="mt-3">
        <summary className="smallcaps cursor-pointer text-ink/60 transition-colors hover:text-forest">View as table</summary>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-paper text-left smallcaps text-ink/60">
              <tr>
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-line/70">
                  <td className="px-4 py-2 text-ink/80">{d.label}</td>
                  <td className="px-4 py-2 tabular-nums text-ink">{formatINR(d.paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Top products */}
      <h2 className="mt-10 smallcaps text-brass-deep">Top products, last 90 days</h2>
      {topProducts.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">No settled orders yet.</p>
      ) : (
        <div className="mt-4 space-y-3 border border-line bg-paper p-5">
          {topProducts.map((p) => {
            const linePaise = p._sum.linePaise ?? 0;
            const pct = (linePaise / maxProductPaise) * 100;
            return (
              <div key={p.productName}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                  <span className="text-ink">{p.productName}</span>
                  <span className="text-ink/60">
                    {formatINR(linePaise)} · {p._sum.quantity ?? 0} sold
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-r-[4px] bg-line">
                  <div className="h-2 rounded-r-[4px] bg-forest" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Coupon performance */}
      <h2 className="mt-10 smallcaps text-brass-deep">Coupon performance</h2>
      <p className="mt-1 text-xs text-ink/50">All-time, not limited to the last 30 days.</p>
      {couponUsage.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">No coupons redeemed yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-paper text-left smallcaps text-ink/60">
              <tr>
                <th className="px-4 py-3 font-normal">Code</th>
                <th className="px-4 py-3 font-normal">Redemptions</th>
                <th className="px-4 py-3 font-normal">Discount given</th>
              </tr>
            </thead>
            <tbody>
              {couponUsage.map((c) => (
                <tr key={c.couponCode} className="border-t border-line/70">
                  <td className="px-4 py-3 font-mono text-xs text-ink">{c.couponCode}</td>
                  <td className="px-4 py-3 tabular-nums text-ink/80">{c._count}</td>
                  <td className="px-4 py-3 tabular-nums text-ink/80">{formatINR(c._sum.discountPaise ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
