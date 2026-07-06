import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { updateOrderStatus, updatePaymentStatus } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);

export default async function OrderDetail(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();

  const isCod = order.paymentMethod === "COD";
  const codDue = order.totalPaise - order.amountPaidPaise;
  const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

  return (
    <div>
      <Link href="/admin/orders" className="smallcaps text-ink/60 hover:text-forest">← Orders</Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-3xl">{order.orderNumber}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink/60">{order.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
          {order.invoiceNumber && (
            <a
              href={`/api/invoice/${order.id}`}
              className="smallcaps border border-line px-3 py-1.5 text-xs text-ink/70 transition-colors hover:border-forest hover:text-forest"
            >
              Invoice {order.invoiceNumber}
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Items + totals */}
        <div className="lg:col-span-2 border border-line bg-paper p-5">
          <h2 className="smallcaps text-brass-deep">Items</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b border-line/70">
                  <td className="py-2">
                    <div className="text-ink">{it.productName}</div>
                    <div className="text-xs text-ink/55">
                      {[it.fragrance, it.size].filter(Boolean).join(" · ")} · {it.sku}
                    </div>
                  </td>
                  <td className="py-2 text-center text-ink/70">× {it.quantity}</td>
                  <td className="py-2 text-right whitespace-nowrap text-ink">{formatINR(it.linePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/60">{isCod ? "Delivery (prepaid)" : "Shipping"}</dt><dd>{formatINR(order.shippingPaise)}</dd></div>
            {order.discountPaise > 0 && (
              <div className="flex justify-between"><dt className="text-ink/60">Discount</dt><dd>−{formatINR(order.discountPaise)}</dd></div>
            )}
            <div className="flex justify-between border-t border-line pt-1 font-serif text-base"><dt>Total</dt><dd>{formatINR(order.totalPaise)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/60">Paid online</dt><dd>{formatINR(order.amountPaidPaise)}</dd></div>
            {isCod && (
              <div className="flex justify-between font-semibold text-forest"><dt>Cash due on delivery</dt><dd>{formatINR(codDue)}</dd></div>
            )}
          </dl>
        </div>

        {/* Status controls */}
        <div className="space-y-6">
          <div className="border border-line bg-paper p-5">
            <h2 className="smallcaps text-brass-deep">Fulfilment status</h2>
            <p className="mt-1 text-xs text-ink/55">Cancelling/returning a committed order restocks its items.</p>
            <form action={updateOrderStatus} className="mt-3 flex gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              {/* key forces a remount when the saved status changes, so the
                  select re-syncs to it (React 19 resets uncontrolled fields to
                  their defaultValue after a server action, otherwise reverting
                  the dropdown to its pre-save value). */}
              <select key={order.status} name="status" defaultValue={order.status} className={`${fieldCls} flex-1`}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="smallcaps bg-forest px-4 py-2 text-bone btn-fill-forest">Save</button>
            </form>
          </div>

          <div className="border border-line bg-paper p-5">
            <h2 className="smallcaps text-brass-deep">Payment status</h2>
            <p className="mt-1 text-xs text-ink/55">{order.paymentMethod} · e.g. mark COD goods collected as PAID, or REFUNDED.</p>
            <form action={updatePaymentStatus} className="mt-3 flex gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <select key={order.paymentStatus} name="paymentStatus" defaultValue={order.paymentStatus} className={`${fieldCls} flex-1`}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="smallcaps bg-forest px-4 py-2 text-bone btn-fill-forest">Save</button>
            </form>
          </div>

          <div className="border border-line bg-paper p-5 text-sm">
            <h2 className="smallcaps text-brass-deep">Ship to</h2>
            <div className="mt-2 text-ink/80 leading-relaxed">
              <div className="text-ink">{order.shipName}</div>
              <div>{order.shipLine1}</div>
              {order.shipLine2 && <div>{order.shipLine2}</div>}
              <div>{order.shipCity}, {order.shipState} — {order.shipPincode}</div>
              <div className="mt-2 text-ink/60">{order.email}</div>
              {order.phone && <div className="text-ink/60">{order.phone}</div>}
            </div>
          </div>

          {order.razorpayPaymentId && (
            <div className="border border-line bg-paper p-5 text-xs text-ink/55">
              <h2 className="smallcaps text-brass-deep">Razorpay</h2>
              <div className="mt-2 break-all">Order: {order.razorpayOrderId}</div>
              <div className="break-all">Payment: {order.razorpayPaymentId}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}