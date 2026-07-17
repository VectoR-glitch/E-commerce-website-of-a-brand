import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { buildReorderItems } from "@/lib/reorder";
import { ORDER_STATUS_LABEL, orderStatusBadgeClass } from "@/lib/order-display";
import { ReorderButton } from "@/components/reorder-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order History" };

const PAGE_SIZE = 20;

export default async function AccountOrdersPage(props: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession("/account/orders");
  const sp = await props.searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  // A customer's full order history has no natural bound, and resolving each
  // page's reorder items is real work (a variant lookup + a batched product
  // hydration per order) — paginate like /admin/orders already does, rather
  // than loading every historical order (and re-resolving reorder items for
  // all of them) on every visit. Fetch one extra row to detect a next page
  // without a separate COUNT query.
  const rows = await prisma.order.findMany({
    where: { customerId: session.sub },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: { _count: { select: { items: true } }, items: true },
  });
  const hasNext = rows.length > PAGE_SIZE;
  const orders = rows.slice(0, PAGE_SIZE);
  // Resolve each order's items to current buyable variants for one-tap reorder.
  const reorders = new Map(
    await Promise.all(
      orders.map(async (o) => [o.id, await buildReorderItems(o.items)] as const),
    ),
  );

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
          {orders.map((o) => {
            const reorder = reorders.get(o.id);
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-line bg-paper p-5 transition-colors hover:border-forest"
              >
                <Link href={`/account/orders/${o.id}`} className="min-w-0">
                  <p className="font-mono text-sm text-ink">{o.orderNumber}</p>
                  <p className="mt-1 text-xs text-ink/55">
                    {o.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} · {o._count.items} item
                    {o._count.items === 1 ? "" : "s"}
                  </p>
                </Link>
                <div className="flex items-center gap-4">
                  <span
                    className={`smallcaps border px-2.5 py-1 text-xs ${orderStatusBadgeClass(o.status)}`}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                  <span className="font-serif text-lg">{formatINR(o.totalPaise)}</span>
                  {reorder && (
                    <ReorderButton
                      items={reorder.items}
                      unavailableCount={reorder.unavailable.length}
                      className="px-4 py-2 text-xs"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <div className="mt-6 flex items-center justify-between">
          {page > 1 ? (
            <Link href={`/account/orders?page=${page - 1}`} className="smallcaps text-forest hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink/50">Page {page}</span>
          {hasNext ? (
            <Link href={`/account/orders?page=${page + 1}`} className="smallcaps text-forest hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}