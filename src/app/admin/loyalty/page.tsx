import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { pointsToPaise, loyaltyTier } from "@/lib/loyalty";
import { LOYALTY_TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminLoyalty() {
  await requireAdmin();

  const now = new Date();
  const [balances, referredCount, topCustomers, activeVouchers, tierCounts] = await Promise.all([
    // Outstanding points across all customers = the program's liability.
    prisma.customer.aggregate({ _sum: { points: true }, _count: { _all: true } }),
    prisma.customer.count({ where: { referredById: { not: null } } }),
    prisma.customer.findMany({
      where: { points: { gt: 0 } },
      orderBy: { points: "desc" },
      take: 15,
      select: {
        id: true,
        name: true,
        email: true,
        points: true,
        lifetimePoints: true,
        _count: { select: { referrals: true } },
      },
    }),
    // Loyalty vouchers still spendable (minted LOYAL- coupons, unused, unexpired).
    prisma.coupon.findMany({
      where: {
        code: { startsWith: "LOYAL-" },
        active: true,
        usedCount: 0,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { value: true },
    }),
    // How many customers sit in each tier (band between this tier's threshold
    // and the next one's, open-ended for the top tier).
    Promise.all(
      LOYALTY_TIERS.map((t, i) => {
        const next = LOYALTY_TIERS[i + 1];
        return prisma.customer.count({
          where: {
            lifetimePoints: { gte: t.minLifetimePoints, ...(next ? { lt: next.minLifetimePoints } : {}) },
          },
        });
      }),
    ),
  ]);

  const outstandingPoints = balances._sum.points ?? 0;
  const outstandingVoucherPaise = activeVouchers.reduce((sum, c) => sum + c.value, 0);

  const stats = [
    { label: "Points outstanding", value: outstandingPoints.toLocaleString("en-IN") },
    { label: "Points liability", value: formatINR(pointsToPaise(outstandingPoints)) },
    { label: "Unredeemed vouchers", value: `${activeVouchers.length} · ${formatINR(outstandingVoucherPaise)}` },
    { label: "Referred sign-ups", value: referredCount.toLocaleString("en-IN") },
  ];

  return (
    <div>
      <div>
        <h1 className="font-serif text-3xl">Loyalty &amp; referrals</h1>
        <p className="mt-1 text-sm text-ink/55">
          Read-only overview. Points are earned automatically on order settlement and
          redeemed by customers into single-use vouchers.
        </p>
      </div>

      <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-paper p-5">
            <p className="smallcaps text-ink/55">{s.label}</p>
            <p className="mt-1.5 font-serif text-2xl text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 smallcaps text-brass-deep">Tiers</h2>
      <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-3">
        {LOYALTY_TIERS.map((t, i) => (
          <div key={t.name} className="bg-paper p-5">
            <p className="smallcaps text-ink/55">
              {t.name} · {t.earnPercent}% back
            </p>
            <p className="mt-1.5 font-serif text-2xl text-ink">{tierCounts[i]}</p>
            <p className="mt-1 text-xs text-ink/50">
              {t.minLifetimePoints > 0 ? `${t.minLifetimePoints}+ lifetime pts` : "Starting tier"}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 smallcaps text-brass-deep">Top balances</h2>
      {topCustomers.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">No points earned yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-paper text-left smallcaps text-ink/60">
              <tr>
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Tier</th>
                <th className="px-4 py-3 font-normal">Points</th>
                <th className="px-4 py-3 font-normal">Value</th>
                <th className="px-4 py-3 font-normal">Referred</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.id} className="border-t border-line/70">
                  <td className="px-4 py-3">
                    <div className="text-ink">{c.name ?? "—"}</div>
                    <div className="text-xs text-ink/55">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{loyaltyTier(c.lifetimePoints).name}</td>
                  <td className="px-4 py-3 text-ink/80">{c.points.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-ink/70">{formatINR(pointsToPaise(c.points))}</td>
                  <td className="px-4 py-3 text-ink/70">{c._count.referrals || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
