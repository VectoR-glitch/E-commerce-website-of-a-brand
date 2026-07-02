import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { ORDER_STATUS_LABEL, orderStatusBadgeClass } from "@/lib/order-display";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const session = await requireSession("/account/orders");

  const orders = await prisma.order.findMany({
    where: { customerId: session.sub },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <Link href="/account" className="smallcaps text-ink/60 hover:text-forest">← Account</Link>
      <h1 className="mt-3 font-serif text-4xl">Your orders</h1>

      {orders.length === 0 ? (
        <div className="mt-10 border border-line bg-paper p-8 text-center">
          <p className="text-ink/60">You haven&rsquo;t placed any orders yet.</p>
          <Link
            href="/shop"
            className="smallcaps mt-5 inline-block bg-forest px-6 py-2.5 text-bone btn-fill-forest"
          >
            Shop the collection
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border border-line bg-paper p-5 transition-colors hover:border-forest"
              >
                <div>
                  <p className="font-mono text-sm text-ink">{o.orderNumber}</p>
                  <p className="mt-1 text-xs text-ink/55">
                    {o.createdAt.toISOString().slice(0, 10)} · {o._count.items} item
                    {o._count.items === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`smallcaps border px-2.5 py-1 text-xs ${orderStatusBadgeClass(o.status)}`}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                  <span className="font-serif text-lg">{formatINR(o.totalPaise)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}