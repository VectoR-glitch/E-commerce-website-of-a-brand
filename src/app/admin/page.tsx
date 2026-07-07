import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 50;

export default async function AdminOverview() {
  await requireAdmin();

  const [statusGroups, lowStock, totalOrders, collected, openCount] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.variant.count({ where: { active: true, stock: { lt: LOW_STOCK_THRESHOLD } } }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { amountPaidPaise: true } }),
    // "Needs action" = paid orders not yet shipped/delivered/closed.
    prisma.order.count({
      where: { status: { in: ["CONFIRMED", "ON_HOLD", "PACKED"] } },
    }),
  ]);

  const counts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count]));
  const collectedPaise = collected._sum.amountPaidPaise ?? 0;

  const cards = [
    { label: "Total orders", value: String(totalOrders), href: "/admin/orders" },
    { label: "Needs fulfilment", value: String(openCount), href: "/admin/orders?status=CONFIRMED" },
    { label: "Collected", value: formatINR(collectedPaise), href: "/admin/orders" },
    { label: "Low stock", value: String(lowStock), href: "/admin/stock" },
  ];

  const STATUSES = ["PENDING", "CONFIRMED", "ON_HOLD", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

  return (
    <div>
      <h1 className="font-serif text-3xl">Overview</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="border border-line bg-paper p-5 transition-colors hover:border-forest"
          >
            <div className="smallcaps text-brass-deep">{c.label}</div>
            <div className="mt-2 font-serif text-3xl text-ink">{c.value}</div>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 smallcaps text-brass-deep">Orders by status</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className="flex items-center gap-2 border border-line bg-paper px-3 py-2 text-sm transition-colors hover:border-forest"
          >
            <span className="text-ink/70">{s}</span>
            <span className="font-semibold text-ink">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}