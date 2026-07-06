import "server-only";
// Renders a GST tax invoice PDF for a settled order. Pure function of already-
// stored data (order + snapshotted item HSN/GST), so the PDF is always exactly
// regenerable on demand — never stored as a separate blob.
import fs from "node:fs";
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { SUPPLIER, gstStateCode, computeInvoiceBreakdown, amountInWords } from "@/lib/gst";

// The standard 14 PDF fonts (Helvetica included) use WinAnsiEncoding, which
// has no code point for ₹ (added to Unicode in 2010, long after WinAnsi was
// frozen) — it would render as a fallback glyph, not the rupee sign. "Rs." is
// the standard workaround real Indian invoicing software uses for this exact
// reason; formatINR's "₹" (used everywhere else — the site, emails) is fine
// there since browsers/webmail have proper Unicode fonts.
function money(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Read once at module load — Next's output file tracing picks up this
// path.join(process.cwd(), ...) pattern, so it's included in the serverless
// bundle. Embedding raw bytes avoids relying on filesystem/network access
// inside @react-pdf/renderer's own image loader.
const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", "brand", "klenich-final.png"));

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1c1c1a" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 108, height: 45 },
  legalName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 6 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  originalBadge: {
    border: "1pt solid #999",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontSize: 8,
    color: "#888",
    marginBottom: 6,
  },
  muted: { color: "#6b6a64" },
  section: { marginTop: 14 },
  sectionHeader: {
    backgroundColor: "#ececec",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  box: { paddingHorizontal: 8, paddingTop: 6, lineHeight: 1.4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.5, textTransform: "uppercase", color: "#444", paddingVertical: 5, paddingRight: 6 },
  td: { paddingVertical: 4, paddingRight: 6, borderTop: "0.5pt solid #e5e5e5" },
  right: { textAlign: "right" },
  subtotalBar: { backgroundColor: "#ececec", flexDirection: "row", paddingVertical: 5, marginTop: 2 },
  footer: { marginTop: 20, paddingTop: 8, borderTop: "0.5pt solid #e0dac9", fontSize: 8, color: "#6b6a64" },
});

const COL = { num: 0.4, item: 2.3, hsn: 0.7, qty: 0.5, rate: 0.9, taxable: 1.1, tax: 1.0, amount: 1.1 };

type InvoiceOrder = {
  orderNumber: string;
  invoiceNumber: string;
  invoiceGeneratedAt: Date;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  paymentMethod: string;
  items: {
    productName: string;
    fragrance: string | null;
    size: string;
    hsnCode: string;
    gstPercent: number;
    quantity: number;
    unitPaise: number;
    linePaise: number;
  }[];
};

function InvoiceDocument({ order }: { order: InvoiceOrder }) {
  const breakdown = computeInvoiceBreakdown(order);
  const placeOfSupplyCode = gstStateCode(order.shipState);
  const dateLabel = order.invoiceGeneratedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const codDue = order.totalPaise - order.amountPaidPaise;
  // Only show a rate suffix (e.g. "@9%") when every line shares one rate —
  // with mixed rates in a future order, the summed figure spans more than one
  // percentage so no single suffix would be accurate.
  const singleRate = breakdown.taxGroups.length === 1 ? breakdown.taxGroups[0].gstPercent : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.between}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is not an HTML img; no alt prop exists */}
            <Image src={{ data: logoBuffer, format: "png" }} style={styles.logo} />
            <Text style={styles.legalName}>{SUPPLIER.legalName.toUpperCase()}</Text>
            {SUPPLIER.addressLines.map((l) => (
              <Text key={l} style={{ marginTop: 1 }}>{l}</Text>
            ))}
            <Text style={{ marginTop: 3 }}>GSTIN : {SUPPLIER.gstin}</Text>
            <Text>Mobile : {SUPPLIER.mobile}</Text>
            <Text>Email : {SUPPLIER.email}</Text>
            <Text>PAN Number : {SUPPLIER.pan}</Text>
            <Text style={{ marginTop: 3 }}>{SUPPLIER.websites.join("   ·   ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.originalBadge}>ORIGINAL</Text>
            <Text style={styles.title}>TAX INVOICE</Text>
            <View style={{ marginTop: 8, alignItems: "flex-end" }}>
              <Text>Invoice No. : {order.invoiceNumber}</Text>
              <Text style={{ marginTop: 3 }}>Invoice Date : {dateLabel}</Text>
              <Text style={{ marginTop: 3 }}>Order No. : {order.orderNumber}</Text>
            </View>
          </View>
        </View>

        {/* Bill To / Ship To — Klenich only collects one address, so both
            panels show it; kept as two panels to match a standard tax invoice's
            layout even though the content is identical. */}
        <View style={[styles.row, styles.section]}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.sectionHeader}>Bill To</Text>
            <View style={styles.box}>
              <Text>{order.shipName}</Text>
              <Text>{order.shipLine1}</Text>
              {order.shipLine2 && <Text>{order.shipLine2}</Text>}
              <Text>
                {order.shipCity}, {order.shipState} — {order.shipPincode}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.sectionHeader}>Ship To</Text>
            <View style={styles.box}>
              <Text>{order.shipName}</Text>
              <Text>{order.shipLine1}</Text>
              {order.shipLine2 && <Text>{order.shipLine2}</Text>}
              <Text>
                {order.shipCity}, {order.shipState} — {order.shipPincode}
              </Text>
              <Text style={{ marginTop: 3 }}>
                Place of supply: {order.shipState}
                {placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ""}
              </Text>
              <Text>Reverse charge: No</Text>
            </View>
          </View>
        </View>

        {/* Items — tax shown alongside each line, delivery as its own row so
            the SUBTOTAL bar below is the exact figure charged at checkout. */}
        <View style={styles.section}>
          <View style={[styles.row, { borderBottom: "0.75pt solid #999" }]}>
            <Text style={[styles.th, { flex: COL.num }]}>#</Text>
            <Text style={[styles.th, { flex: COL.item }]}>Item</Text>
            <Text style={[styles.th, { flex: COL.hsn }]}>HSN</Text>
            <Text style={[styles.th, { flex: COL.qty }, styles.right]}>Qty</Text>
            <Text style={[styles.th, { flex: COL.rate }, styles.right]}>Rate</Text>
            <Text style={[styles.th, { flex: COL.taxable }, styles.right]}>Taxable Value</Text>
            <Text style={[styles.th, { flex: COL.tax }, styles.right]}>Tax{singleRate ? ` (${singleRate}%)` : ""}</Text>
            <Text style={[styles.th, { flex: COL.amount }, styles.right]}>Amount</Text>
          </View>
          {breakdown.lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.td, { flex: COL.num }]}>{i + 1}</Text>
              <Text style={[styles.td, { flex: COL.item }]}>{line.description}</Text>
              <Text style={[styles.td, { flex: COL.hsn }]}>{line.hsnCode}</Text>
              <Text style={[styles.td, { flex: COL.qty }, styles.right]}>{line.quantity}</Text>
              <Text style={[styles.td, { flex: COL.rate }, styles.right]}>{money(line.unitPaise)}</Text>
              <Text style={[styles.td, { flex: COL.taxable }, styles.right]}>{money(line.taxableValuePaise)}</Text>
              <Text style={[styles.td, { flex: COL.tax }, styles.right]}>
                {money(line.taxPaise)}{singleRate ? "" : ` (${line.gstPercent}%)`}
              </Text>
              <Text style={[styles.td, { flex: COL.amount }, styles.right]}>{money(line.grossPaise)}</Text>
            </View>
          ))}
          {/* SUBTOTAL = the bill with tax already added (goods only) — delivery
              is untaxed, so it's added as its own row after this, not before. */}
          <View style={styles.subtotalBar}>
            <Text style={{ flex: COL.num }} />
            <Text style={[{ flex: COL.item }, { fontFamily: "Helvetica-Bold" }]}>SUBTOTAL</Text>
            <Text style={{ flex: COL.hsn }} />
            <Text style={{ flex: COL.qty }} />
            <Text style={{ flex: COL.rate }} />
            <Text style={[{ flex: COL.taxable, paddingRight: 6 }, styles.right, { fontFamily: "Helvetica-Bold" }]}>
              {money(breakdown.totals.taxableValuePaise)}
            </Text>
            <Text style={[{ flex: COL.tax, paddingRight: 6 }, styles.right, { fontFamily: "Helvetica-Bold" }]}>
              {money(breakdown.totals.cgstPaise + breakdown.totals.sgstPaise + breakdown.totals.igstPaise)}
            </Text>
            <Text style={[{ flex: COL.amount, paddingRight: 6 }, styles.right, { fontFamily: "Helvetica-Bold" }]}>
              {money(breakdown.totals.goodsTotalPaise)}
            </Text>
          </View>
          {order.shippingPaise > 0 && (
            <View style={styles.row}>
              <Text style={[styles.td, { flex: COL.num }]} />
              <Text style={[styles.td, { flex: COL.item }]}>Delivery charges</Text>
              <Text style={[styles.td, { flex: COL.hsn }]}>—</Text>
              <Text style={[styles.td, { flex: COL.qty }, styles.right]}>1</Text>
              <Text style={[styles.td, { flex: COL.rate }, styles.right]}>{money(breakdown.shippingLine.grossPaise)}</Text>
              <Text style={[styles.td, { flex: COL.taxable }, styles.right]}>{money(breakdown.shippingLine.taxableValuePaise)}</Text>
              <Text style={[styles.td, { flex: COL.tax }, styles.right]}>No GST</Text>
              <Text style={[styles.td, { flex: COL.amount }, styles.right]}>{money(breakdown.shippingLine.grossPaise)}</Text>
            </View>
          )}
          <View style={[styles.subtotalBar, { marginTop: order.shippingPaise > 0 ? 0 : 2 }]}>
            <Text style={{ flex: COL.num }} />
            <Text style={[{ flex: COL.item }, { fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
            <Text style={{ flex: COL.hsn }} />
            <Text style={{ flex: COL.qty }} />
            <Text style={{ flex: COL.rate }} />
            <Text style={{ flex: COL.taxable }} />
            <Text style={{ flex: COL.tax }} />
            <Text style={[{ flex: COL.amount, paddingRight: 6 }, styles.right, { fontFamily: "Helvetica-Bold" }]}>
              {money(breakdown.totals.grandTotalPaise)}
            </Text>
          </View>
        </View>
        {order.discountPaise > 0 && (
          <Text style={[styles.muted, { marginTop: 4, fontSize: 8 }]}>
            Includes a discount of {money(order.discountPaise)}, applied proportionally across the items above.
          </Text>
        )}

        {/* Terms (left) + tax/total summary (right) — Total Amount is always
            === order.totalPaise, the exact figure shown at checkout. */}
        <View style={[styles.row, styles.section, { gap: 16 }]}>
          <View style={{ flex: 1.3 }}>
            <Text style={[styles.sectionHeader, { backgroundColor: "transparent", paddingHorizontal: 0, color: "#806224" }]}>
              Terms and Conditions
            </Text>
            <Text style={{ marginTop: 5 }}>
              1. Returns or refunds are accepted only for damaged, defective, or wrong items, claimed within 3 days of
              delivery with an unboxing video — see klenich.com/shipping-returns.
            </Text>
            <Text style={{ marginTop: 5 }}>
              2. This invoice is governed by the laws of India, subject to the courts of Kolkata, West Bengal.
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.between}>
              <Text style={styles.muted}>Taxable Amount</Text>
              <Text>{money(breakdown.totals.taxableValuePaise)}</Text>
            </View>
            {breakdown.intraState ? (
              <>
                <View style={[styles.between, { marginTop: 3 }]}>
                  <Text style={styles.muted}>CGST{singleRate ? ` @${singleRate / 2}%` : ""}</Text>
                  <Text>{money(breakdown.totals.cgstPaise)}</Text>
                </View>
                <View style={[styles.between, { marginTop: 3 }]}>
                  <Text style={styles.muted}>SGST{singleRate ? ` @${singleRate / 2}%` : ""}</Text>
                  <Text>{money(breakdown.totals.sgstPaise)}</Text>
                </View>
              </>
            ) : (
              <View style={[styles.between, { marginTop: 3 }]}>
                <Text style={styles.muted}>IGST{singleRate ? ` @${singleRate}%` : ""}</Text>
                <Text>{money(breakdown.totals.igstPaise)}</Text>
              </View>
            )}
            {order.shippingPaise > 0 && (
              <View style={[styles.between, { marginTop: 3 }]}>
                <Text style={styles.muted}>Delivery Charges (no GST)</Text>
                <Text>{money(breakdown.shippingLine.grossPaise)}</Text>
              </View>
            )}
            <View style={[styles.between, { marginTop: 5, paddingTop: 4, borderTop: "0.75pt solid #1c1c1a" }]}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Total Amount</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{money(breakdown.totals.grandTotalPaise)}</Text>
            </View>
            <View style={[styles.between, { marginTop: 6 }]}>
              <Text style={styles.muted}>Received Amount</Text>
              <Text>{money(order.amountPaidPaise)}</Text>
            </View>
            {order.paymentMethod === "COD" && codDue > 0 && (
              <View style={[styles.between, { marginTop: 3 }]}>
                <Text style={styles.muted}>Cash due on delivery</Text>
                <Text>{money(codDue)}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.muted, { marginTop: 10, fontSize: 8 }]}>
          Total Amount (in words): {amountInWords(breakdown.totals.grandTotalPaise)}
        </Text>

        <View style={styles.footer}>
          <Text>This is a computer-generated invoice and does not require a physical signature.</Text>
          <View style={{ marginTop: 20, alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>For {SUPPLIER.legalName}</Text>
            <Text style={{ marginTop: 18 }}>Authorised Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(order: InvoiceOrder): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument order={order} />);
}

// Convenience for the settlement email path: takes the just-settled order
// (whose invoiceNumber/invoiceGeneratedAt are nullable in the DB type, even
// though settleOrderPaid always sets them in the same transaction) and
// returns null instead of throwing if they're somehow missing — email sending
// is best-effort and must never break on a defensive edge case.
export async function renderSettledOrderInvoicePdf(
  order: Omit<InvoiceOrder, "invoiceNumber" | "invoiceGeneratedAt"> & {
    invoiceNumber: string | null;
    invoiceGeneratedAt: Date | null;
  },
): Promise<{ pdf: Buffer; invoiceNumber: string } | null> {
  if (!order.invoiceNumber || !order.invoiceGeneratedAt) return null;
  const pdf = await renderInvoicePdf({
    ...order,
    invoiceNumber: order.invoiceNumber,
    invoiceGeneratedAt: order.invoiceGeneratedAt,
  });
  return { pdf, invoiceNumber: order.invoiceNumber };
}
