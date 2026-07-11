import Link from "next/link";
import { Prisma, OrderStatus, PaymentStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);
const PAYMENT_METHODS = Object.values(PaymentMethod);
const PAGE_SIZE = 100;

// Matches the dashboard's "Needs fulfilment" tile link (admin/page.tsx) — a
// real <option> for this exact value so the dropdown reflects the active
// filter instead of falling back to "All", and resubmitting the form (e.g.
// adding a search term) doesn't silently drop it.
const NEEDS_FULFILMENT_STATUS = "CONFIRMED,ON_HOLD,PACKED";

type SP = { status?: string; payment?: string; method?: string; q?: string; page?: string };

// Builds a pagination link preserving the current filters, only overriding `page`.
function pageHref(sp: SP, page: number): string {
  const params = new URLSearchParams();
  if (sp.status) params.set("status", sp.status);
  if (sp.payment) params.set("payment", sp.payment);
  if (sp.method) params.set("method", sp.method);
  if (sp.q) params.set("q", sp.q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

// toISOString() is always UTC — Klenich operates in IST (UTC+5:30), so that
// silently showed a time 5.5 hours behind the actual order time.
function fmtDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function OrdersPage(props: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await props.searchParams;

  const where: Prisma.OrderWhereInput = {};
  // Comma-separated so dashboard tiles can link to a multi-status view (e.g.
  // "Needs fulfilment" = CONFIRMED+ON_HOLD+PACKED) without a second filter UI.
  const statuses = (sp.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OrderStatus => ORDER_STATUSES.includes(s as OrderStatus));
  if (statuses.length > 0) {
    where.status = { in: statuses };
  }
  if (sp.payment && PAYMENT_STATUSES.includes(sp.payment as PaymentStatus)) {
    where.paymentStatus = sp.payment as PaymentStatus;
  }
  if (sp.method && PAYMENT_METHODS.includes(sp.method as PaymentMethod)) {
    where.paymentMethod = sp.method as PaymentMethod;
  }
  const q = (sp.q ?? "").trim();
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { shipName: { contains: q, mode: "insensitive" } },
    ];
  }

  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  // Fetch one extra row to know whether a next page exists, avoiding a
  // separate COUNT query against a table that only grows over time.
  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true, orderNumber: true, createdAt: true, shipName: true, email: true,
      paymentMethod: true, paymentStatus: true, status: true, totalPaise: true, holdReason: true,
    },
  });
  const hasNext = rows.length > PAGE_SIZE;
  const orders = rows.slice(0, PAGE_SIZE);

  const labelCls = "smallcaps text-brass-deep block mb-1";
  const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Orders</h1>
        <span className="text-sm text-ink/60">
          {page > 1 ? `Page ${page} · ` : ""}
          {orders.length} shown
        </span>
      </div>

      {/* GET form → server-side filtering, no client JS */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 border border-line bg-paper p-4">
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" defaultValue={sp.status ?? ""} className={fieldCls}>
            <option value="">All</option>
            <option value={NEEDS_FULFILMENT_STATUS}>Needs fulfilment</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment</label>
          <select name="payment" defaultValue={sp.payment ?? ""} className={fieldCls}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Method</label>
          <select name="method" defaultValue={sp.method ?? ""} className={fieldCls}>
            <option value="">All</option>
            {PAYMENT_METHODS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelCls}>Search (order # / email / name)</label>
          <input name="q" defaultValue={q} placeholder="KLN-2026-… or email" className={`${fieldCls} w-full`} />
        </div>
        <button type="submit" className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Filter</button>
        <Link href="/admin/orders" className="smallcaps px-3 py-2 text-ink/60 transition-colors hover:text-forest">Reset</Link>
      </form>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Payment</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line transition-colors hover:bg-paper/60">
                <td className="px-3 py-2">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-forest hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-ink/70">{fmtDate(o.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="text-ink">{o.shipName}</div>
                  <div className="text-xs text-ink/55">{o.email}</div>
                </td>
                <td className="px-3 py-2 text-ink/70">{o.paymentMethod}</td>
                <td className="px-3 py-2 text-ink/70">{o.paymentStatus}</td>
                <td className="px-3 py-2 text-ink/70">
                  {o.status}
                  {o.holdReason && (
                    <span title={o.holdReason} className="ml-1 cursor-help text-amber-600">⚠</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-ink">{formatINR(o.totalPaise)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-ink/50">No orders match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(page > 1 || hasNext) && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Link href={pageHref(sp, page - 1)} className="smallcaps text-forest hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink/50">Page {page}</span>
          {hasNext ? (
            <Link href={pageHref(sp, page + 1)} className="smallcaps text-forest hover:underline">
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