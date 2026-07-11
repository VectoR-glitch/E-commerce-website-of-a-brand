import "server-only";
// GST invoicing — tax math, invoice numbering, and the supplier's own
// registration details. Bharat Bliss is registered under the REGULAR GST
// scheme in West Bengal (GSTIN prefix "19" = the West Bengal state code),
// confirmed 2026-07-04. All products currently share HSN 34022 at 18% GST,
// though the math below is written generically per line (from each
// OrderItem's own snapshotted hsnCode/gstPercent) so a future product at a
// different rate is handled correctly, not just the uniform case.
//
// NOT reviewed by a lawyer or accountant. One specific assumption here is
// flagged for their sign-off (see klenich-legal-review-status project memory):
// "This is a computer-generated invoice" is treated as sufficient in place of
// a physical/digital signature. Delivery/shipping is charged with NO GST
// (explicit business decision, 2026-07-06) — shown as its own untaxed line
// added after the goods' tax-inclusive subtotal.
import type { Prisma } from "@prisma/client";
import { INDIAN_STATES } from "@/lib/constants";

// Deliberately DIFFERENT from the address/phone/email shown on Privacy,
// Terms, and Contact — this is the GST-registered supplier address, used only
// on invoices/bills. The public-facing pages intentionally show a separate
// customer correspondence address. Confirmed intentional 2026-07-11 — don't
// "fix" by unifying the two; if either needs to change, change it here only.
export const SUPPLIER = {
  legalName: "Bharat Bliss Private Limited",
  brand: "Klenich",
  addressLines: [
    "C/O Debu Mondal, Kanjial Para, Reckjoani,",
    "Rajarhat, New Town, North Twenty Four Parganas,",
    "West Bengal 700135",
  ],
  gstin: "19AANCB7497G1ZY",
  pan: "AANCB7497G",
  mobile: "9748384735",
  email: "bharatbliss@mybharatbliss.com",
  websites: ["www.mybharatbliss.com", "www.klenich.com"],
  state: "West Bengal",
  stateCode: "19",
};

// Official GST state/UT codes, keyed to match INDIAN_STATES exactly so a
// dropdown value always resolves. (Andhra Pradesh here is the post-2014
// bifurcation code 37 — the pre-bifurcation "28" is no longer issued.)
const GST_STATE_CODES: Record<string, string> = {
  "Jammu & Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra & Nagar Haveli and Daman & Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman & Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

export function gstStateCode(state: string): string | null {
  return GST_STATE_CODES[state] ?? null;
}

// Sanity check at module load: every dropdown state must resolve to a code.
if (process.env.NODE_ENV !== "production") {
  const missing = INDIAN_STATES.filter((s) => !GST_STATE_CODES[s]);
  if (missing.length > 0) {
    console.warn(`gst.ts: missing GST state code for: ${missing.join(", ")}`);
  }
}

export function isIntraState(shipState: string): boolean {
  return shipState.trim().toLowerCase() === SUPPLIER.state.toLowerCase();
}

// Indian financial year: 1 April – 31 March, labelled e.g. "2026-27".
export function financialYearLabel(date: Date): string {
  const y = date.getFullYear();
  const fyStart = date.getMonth() >= 3 ? y : y - 1; // getMonth() 3 = April
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

// Atomically allocates the next sequential invoice number for the financial
// year containing `date`. MUST be called inside the same transaction that
// commits the order it's assigned to — GST invoice numbers must never be
// skipped, reused, or issued out of order.
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const fy = financialYearLabel(date);
  const seq = await tx.invoiceSequence.upsert({
    where: { id: fy },
    create: { id: fy, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `KLN/${fy}/${String(seq.lastNumber).padStart(5, "0")}`;
}

export type InvoiceLine = {
  description: string;
  hsnCode: string;
  gstPercent: number;
  quantity: number;
  unitPaise: number;
  taxableValuePaise: number; // this line's ex-tax value, net of its share of any discount
  taxPaise: number; // this line's tax (CGST+SGST or IGST combined), same net-of-discount basis
  grossPaise: number; // taxableValuePaise + taxPaise — the tax-inclusive line total shown to the buyer
};

export type TaxGroup = {
  hsnCode: string;
  gstPercent: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

export type ShippingLine = {
  taxableValuePaise: number; // === grossPaise — delivery carries no GST, so nothing is deducted from it
  taxPaise: number; // always 0
  grossPaise: number;
  gstPercent: number; // always 0
};

export type InvoiceBreakdown = {
  intraState: boolean;
  lines: InvoiceLine[];
  shippingLine: ShippingLine; // delivery — untaxed, added after the goods subtotal below
  taxGroups: TaxGroup[]; // grouped by (hsnCode, gstPercent) — goods only, shipping is never taxed
  totals: {
    goodsTotalPaise: number; // sum of line grossPaise (tax incl., net of discount) — goods only, EXCLUDES delivery
    taxableValuePaise: number; // goods only, ex-tax — the compliance figure (matches taxGroups sum)
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    grandTotalPaise: number; // === order.totalPaise, always — the same figure shown at checkout before paying
  };
};

type OrderForGst = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shipState: string;
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

// Back-calculates the tax portion of a tax-inclusive amount at `gstPercent`.
// Exact by construction: taxable + tax === grossPaise always.
function splitInclusive(grossPaise: number, gstPercent: number): { taxableValuePaise: number; taxPaise: number } {
  const taxableValuePaise = Math.round((grossPaise * 100) / (100 + gstPercent));
  return { taxableValuePaise, taxPaise: grossPaise - taxableValuePaise };
}

/**
 * Computes the GST breakdown for a settled order: itemized lines (for
 * display) plus an authoritative tax summary grouped by HSN+rate, the way a
 * real GST invoice presents it. The summary's totals always reconcile exactly
 * to order.totalPaise — each group's tax is derived from that group's own
 * gross tax-inclusive share, not summed from independently-rounded line
 * amounts, so there's no cumulative rounding drift.
 *
 * Discount is allocated pro-rata across goods lines by their gross value
 * (never against shipping, matching how checkout applies it). Delivery carries
 * no GST — it's added as a flat, untaxed amount after the goods' tax-inclusive
 * subtotal (see the module-level note).
 */
export function computeInvoiceBreakdown(order: OrderForGst): InvoiceBreakdown {
  const intraState = isIntraState(order.shipState);

  const lines: InvoiceLine[] = [];
  const discountable = order.subtotalPaise;
  let discountAllocated = 0;

  order.items.forEach((it, i) => {
    const isLast = i === order.items.length - 1;
    // Pro-rata share of the discount, remainder absorbed by the last line so
    // the sum of allocations always equals discountPaise exactly.
    const share = isLast
      ? order.discountPaise - discountAllocated
      : discountable > 0
        ? Math.round((order.discountPaise * it.linePaise) / discountable)
        : 0;
    discountAllocated += share;

    const grossPaise = it.linePaise - share;
    const { taxableValuePaise, taxPaise } = splitInclusive(grossPaise, it.gstPercent);

    lines.push({
      description: [it.productName, [it.fragrance, it.size].filter(Boolean).join(" · ")]
        .filter(Boolean)
        .join(" — "),
      hsnCode: it.hsnCode,
      gstPercent: it.gstPercent,
      quantity: it.quantity,
      unitPaise: it.unitPaise,
      taxableValuePaise,
      taxPaise,
      grossPaise,
    });
  });

  // Delivery carries no GST — a flat untaxed line, never folded into a tax group.
  const shippingLine: ShippingLine = {
    taxableValuePaise: order.shippingPaise,
    taxPaise: 0,
    grossPaise: order.shippingPaise,
    gstPercent: 0,
  };

  // Group by (hsnCode, gstPercent) for the tax summary — goods only.
  const groupKey = (hsnCode: string, gstPercent: number) => `${hsnCode}|${gstPercent}`;
  const groupTotals = new Map<string, { hsnCode: string; gstPercent: number; grossPaise: number }>();
  order.items.forEach((it, i) => {
    const key = groupKey(it.hsnCode, it.gstPercent);
    const share = lines[i].grossPaise;
    const existing = groupTotals.get(key);
    if (existing) existing.grossPaise += share;
    else groupTotals.set(key, { hsnCode: it.hsnCode, gstPercent: it.gstPercent, grossPaise: share });
  });

  const taxGroups: TaxGroup[] = [...groupTotals.values()].map((g) => {
    const { taxableValuePaise, taxPaise } = splitInclusive(g.grossPaise, g.gstPercent);
    if (intraState) {
      const cgstPaise = Math.round(taxPaise / 2);
      return { hsnCode: g.hsnCode, gstPercent: g.gstPercent, taxableValuePaise, cgstPaise, sgstPaise: taxPaise - cgstPaise, igstPaise: 0 };
    }
    return { hsnCode: g.hsnCode, gstPercent: g.gstPercent, taxableValuePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise };
  });

  const totals = taxGroups.reduce(
    (acc, g) => ({
      goodsTotalPaise: acc.goodsTotalPaise,
      taxableValuePaise: acc.taxableValuePaise + g.taxableValuePaise,
      cgstPaise: acc.cgstPaise + g.cgstPaise,
      sgstPaise: acc.sgstPaise + g.sgstPaise,
      igstPaise: acc.igstPaise + g.igstPaise,
      grandTotalPaise: acc.grandTotalPaise,
    }),
    {
      goodsTotalPaise: lines.reduce((s, l) => s + l.grossPaise, 0),
      taxableValuePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      grandTotalPaise: order.totalPaise,
    },
  );

  return { intraState, lines, shippingLine, taxGroups, totals };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
}

function threeDigitWords(n: number): string {
  if (n < 100) return twoDigitWords(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigitWords(n % 100)}` : ""}`;
}

// Indian numbering (crore/lakh/thousand), e.g. 1234567 -> "Twelve Lakh Thirty
// Four Thousand Five Hundred Sixty Seven".
function numberWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const hundred = n % 1e3;
  return [
    crore ? `${threeDigitWords(crore)} Crore` : "",
    lakh ? `${threeDigitWords(lakh)} Lakh` : "",
    thousand ? `${threeDigitWords(thousand)} Thousand` : "",
    hundred ? threeDigitWords(hundred) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// e.g. 65300 paise -> "Rupees Six Hundred Fifty Three Only".
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const remainderPaise = paise % 100;
  let words = `Rupees ${numberWords(rupees)}`;
  if (remainderPaise > 0) words += ` and ${numberWords(remainderPaise)} Paise`;
  return `${words} Only`;
}
