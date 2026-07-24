// Shared commerce limits. Kept here (no "use client") so both client
// components and server route handlers can import them from one source.

// localStorage key set by ANY successful newsletter signup (footer form,
// popup form, or any future entry point) — shared here (rather than defined
// in newsletter-popup.tsx and imported by newsletter-form.tsx) specifically
// to avoid a circular import between the two, since the popup already
// imports the form.
export const NEWSLETTER_POPUP_DISMISSED_KEY = "klenich_newsletter_popup_dismissed";

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

// Normalise a state/UT name for comparison so India Post's API spellings
// ("Jammu & Kashmir", "NCT of Delhi", etc.) line up with INDIAN_STATES.
// Shared by checkout (full address form) and the PDP pincode-delivery-check.
export function normState(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
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

// sessionStorage handoff for "add items to cart on one page, auto-apply a
// discount at checkout on the next" — used by kits (KIT- coupon), subscription
// reorders (SUB-/SUBPLAN- coupon), and read once (then cleared) on checkout
// mount. Not kit-specific despite the historical name — kept generic since
// only one such handoff is ever in flight at a time.
export const PENDING_COUPON_KEY = "klenich.pendingCoupon";

// sessionStorage handoff from /subscribe's plan builder to checkout: presence
// of this key (read once, then cleared, on checkout mount) means "this
// checkout should start a multi-item subscription plan at this cadence" — see
// SubscriptionPlan in prisma/schema.prisma. No coupon is involved for this
// first order; the discount is computed automatically in /api/checkout.
export const PENDING_SUBSCRIPTION_INTERVAL_KEY = "klenich.pendingSubscriptionIntervalDays";

// Below this many units in stock (and above zero) the storefront shows an
// urgency cue ("Only N left"). One source of truth for cards + PDP.
export const LOW_STOCK_THRESHOLD = 10;

// ── Loyalty & referral ──────────────────────────────────────────────────────
// All the tunable economics live here so the reward policy is one edit away.
// One point is worth POINT_VALUE_PAISE of discount (₹1 by default): a point is
// a ₹-denominated unit, which keeps "earn N% back" and "redeem N points = ₹N
// off" trivially legible to shoppers.
export const POINT_VALUE_PAISE = 100; // 1 point = ₹1

// Earn: tiered by lifetime points earned (Customer.lifetimePoints — a
// never-decreasing counter, so redeeming a voucher can never demote a
// customer). Each tier's earnPercent is the % of an order's net goods value
// (subtotal − discount) returned as points when the order settles — e.g. 5%
// back at 1pt=₹1 → ₹1000 spent = 50 points. Ordered ascending by threshold;
// a customer's tier is the last one whose minLifetimePoints they've reached.
export const LOYALTY_TIERS = [
  { name: "Bronze", minLifetimePoints: 0, earnPercent: 3 },
  { name: "Silver", minLifetimePoints: 300, earnPercent: 6 },
  { name: "Gold", minLifetimePoints: 1000, earnPercent: 8 },
] as const;

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

// Legal Metrology (Packaged Commodities) Rules, 2011 mandatory declarations,
// shown on every PDP. Deliberately mirrors the GST-registered SUPPLIER
// address in gst.ts (same legal entity's manufacturing address) rather than
// the separate public correspondence address on Privacy/Terms/Contact — but
// duplicated here (not imported) since gst.ts is server-only and this needs
// to render in the client PDP. If SUPPLIER's address ever changes, update
// both. Month/year of manufacture/packing is intentionally NOT stated here —
// it's printed on the physical product label instead (confirmed 2026-07-13).
export const MANUFACTURER_DECLARATION = {
  name: "Bharat Bliss Private Limited",
  addressLines: [
    "C/O Debu Mondal, Kanjial Para, Reckjoani,",
    "Rajarhat, New Town, North Twenty Four Parganas,",
    "West Bengal 700135",
  ],
  consumerCareEmail: "bharatblissofficial@gmail.com",
  consumerCarePhone: "+91 89812 21994",
};