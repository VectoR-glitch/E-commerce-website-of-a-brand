// Shared commerce limits. Kept here (no "use client") so both client
// components and server route handlers can import them from one source.

// Safe ceiling for a single order's total, in paise. Sits comfortably under
// Razorpay's per-order maximum, so the customer gets a clear message in the
// cart instead of a payment failure at checkout. Raise if you ever need to
// accept larger single orders (and confirm your Razorpay limit allows it).
export const MAX_ORDER_PAISE = 50000000; // ₹5,00,000

// Flat, state-based delivery charge in paise, applied to EVERY order (online
// and COD alike) — there is no free-shipping threshold. West Bengal (our home
// state) is the regional rate; everywhere else is the national rate.
export const DELIVERY_FEE_WB_PAISE = 6400; // ₹64 — within West Bengal
export const DELIVERY_FEE_NATIONAL_PAISE = 16000; // ₹160 — rest of India

// The delivery charge for a destination state. `state` is one of the fixed
// INDIAN_STATES dropdown values, so an exact, case-insensitive match is reliable.
export function deliveryFeePaise(state: string): number {
  return state.trim().toLowerCase() === "west bengal"
    ? DELIVERY_FEE_WB_PAISE
    : DELIVERY_FEE_NATIONAL_PAISE;
}

// Canonical site origin, used to build absolute URLs (JSON-LD, OG, emails).
// Override per-environment with NEXT_PUBLIC_SITE_URL; no trailing slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://klenich.com"
).replace(/\/$/, "");