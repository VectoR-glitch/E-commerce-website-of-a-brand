// Server-only Ekart Logistics client: auth-token caching, a serviceability/rate
// quote for the checkout flow, and shipment create/track/cancel for the admin
// panel. Never import from client code — the API credentials must never reach
// the browser. Replaces src/lib/shiprocket.ts (left in place, unreferenced, as
// a rollback path — see its own file header).
//
// Env:
//   EKART_CLIENT_ID      — from the Elite dashboard → Settings → API Settings
//   EKART_USERNAME        — the account login used to trade for a bearer token
//   EKART_PASSWORD        — that account's password
//   EKART_PICKUP_PINCODE  — origin pincode (a registered pickup address)
//   EKART_PAUSED          — kill-switch; "true" skips live calls, same as
//                           SHIPROCKET_PAUSED
import { SUPPLIER } from "@/lib/gst";
import { deliveryFeePaise } from "@/lib/constants";
import type { Order, OrderItem, Variant } from "@prisma/client";

const AUTH_BASE = "https://app.elite.ekartlogistics.in/integrations/v2";
const DATA_BASE = "https://app.elite.ekartlogistics.in/data";
const API_BASE = "https://app.elite.ekartlogistics.in/api";
// Same reasoning as shiprocket.ts: these calls sit in (or feed) the checkout
// hot path, so a bare fetch() must not be allowed to stall it indefinitely.
const FETCH_TIMEOUT_MS = 8000;

const CLIENT_ID = process.env.EKART_CLIENT_ID;
const USERNAME = process.env.EKART_USERNAME;
const PASSWORD = process.env.EKART_PASSWORD;
const PICKUP_PINCODE = process.env.EKART_PICKUP_PINCODE;

// Not fully nailed down from the doc summary — verify against a real test
// booking before the first live shipment and adjust if Ekart rejects either.
const CATEGORY_OF_GOODS = "Personal Care";
const LOCATION_TYPE = "Home";

/** Thrown for infrastructure problems (missing creds, auth failure, network /
 * 5xx) — NOT for a genuinely undeliverable pincode. Callers catch this to fall
 * back to flat shipping so an Ekart outage never takes checkout down. */
export class EkartUnavailableError extends Error {}

// Ekart tokens last ~24h (server-stated, via expires_in); cache in-module and
// refresh 5 minutes early rather than trusting a hardcoded 24h assumption.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (!CLIENT_ID || !USERNAME || !PASSWORD) {
    throw new EkartUnavailableError("Ekart credentials are not configured");
  }
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  let res: Response;
  try {
    res = await fetch(`${AUTH_BASE}/auth/token/${encodeURIComponent(CLIENT_ID)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new EkartUnavailableError(`Ekart auth network error: ${err}`);
  }
  if (!res.ok) throw new EkartUnavailableError(`Ekart auth failed: ${res.status}`);

  let data: { access_token?: string; expires_in?: number };
  try {
    data = (await res.json()) as { access_token?: string; expires_in?: number };
  } catch (err) {
    throw new EkartUnavailableError(`Ekart auth returned a non-JSON body: ${err}`);
  }
  if (!data.access_token) throw new EkartUnavailableError("Ekart auth returned no access_token");

  const expiresInMs = (data.expires_in ?? 24 * 60 * 60) * 1000;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresInMs - 5 * 60 * 1000 };
  return data.access_token;
}

async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  const token = await getToken();
  async function call(bearer: string) {
    return fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${bearer}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  }
  let res: Response;
  try {
    res = await call(token);
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; // token expired/revoked — refresh once and retry
      res = await call(await getToken());
    }
  } catch (err) {
    throw new EkartUnavailableError(`Ekart network error: ${err}`);
  }
  return res;
}

export type ShippingItem = {
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
};

/**
 * Combines each cart/order line's own per-unit box into one parcel's
 * length/width/height. Null if ANY line is missing a dimension — same
 * null-poisons-the-whole-quote contract as weightGrams. Otherwise: length and
 * width are the max across lines (the parcel's footprint can't be smaller than
 * its largest item), height is the sum of each line's height × quantity (a
 * simple "stack every box in one column" heuristic — errs toward
 * overestimating volumetric weight rather than under, the safer direction for
 * both a checkout quote and a real booking).
 */
export function combineParcelDims(
  items: ShippingItem[],
): { length: number; width: number; height: number } | null {
  let length = 0;
  let width = 0;
  let height = 0;
  for (const it of items) {
    if (it.lengthCm == null || it.widthCm == null || it.heightCm == null) return null;
    length = Math.max(length, it.lengthCm);
    width = Math.max(width, it.widthCm);
    height += it.heightCm * it.quantity;
  }
  if (length <= 0 || width <= 0 || height <= 0) return null;
  return { length, width, height };
}

type ServiceabilityDetails = {
  status?: string;
  details?: { cod?: boolean; forward_drop?: boolean };
};

async function checkServiceability(pincode: string): Promise<{ serviceable: boolean; codAvailable: boolean }> {
  let res: Response;
  try {
    res = await authedFetch(`${API_BASE}/v2/serviceability/${encodeURIComponent(pincode)}`, {
      method: "GET",
    });
  } catch (err) {
    if (err instanceof EkartUnavailableError) throw err;
    throw new EkartUnavailableError(`Ekart serviceability network error: ${err}`);
  }
  // A pincode Ekart doesn't cover at all is reported via a 404, not an outage.
  if (res.status === 404) return { serviceable: false, codAvailable: false };
  if (!res.ok) throw new EkartUnavailableError(`Ekart serviceability ${res.status}`);

  let body: ServiceabilityDetails;
  try {
    body = (await res.json()) as ServiceabilityDetails;
  } catch (err) {
    throw new EkartUnavailableError(`Ekart serviceability returned a non-JSON body: ${err}`);
  }
  return {
    serviceable: body.details?.forward_drop === true,
    codAvailable: body.details?.cod === true,
  };
}

type PricingEstimate = {
  shippingCharge?: number;
  codCharge?: number;
  total?: number;
};

async function getPricingEstimate(params: {
  dropPincode: string;
  weightGrams: number;
  dims: { length: number; width: number; height: number };
  declaredValuePaise: number;
}): Promise<PricingEstimate> {
  const rupees = params.declaredValuePaise / 100;
  let res: Response;
  try {
    res = await authedFetch(`${DATA_BASE}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupPincode: PICKUP_PINCODE,
        dropPincode: params.dropPincode,
        weight: params.weightGrams,
        length: params.dims.length,
        height: params.dims.height,
        width: params.dims.width,
        serviceType: "SURFACE",
        // Required — undocumented in the doc summary this was built from, but
        // the endpoint 400s without it. Only ever "FORWARD" here (customer
        // delivery); "REVERSE" (RTO) isn't used by this quote path.
        shippingDirection: "FORWARD",
        invoiceAmount: rupees,
        // Worst-case COD amount so the response's codCharge is populated even
        // for a prepaid order — prepaid-equivalent is then total - codCharge,
        // same trick shiprocket.ts's quote uses (rate - cod_charges).
        codAmount: rupees,
      }),
    });
  } catch (err) {
    if (err instanceof EkartUnavailableError) throw err;
    throw new EkartUnavailableError(`Ekart pricing estimate network error: ${err}`);
  }
  if (res.status === 404 || res.status === 422) return {};
  if (!res.ok) throw new EkartUnavailableError(`Ekart pricing estimate ${res.status}`);

  try {
    return (await res.json()) as PricingEstimate;
  } catch (err) {
    throw new EkartUnavailableError(`Ekart pricing estimate returned a non-JSON body: ${err}`);
  }
}

type Quote =
  | { serviceable: false }
  | {
      serviceable: true;
      prepaidPaise: number;
      codAvailable: boolean;
      codShippingPaise: number | null;
    };

/**
 * Checks serviceability for `deliveryPincode`, then (if serviceable) gets a
 * rate estimate for the given parcel. Throws EkartUnavailableError on infra
 * failure; returns {serviceable:false} when the pincode genuinely isn't
 * covered.
 */
export async function getShippingQuote(params: {
  deliveryPincode: string;
  weightGrams: number;
  dims: { length: number; width: number; height: number };
  declaredValuePaise: number;
}): Promise<Quote> {
  if (!PICKUP_PINCODE) {
    throw new EkartUnavailableError("EKART_PICKUP_PINCODE is not set");
  }

  const serviceability = await checkServiceability(params.deliveryPincode);
  if (!serviceability.serviceable) return { serviceable: false };

  const estimate = await getPricingEstimate({
    dropPincode: params.deliveryPincode,
    weightGrams: params.weightGrams,
    dims: params.dims,
    declaredValuePaise: params.declaredValuePaise,
  });
  const total = Number(estimate.total ?? NaN);
  if (!Number.isFinite(total) || total <= 0) return { serviceable: false };
  const codCharge = Number(estimate.codCharge ?? 0);

  return {
    serviceable: true,
    prepaidPaise: Math.round((total - codCharge) * 100),
    codAvailable: serviceability.codAvailable,
    codShippingPaise: serviceability.codAvailable ? Math.round(total * 100) : null,
  };
}

export type ResolvedShipping =
  | { serviceable: false }
  | {
      serviceable: true;
      codAvailable: boolean;
      prepaidPaise: number;
      codPaise: number | null;
      source: "ekart" | "fallback";
    };

/**
 * The single seam the checkout + rate endpoints share. Wraps getShippingQuote
 * with graceful degradation: on any infra failure, a paused integration, or
 * unknown parcel weight/dimensions, falls back to the flat state-based rate so
 * checkout keeps working. A genuinely undeliverable pincode is reported as
 * {serviceable:false}.
 *
 * `items` are the cart/order lines' own weight+dimensions — a missing weight
 * or dimension on ANY line poisons the whole quote (never guessed), same
 * contract shiprocket.ts's resolveShipping used for weight alone.
 */
export async function resolveShipping(params: {
  deliveryPincode: string;
  state: string;
  items: ShippingItem[];
  declaredValuePaise: number;
}): Promise<ResolvedShipping> {
  const flat = deliveryFeeFallback(params.state);

  if (process.env.EKART_PAUSED === "true") return flat;

  let weightGrams: number | null = 0;
  for (const it of params.items) {
    if (weightGrams !== null && it.weightGrams != null) weightGrams += it.weightGrams * it.quantity;
    else weightGrams = null;
  }
  if (weightGrams == null) {
    console.error("Shipping: cart has an item with no weightGrams — using flat fallback");
    return flat;
  }

  const dims = combineParcelDims(params.items);
  if (dims == null) {
    console.error("Shipping: cart has an item with no dimensions — using flat fallback");
    return flat;
  }

  try {
    const q = await getShippingQuote({
      deliveryPincode: params.deliveryPincode,
      weightGrams,
      dims,
      declaredValuePaise: params.declaredValuePaise,
    });
    if (!q.serviceable) return { serviceable: false };
    return {
      serviceable: true,
      codAvailable: q.codAvailable,
      prepaidPaise: q.prepaidPaise,
      codPaise: q.codShippingPaise,
      source: "ekart",
    };
  } catch (err) {
    if (err instanceof EkartUnavailableError) {
      console.error("Shipping: Ekart unavailable, using flat fallback:", err.message);
      return flat;
    }
    throw err;
  }
}

function deliveryFeeFallback(state: string): ResolvedShipping {
  const flat = deliveryFeePaise(state);
  return {
    serviceable: true,
    codAvailable: true,
    prepaidPaise: flat,
    codPaise: flat,
    source: "fallback",
  };
}

// ── Shipment create / track / cancel (admin panel) ──────────────────────────

type CreateShipmentInput = {
  order: Order;
  items: (OrderItem & { variant: Pick<Variant, "weightGrams" | "lengthCm" | "widthCm" | "heightCm"> | null })[];
};

export type CreatedShipment = { trackingId: string; wbn: string | null };

/**
 * Books a shipment with Ekart for an already-paid order, returning the
 * tracking id (AWB) to store on Order.ekartTrackingId. Throws
 * EkartUnavailableError on any infra/API failure OR if any item's variant is
 * missing weight/dimensions (a real booking must never guess a package size).
 */
export async function createShipment({ order, items }: CreateShipmentInput): Promise<CreatedShipment> {
  let weightGrams = 0;
  const parcelItems: ShippingItem[] = [];
  for (const it of items) {
    if (!it.variant || it.variant.weightGrams == null) {
      throw new EkartUnavailableError(`Item ${it.sku} is missing a weight — set it on the variant first.`);
    }
    weightGrams += it.variant.weightGrams * it.quantity;
    parcelItems.push({
      weightGrams: it.variant.weightGrams,
      lengthCm: it.variant.lengthCm,
      widthCm: it.variant.widthCm,
      heightCm: it.variant.heightCm,
      quantity: it.quantity,
    });
  }
  const dims = combineParcelDims(parcelItems);
  if (dims == null) {
    throw new EkartUnavailableError("One or more items are missing dimensions — set them on the variant first.");
  }

  const isCod = order.paymentMethod === "COD";
  const codDuePaise = order.totalPaise - order.amountPaidPaise;
  const rupees = (paise: number) => paise / 100;
  // Ekart's schema isn't uniform across money fields — confirmed via two real
  // 400s (ERR11004 VALIDATOR_SCHEMA): commodity_value wants a decimal STRING
  // (matches the string-formatted amounts pricing/estimate's own response
  // returns, e.g. "90.00"), but total_amount wants a plain NUMBER — an
  // all-strings pass regressed that field. Only commodity_value is a string;
  // tax_value/taxable_amount/cod_amount are assumed numbers too (untested
  // individually — the validator only reports the first violation) until a
  // real booking proves otherwise.
  const rupeeStr = (paise: number) => rupees(paise).toFixed(2);
  // location.phone confirmed via a real 400 to want an integer, not a string
  // — location.pin is the same category of numeric-looking field within the
  // same object shape, so applied here too, though unconfirmed individually.
  const asInt = (s: string) => Number(s.replace(/\D/g, ""));

  // SUPPLIER.addressLines (gst.ts) has no distinct city field — "Kolkata" is
  // the conventional postal city for pincode 700135 (New Town/Rajarhat), not
  // sourced from an explicit constant. Confirm against the pickup address on
  // file with Ekart before the first live booking.
  const payload = {
    seller_name: SUPPLIER.legalName,
    seller_address: SUPPLIER.addressLines.join(", "),
    seller_gst_tin: SUPPLIER.gstin,
    order_number: order.orderNumber,
    invoice_number: order.invoiceNumber ?? order.orderNumber,
    invoice_date: (order.invoiceGeneratedAt ?? order.createdAt).toISOString().slice(0, 10),
    consignee_name: order.shipName,
    consignee_alternate_phone: order.phone ?? "",
    products_desc: items.map((it) => it.productName).join(", ").slice(0, 500),
    payment_mode: isCod ? "COD" : "Prepaid",
    category_of_goods: CATEGORY_OF_GOODS,
    total_amount: rupees(order.totalPaise),
    tax_value: rupees(0),
    taxable_amount: rupees(order.subtotalPaise),
    commodity_value: rupeeStr(order.subtotalPaise),
    cod_amount: rupees(isCod ? Math.max(0, codDuePaise) : 0),
    quantity: items.reduce((n, it) => n + it.quantity, 0),
    weight: weightGrams,
    length: dims.length,
    height: dims.height,
    width: dims.width,
    drop_location: {
      location_type: LOCATION_TYPE,
      address: [order.shipLine1, order.shipLine2].filter(Boolean).join(", "),
      city: order.shipCity,
      state: order.shipState,
      country: "India",
      name: order.shipName,
      phone: asInt(order.phone ?? ""),
      pin: asInt(order.shipPincode),
    },
    pickup_location: {
      location_type: LOCATION_TYPE,
      address: SUPPLIER.addressLines.join(", "),
      city: "Kolkata",
      state: SUPPLIER.state,
      country: "India",
      name: SUPPLIER.legalName,
      phone: asInt(SUPPLIER.mobile),
      pin: asInt(PICKUP_PINCODE ?? ""),
    },
    return_location: {
      location_type: LOCATION_TYPE,
      address: SUPPLIER.addressLines.join(", "),
      city: "Kolkata",
      state: SUPPLIER.state,
      country: "India",
      name: SUPPLIER.legalName,
      phone: asInt(SUPPLIER.mobile),
      pin: asInt(PICKUP_PINCODE ?? ""),
    },
  };

  let res: Response;
  try {
    res = await authedFetch(`${API_BASE}/v1/package/create`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof EkartUnavailableError) throw err;
    throw new EkartUnavailableError(`Ekart create-shipment network error: ${err}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new EkartUnavailableError(`Ekart create-shipment ${res.status}: ${text.slice(0, 300)}`);
  }

  let body: { tracking_id?: string; barcodes?: { wbn?: string } };
  try {
    body = (await res.json()) as { tracking_id?: string; barcodes?: { wbn?: string } };
  } catch (err) {
    throw new EkartUnavailableError(`Ekart create-shipment returned a non-JSON body: ${err}`);
  }
  if (!body.tracking_id) throw new EkartUnavailableError("Ekart create-shipment returned no tracking_id");

  return { trackingId: body.tracking_id, wbn: body.barcodes?.wbn ?? null };
}

export type TrackedShipment = { status: string };

export async function trackShipment(trackingId: string): Promise<TrackedShipment> {
  let res: Response;
  try {
    res = await authedFetch(`${API_BASE}/v1/track/${encodeURIComponent(trackingId)}`, { method: "GET" });
  } catch (err) {
    if (err instanceof EkartUnavailableError) throw err;
    throw new EkartUnavailableError(`Ekart track network error: ${err}`);
  }
  if (!res.ok) throw new EkartUnavailableError(`Ekart track ${res.status}`);

  let body: { track?: { status?: string; desc?: string } };
  try {
    body = (await res.json()) as { track?: { status?: string; desc?: string } };
  } catch (err) {
    throw new EkartUnavailableError(`Ekart track returned a non-JSON body: ${err}`);
  }
  const status = body.track?.desc ?? body.track?.status ?? "Unknown";
  return { status };
}

export async function cancelShipment(trackingId: string): Promise<void> {
  let res: Response;
  try {
    res = await authedFetch(
      `${API_BASE}/v1/package/cancel?tracking_id=${encodeURIComponent(trackingId)}`,
      { method: "DELETE" },
    );
  } catch (err) {
    if (err instanceof EkartUnavailableError) throw err;
    throw new EkartUnavailableError(`Ekart cancel network error: ${err}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new EkartUnavailableError(`Ekart cancel ${res.status}: ${text.slice(0, 300)}`);
  }
}
