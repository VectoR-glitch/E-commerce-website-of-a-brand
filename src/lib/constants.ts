// Shared commerce limits. Kept here (no "use client") so both client
// components and server route handlers can import them from one source.

// Safe ceiling for a single order's total, in paise. Sits comfortably under
// Razorpay's per-order maximum, so the customer gets a clear message in the
// cart instead of a payment failure at checkout. Raise if you ever need to
// accept larger single orders (and confirm your Razorpay limit allows it).
export const MAX_ORDER_PAISE = 50000000; // ₹5,00,000

// Hard cap on the quantity of a single line item. The canonical source of
// truth for BOTH the client cart reducer (re-exported from cart-context) and
// the server checkout route — a crafted request bypasses the client cap, so
// the server must enforce the same bound independently.
export const MAX_QTY_PER_ITEM = 999;

// Ceiling on the GOODS value of a Cash-on-Delivery order, in paise. COD only
// prepays the delivery fee, so the goods total is our cash exposure on an order
// that may be refused at the door — cap it to limit that risk. Online orders
// are unaffected (they're fully prepaid, bounded only by MAX_ORDER_PAISE).
export const MAX_COD_ORDER_PAISE = 500000; // ₹5,000

// Flat, state-based delivery charge in paise, applied to EVERY order (online
// and COD alike) — there is no free-shipping threshold. West Bengal (our home
// state) is the regional rate; everywhere else is the national rate.
export const DELIVERY_FEE_WB_PAISE = 6400; // ₹64 — within West Bengal
export const DELIVERY_FEE_NATIONAL_PAISE = 16000; // ₹160 — rest of India

// Canonical list of Indian states + union territories — the single source for
// every address dropdown (checkout + account). Keep values exact so the
// case-insensitive delivery-fee/pincode matching stays reliable.
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar Islands", "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

// The delivery charge for a destination state. `state` is one of the fixed
// INDIAN_STATES dropdown values, so an exact, case-insensitive match is reliable.
export function deliveryFeePaise(state: string): number {
  return state.trim().toLowerCase() === "west bengal"
    ? DELIVERY_FEE_WB_PAISE
    : DELIVERY_FEE_NATIONAL_PAISE;
}

// "Subscribe & save" — the standing-order discount (percent off the subscribed
// item) and the cadences a customer can pick, in days. Snapshotted onto each
// Subscription at subscribe time, so changing this only affects new subscriptions.
export const SUBSCRIBE_SAVE_PERCENT = 10;
export const SUBSCRIBE_INTERVALS = [
  { days: 30, label: "Every month" },
  { days: 45, label: "Every 6 weeks" },
  { days: 60, label: "Every 2 months" },
];

// Below this many units in stock (and above zero) the storefront shows an
// urgency cue ("Only N left"). One source of truth for cards + PDP.
export const LOW_STOCK_THRESHOLD = 10;

// ── Loyalty & referral ──────────────────────────────────────────────────────
// All the tunable economics live here so the reward policy is one edit away.
// One point is worth POINT_VALUE_PAISE of discount (₹1 by default): a point is
// a ₹-denominated unit, which keeps "earn 5% back" and "redeem N points = ₹N
// off" trivially legible to shoppers.
export const POINT_VALUE_PAISE = 100; // 1 point = ₹1

// Earn: this % of an order's net goods value (subtotal − discount) is returned
// as points when the order settles. 5% back at 1pt=₹1 → ₹1000 spent = 50 points.
export const LOYALTY_EARN_PERCENT = 5;

// Referral: when a referred customer's FIRST order settles, both sides get a
// one-off bonus. Points (not cash), credited to each loyalty balance.
export const REFERRAL_REFERRER_BONUS_POINTS = 100; // the friend who referred
export const REFERRAL_REFEREE_BONUS_POINTS = 100; // the newly-referred customer

// Redeem: the smallest balance a customer may convert into a discount voucher,
// and how long that voucher stays valid. Redeeming mints a private, single-use
// FIXED coupon (LOYAL-<suffix>) so the saving flows through the ONE coupon
// pipeline — same trick as kits (KIT-) and subscriptions (SUB-).
export const LOYALTY_MIN_REDEEM_POINTS = 100;
export const LOYALTY_VOUCHER_TTL_DAYS = 60;

// Canonical site origin, used to build absolute URLs (JSON-LD, OG, emails).
// Override per-environment with NEXT_PUBLIC_SITE_URL; no trailing slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://klenich.com"
).replace(/\/$/, "");