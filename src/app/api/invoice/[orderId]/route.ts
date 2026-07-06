import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

// On-demand GST invoice PDF for a settled order. Generated fresh from stored
// data every time (fast, deterministic) rather than cached as a blob — the
// invoice number + tax snapshot are what's authoritative, not a rendered file.
// Access: the order's own customer, or an admin. Guest orders have no account
// to gate against, so they're admin-only here (the customer's copy is the one
// attached to their confirmation email).
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !order.invoiceNumber || !order.invoiceGeneratedAt) {
    return new Response("Not found", { status: 404 });
  }

  const isOwner = order.customerId !== null && order.customerId === session.sub;
  if (!isOwner && session.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const pdf = await renderInvoicePdf({
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber,
    invoiceGeneratedAt: order.invoiceGeneratedAt,
    shipName: order.shipName,
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPincode: order.shipPincode,
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    shippingPaise: order.shippingPaise,
    totalPaise: order.totalPaise,
    amountPaidPaise: order.amountPaidPaise,
    paymentMethod: order.paymentMethod,
    items: order.items,
  });

  const filename = `${order.invoiceNumber.replace(/\//g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
