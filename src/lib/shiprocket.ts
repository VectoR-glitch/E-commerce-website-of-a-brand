// Server-only Shiprocket client: auth-token caching + a serviceability/rate
// quote for the checkout flow. Never import from client code — the API
// credentials must never reach the browser.
//
// Env:
//   SHIPROCKET_EMAIL          — a DEDICATED Shiprocket API user (Settings → API)
//   SHIPROCKET_PASSWORD       — that API user's password
//   SHIPROCKET_PICKUP_PINCODE — origin pincode (a registered pickup address)
import { deliveryFeePaise } from "@/lib/constants";

const BASE = "https://apiv2.shiprocket.in/v1/external";

const EMAIL = process.env.SHIPROCKET_EMAIL;
const PASSWORD = process.env.SHIPROCKET_PASSWORD;
const PICKUP_PINCODE = process.env.SHIPROCKET_PICKUP_PINCODE;

/**
 * Thrown for *infrastructure* problems (missing creds, auth failure, network /
 * 5xx) — NOT for a genuinely undeliverable pincode. Callers catch this to fall
 * back to flat shipping so a Shiprocket outage never takes checkout down.
 */
export class ShippingUnavailableError extends Error {}

// Shiprocket tokens last ~10 days; cache in-module and refresh a day early.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (!EMAIL || !PASSWORD) {
    throw new ShippingUnavailableError("Shiprocket credentials are not configured");
  }
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  let res: Response;
  try {
    res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      cache: "no-store",
    });
  } catch (err) {
    throw new ShippingUnavailableError(`Shiprocket auth network error: ${err}`);
  }
  if (!res.ok) throw new ShippingUnavailableError(`Shiprocket auth failed: ${res.status}`);

  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new ShippingUnavailableError("Shiprocket auth returned no token");

  cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return data.token;
}

type Courier = {
  rate?: number;
  cod_charges?: number;
  cod?: number; // 1 if this courier supports COD to the destination
  courier_name?: string;
};

type Quote =
  | { serviceable: false }
  | {
      serviceable: true;
      // Cheapest prepaid (online) charge across all couriers.
      prepaidPaise: number;
      codAvailable: boolean;
      // Cheapest COD-capable charge (incl. the courier's COD fee); null if none.
      codShippingPaise: number | null;
    };

/**
 * Asks Shiprocket which couriers serve `deliveryPincode` for the given parcel
 * and returns the cheapest prepaid and cheapest COD charges. A single cod=1
 * query carries per-courier `cod_charges`, so the prepaid-equivalent is just
 * `rate - cod_charges` — no second round-trip needed.
 *
 * Throws ShippingUnavailableError on infra failure; returns {serviceable:false}
 * when the pincode genuinely has no courier.
 */
export async function getShippingQuote(params: {
  deliveryPincode: string;
  weightGrams: number;
  declaredValuePaise: number;
}): Promise<Quote> {
  if (!PICKUP_PINCODE) {
    throw new ShippingUnavailableError("SHIPROCKET_PICKUP_PINCODE is not set");
  }
  const token = await getToken();

  const url = new URL(`${BASE}/courier/serviceability/`);
  url.searchParams.set("pickup_postcode", PICKUP_PINCODE);
  url.searchParams.set("delivery_postcode", params.deliveryPincode);
  // Shiprocket expects weight in KG; clamp above zero so the call never 422s.
  url.searchParams.set("weight", Math.max(0.001, params.weightGrams / 1000).toFixed(3));
  url.searchParams.set("cod", "1"); // include COD-capable couriers in the result
  url.searchParams.set("declared_value", String(Math.round(params.declaredValuePaise / 100)));

  async function call(bearer: string) {
    return fetch(url, { headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store" });
  }

  let res: Response;
  try {
    res = await call(token);
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; // token expired/revoked — refresh once and retry
      res = await call(await getToken());
    }
  } catch (err) {
    throw new ShippingUnavailableError(`Shiprocket serviceability network error: ${err}`);
  }

  // 404/422 from this endpoint means "no service to that pincode", not an outage.
  if (res.status === 404 || res.status === 422) return { serviceable: false };
  if (!res.ok) throw new ShippingUnavailableError(`Shiprocket serviceability ${res.status}`);

  const body = (await res.json()) as {
    data?: { available_courier_companies?: Courier[] };
  };
  const couriers = body.data?.available_courier_companies ?? [];
  if (couriers.length === 0) return { serviceable: false };

  let cheapestPrepaid = Infinity;
  let cheapestCod = Infinity;
  for (const c of couriers) {
    const rate = Number(c.rate ?? 0);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    const codCharge = Number(c.cod_charges ?? 0);
    const prepaid = rate - codCharge; // strip the COD fee for the online price
    if (prepaid < cheapestPrepaid) cheapestPrepaid = prepaid;
    if (Number(c.cod) === 1 && rate < cheapestCod) cheapestCod = rate;
  }
  if (!Number.isFinite(cheapestPrepaid)) return { serviceable: false };

  const codAvailable = Number.isFinite(cheapestCod);
  return {
    serviceable: true,
    prepaidPaise: Math.round(cheapestPrepaid * 100),
    codAvailable,
    codShippingPaise: codAvailable ? Math.round(cheapestCod * 100) : null,
  };
}

export type ResolvedShipping =
  | { serviceable: false }
  | {
      serviceable: true;
      codAvailable: boolean;
      prepaidPaise: number;
      codPaise: number | null;
      source: "shiprocket" | "fallback";
    };

/**
 * The single seam the checkout + rate endpoints share. Wraps getShippingQuote
 * with graceful degradation: on any infra failure (or unknown parcel weight) it
 * falls back to the flat state-based rate so checkout keeps working, logging the
 * cause. A genuinely undeliverable pincode is reported as {serviceable:false}.
 *
 * `weightGrams` is null when any cart item is missing its weight — we never
 * quote Shiprocket on a wrong weight, so that path also falls back.
 */
export async function resolveShipping(params: {
  deliveryPincode: string;
  state: string;
  weightGrams: number | null;
  declaredValuePaise: number;
}): Promise<ResolvedShipping> {
  const flat = deliveryFeePaise(params.state);
  const fallback = {
    serviceable: true as const,
    codAvailable: true,
    prepaidPaise: flat,
    codPaise: flat,
    source: "fallback" as const,
  };

  // PAUSED: the Shiprocket integration is parked (see SHIPROCKET_PAUSED in .env).
  // We keep all the code but skip the live quote and use the flat state rate.
  // Re-enable by removing SHIPROCKET_PAUSED (or setting it to anything but "true").
  if (process.env.SHIPROCKET_PAUSED === "true") return fallback;

  if (params.weightGrams == null) {
    console.error("Shipping: cart has an item with no weightGrams — using flat fallback");
    return fallback;
  }

  try {
    const q = await getShippingQuote({
      deliveryPincode: params.deliveryPincode,
      weightGrams: params.weightGrams,
      declaredValuePaise: params.declaredValuePaise,
    });
    if (!q.serviceable) return { serviceable: false };
    return {
      serviceable: true,
      codAvailable: q.codAvailable,
      prepaidPaise: q.prepaidPaise,
      codPaise: q.codShippingPaise,
      source: "shiprocket",
    };
  } catch (err) {
    if (err instanceof ShippingUnavailableError) {
      console.error("Shipping: Shiprocket unavailable, using flat fallback:", err.message);
      return fallback;
    }
    throw err;
  }
}