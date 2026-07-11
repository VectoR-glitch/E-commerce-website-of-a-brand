import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { buildReorderItems } from "@/lib/reorder";
import { ORDER_STATUS_LABEL, orderStatusBadgeClass, paymentMethodLabel } from "@/lib/order-display";
import { ReorderButton } from "@/components/reorder-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order Details" };

export default async function AccountOrderDetail(props: { params: Promise<{ id: string }> }) {
  const session = await requireSession("/account/orders");
  const { id } = await props.params;

  // Scope to the signed-in customer — a customer can only view their own order.
  const order = await prisma.order.findFirst({
    where: { id, customerId: session.sub },
    include: { items: true },
  });
  if (!order) notFound();

  const isCod = order.paymentMethod === "COD";
  const codDue = order.totalPaise - order.amountPaidPaise;
  const reorder = await buildReorderItems(order.items);

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <Link href="/account/orders" className="smallcaps text-ink/60 hover:text-forest">← Orders</Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-3xl">{order.orderNumber}</h1>
        <span
          className={`smallcaps border px-2.5 py-1 text-xs ${orderStatusBadgeClass(order.status)}`}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/55">
          Placed {order.createdAt.toISOString().slice(0, 10)} · {paymentMethodLabel(order.paymentMethod)}
        </p>
        <div className="flex items-center gap-3">
          {order.invoiceNumber && (
            <a
              href={`/api/invoice/${order.id}`}
              className="smallcaps border border-line px-4 py-2 text-ink/70 transition-colors hover:border-forest hover:text-forest"
            >
              Download invoice
            </a>
          )}
          <ReorderButton items={reorder.items} unavailableCount={reorder.unavailable.length} />
        </div>
      </div>
      {reorder.unavailable.length > 0 && (
        <p className="mt-2 text-xs text-ink/45">
          No longer available: {reorder.unavailable.join(", ")}
        </p>
      )}

      {/* Items */}
      <div className="mt-6 border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Items</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b border-line/70">
                <td className="py-2">
                  <div className="text-ink">{it.productName}</div>
                  <div className="text-xs text-ink/55">
                    {[it.fragrance, it.size].filter(Boolean).join(" · ")}
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
          {isCod && (
            <div className="flex justify-between font-semibold text-forest"><dt>Cash due on delivery</dt><dd>{formatINR(codDue)}</dd></div>
          )}
        </dl>
      </div>

      {/* Shipping address */}
      <div className="mt-4 border border-line bg-paper p-5 text-sm">
        <h2 className="smallcaps text-brass-deep">Shipping to</h2>
        <div className="mt-2 leading-relaxed text-ink/80">
          <div className="text-ink">{order.shipName}</div>
          <div>{order.shipLine1}</div>
          {order.shipLine2 && <div>{order.shipLine2}</div>}
          <div>{order.shipCity}, {order.shipState} — {order.shipPincode}</div>
        </div>
      </div>
    </div>
  );
}