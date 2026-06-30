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

type SP = { status?: string; payment?: string; method?: string; q?: string };

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function OrdersPage(props: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await props.searchParams;

  const where: Prisma.OrderWhereInput = {};
  if (sp.status && ORDER_STATUSES.includes(sp.status as OrderStatus)) {
    where.status = sp.status as OrderStatus;
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

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true, orderNumber: true, createdAt: true, shipName: true, email: true,
      paymentMethod: true, paymentStatus: true, status: true, totalPaise: true,
    },
  });

  const labelCls = "smallcaps text-brass-deep block mb-1";
  const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Orders</h1>
        <span className="text-sm text-ink/60">{orders.length}{orders.length === PAGE_SIZE ? "+" : ""} shown</span>
      </div>

      {/* GET form → server-side filtering, no client JS */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 border border-line bg-paper p-4">
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" defaultValue={sp.status ?? ""} className={fieldCls}>
            <option value="">All</option>
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
        <Link href="/admin/orders" className="smallcaps px-3 py-2 text-ink/60 hover:text-forest">Reset</Link>
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
              <tr key={o.id} className="border-t border-line hover:bg-paper/60">
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
                <td className="px-3 py-2 text-ink/70">{o.status}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-ink">{formatINR(o.totalPaise)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-ink/50">No orders match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}