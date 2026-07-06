"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/catalog";
import { INDIAN_STATES } from "@/lib/constants";
import { Reveal } from "@/components/reveal";
import { Ornament } from "@/components/ornament";
import { TrustBadges } from "@/components/trust-badges";
import { PENDING_COUPON_KEY } from "@/components/kit-picker";


// Minimal shape of the Razorpay Checkout we use.
type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  // Customises which methods show and in what order. We use it to surface UPI
  // (incl. the "UPI ID"/VPA collect flow) at the top while keeping every other
  // enabled method below it via show_default_blocks.
  config?: {
    display?: {
      blocks?: Record<
        string,
        { name: string; instruments: { method: string; flows?: string[] }[] }
      >;
      sequence?: string[];
      preferences?: { show_default_blocks?: boolean };
    };
  };
  handler: (res: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
};
type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (res: { error?: { description?: string } }) => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}


type FormState = {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  fullName: "", email: "", phone: "", line1: "", line2: "",
  city: "", state: "", pincode: "",
};

// Normalise a state/UT name for comparison so India Post spellings
// ("Jammu & Kashmir", "NCT of Delhi", etc.) line up with our dropdown values.
function normState(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
}

// Resolved India Post lookup for the entered pincode. `state` is the dropdown
// value it maps to (null if unmappable); `district` autofills a blank city.
type PinInfo = { state: string | null; district: string | null; rawState: string };

function validate(
  f: FormState,
  pin: { status: "idle" | "loading" | "done" | "error"; info: PinInfo | null },
): Errors {
  const e: Errors = {};
  if (!f.fullName.trim()) e.fullName = "Required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email";
  if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = "Enter a valid 10-digit mobile";
  if (!f.line1.trim()) e.line1 = "Required";
  if (!f.city.trim()) e.city = "Required";
  if (!f.state) e.state = "Select a state";
  if (!/^\d{6}$/.test(f.pincode)) {
    e.pincode = "Enter a valid 6-digit pincode";
  } else if (pin.status === "error") {
    e.pincode = "We couldn't verify this pincode — please check it";
  }
  // Cross-check: the pincode is authoritative for the state (it sets the
  // delivery charge), so a selected state that contradicts it is a hard error.
  if (pin.info?.state && f.state && f.state !== pin.info.state) {
    e.state = `This pincode is in ${pin.info.state}`;
  }
  return e;
}

export default function CheckoutPage() {
  const { items, subtotalPaise, clear, authenticated } = useCart();
  // Guests are prompted to log in / sign up before checking out. They can still
  // continue as a guest (dismissing the prompt) — guest checkout stays supported.
  const [guestDismissed, setGuestDismissed] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [method, setMethod] = useState<"ONLINE" | "COD">("ONLINE");
  const [errors, setErrors] = useState<Errors>({});
  const [placed, setPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paidPaise, setPaidPaise] = useState(0);
  // For COD: cash still owed for the goods on delivery (0 for prepaid online).
  const [codDuePaise, setCodDuePaise] = useState(0);
  const [shippedTo, setShippedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [pinStatus, setPinStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [pinInfo, setPinInfo] = useState<PinInfo | null>(null);
  // City-vs-state agreement, checked via India Post's post-office name search.
  // "unknown" = name not found (don't nag); "mismatch" = found only elsewhere.
  const [cityState, setCityState] = useState<
    "idle" | "checking" | "ok" | "mismatch" | "unknown"
  >("idle");
  // Live Shiprocket delivery quote for the destination pincode + cart.
  type ShipQuote = {
    serviceable: boolean;
    codAvailable?: boolean;
    prepaidPaise?: number;
    codPaise?: number | null;
  };
  const [quote, setQuote] = useState<ShipQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  // Coupon: the text input, the applied result (re-validated server-side at pay),
  // and inline status. Discount always applies to the goods subtotal.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountPaise: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  // A signed-in customer's saved address (null for guests / no saved address).
  // When present we prompt "Deliver to your saved address?" so they can fill the
  // whole form in one tap. `prefillDone` hides the prompt once used or dismissed.
  const [prefill, setPrefill] = useState<FormState | null>(null);
  const [prefillDone, setPrefillDone] = useState(false);

  // On mount, ask the server for the signed-in customer's saved address. Fails
  // silently — a guest (or no saved address) simply gets no prompt.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/prefill")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.prefill) setPrefill(data.prefill as FormState);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve a 6-digit pincode via India Post's free API, then reconcile the
  // address: the pincode is authoritative for the STATE (it sets the delivery
  // charge), so we always snap state to it. City is only filled when blank —
  // the customer's locality may legitimately differ from the district. Fails
  // silently so a flaky API can't block manual entry (validate() flags errors).
  useEffect(() => {
    const pin = form.pincode;
    if (!/^\d{6}$/.test(pin)) return; // status is gated on length at render time
    let cancelled = false;
    // "loading" is set in onPincodeChange (event handler) to avoid a
    // synchronous setState in this effect; here we only resolve the result.
    fetch(`https://api.postalpincode.in/pincode/${pin}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const offices: Array<Record<string, string>> = data?.[0]?.PostOffice ?? [];
        if (offices.length === 0) {
          setPinInfo(null);
          setPinStatus("error");
          return;
        }
        const rawState = String(offices[0].State ?? "");
        const matchedState =
          INDIAN_STATES.find((s) => normState(s) === normState(rawState)) ?? null;
        const district = offices[0].District ?? offices[0].Block ?? null;
        setPinInfo({ state: matchedState, district, rawState });
        setForm((f) => ({
          ...f,
          city: f.city.trim() ? f.city : (district ?? f.city),
          // Pincode wins for state — snap to it whenever we can map it.
          state: matchedState ?? f.state,
        }));
        setPinStatus("done");
      })
      .catch(() => {
        if (!cancelled) {
          setPinInfo(null);
          setPinStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.pincode]);

  // Verify the typed city actually sits in the selected state. India Post's
  // name search is fuzzy on spellings, so we only flag a *positive* mismatch
  // (the city exists but only in other states); a "not found" result stays
  // silent. Debounced + abortable so typing doesn't spam the API.
  useEffect(() => {
    const city = form.city.trim();
    const state = form.state;
    if (city.length < 3 || !state) {
      // Deferred so we don't setState synchronously in the effect body.
      const id = setTimeout(() => setCityState("idle"), 0);
      return () => clearTimeout(id);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCityState("checking");
      fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(city)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          const offices: Array<Record<string, string>> = data?.[0]?.PostOffice ?? [];
          if (offices.length === 0) {
            setCityState("unknown"); // can't verify — don't nag
            return;
          }
          const inState = offices.some(
            (o) => normState(String(o.State ?? "")) === normState(state),
          );
          setCityState(inState ? "ok" : "mismatch");
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setCityState("unknown");
        });
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [form.city, form.state]);

  // Stable cart signature so the rate effect only re-runs when the cart changes.
  const itemsKey = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");

  // Fetch the live delivery quote whenever the pincode (or cart/state) settles.
  // Debounced + abortable so editing the pincode doesn't spam Shiprocket.
  useEffect(() => {
    // Resets are handled in onPincodeChange (an event handler), so the invalid
    // case just bails without a synchronous setState in the effect body.
    if (!/^\d{6}$/.test(form.pincode) || itemsKey === "") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setQuoteStatus("loading");
      fetch("/api/shipping/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pincode: form.pincode,
          state: form.state,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: ShipQuote) => {
          setQuote(data);
          setQuoteStatus("done");
          // COD impossible to this pincode → flip the customer to online.
          if (data.serviceable && data.codAvailable === false) {
            setMethod((m) => (m === "COD" ? "ONLINE" : m));
          }
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setQuote(null);
            setQuoteStatus("error");
          }
        });
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode, form.state, itemsKey]);

  // If the cart subtotal changes after a coupon is applied (e.g. a percentage
  // discount, or the subtotal drops below the minimum), silently re-validate so
  // the displayed discount always matches what the server will charge.
  useEffect(() => {
    if (!coupon) return;
    let cancelled = false;
    fetch("/api/coupon/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: coupon.code,
        subtotalPaise,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          setCoupon({ code: data.code, discountPaise: data.discountPaise, label: data.label });
        } else {
          setCoupon(null);
          setCouponError(data?.error ?? "This code is no longer valid for your cart.");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalPaise]);

  // "Add kit to cart" stashes the bundle's coupon code; apply it once on arrival
  // at checkout, then clear it so a later manual visit isn't re-couponed. If
  // there's no pending kit coupon, fall back to auto-applying the signed-in
  // customer's best qualifying loyalty voucher (highest value that still meets
  // its own minimum spend) — visibly, via the same "applied" banner with a
  // Remove option, so a saved reward is never left unused by accident.
  useEffect(() => {
    let code: string | null = null;
    try {
      code = sessionStorage.getItem(PENDING_COUPON_KEY);
      if (code) sessionStorage.removeItem(PENDING_COUPON_KEY);
    } catch {
      // ignore storage errors
    }
    if (code) {
      applyCoupon(code);
      return;
    }
    fetch("/api/account/loyalty-voucher")
      .then((r) => r.json())
      .then((data: { vouchers?: { code: string; valuePaise: number }[] }) => {
        const best = (data.vouchers ?? [])
          .filter((v) => v.valuePaise <= subtotalPaise)
          .sort((a, b) => b.valuePaise - a.valuePaise)[0];
        if (best) applyCoupon(best.code);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0 && !placed) {
    return (
      <section className="mx-auto max-w-3xl px-8 py-24 text-center">
        <span className="smallcaps text-brass-deep">Checkout</span>
        <h1 className="mt-4 font-serif text-4xl">Your cart is empty</h1>
        <Link
          href="/shop"
          className="smallcaps mt-8 inline-block bg-forest px-9 py-4 text-bone btn-fill-forest"
        >
          Shop the Collection
        </Link>
      </section>
    );
  }

  // Delivery comes from the live Shiprocket quote (cheapest serviceable courier).
  // It's null until a valid pincode resolves a serviceable quote — the UI shows
  // a prompt/error in that case and blocks pay until we have a real charge.
  const serviceable = quoteStatus === "done" && quote?.serviceable === true;
  const codAvailable = serviceable && quote?.codAvailable !== false;
  const shippingPaise: number | null = !serviceable
    ? null
    : method === "COD"
      ? (quote?.codPaise ?? null)
      : (quote?.prepaidPaise ?? null);
  // Coupon discount, capped at the subtotal (never discounts shipping).
  const discountPaise = Math.min(coupon?.discountPaise ?? 0, subtotalPaise);
  const totalPaise =
    (shippingPaise == null ? subtotalPaise : subtotalPaise + shippingPaise) - discountPaise;
  // Can we take payment? Need a serviceable quote with a usable charge.
  const canPay = serviceable && shippingPaise != null;
  // Guests must make a choice first — either sign in or explicitly opt to
  // continue as a guest — before the pay button unlocks.
  const accountChosen = authenticated || guestDismissed;

  const set = (key: keyof FormState) => (
    ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: ev.target.value }));

  // Pincode gets its own handler so we can flip the lookup status to "loading"
  // here (in an event handler) rather than synchronously inside the effect.
  // Any edit invalidates the previous lookup, so clear it until it re-resolves.
  function onPincodeChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const v = ev.target.value;
    const valid = /^\d{6}$/.test(v);
    setForm((f) => ({ ...f, pincode: v }));
    setPinInfo(null);
    setPinStatus(valid ? "loading" : "idle");
    // Invalidate the previous delivery quote until the new pincode resolves.
    setQuote(null);
    setQuoteStatus(valid ? "loading" : "idle");
  }

  // Fills the whole form from the saved address and kicks off the pincode
  // lookup + delivery quote (the effects key on form.pincode, but we flip the
  // statuses here so the UI shows "verifying" immediately).
  function applyPrefill() {
    if (!prefill) return;
    setForm(prefill);
    setPrefillDone(true);
    setErrors({});
    const valid = /^\d{6}$/.test(prefill.pincode);
    setPinInfo(null);
    setPinStatus(valid ? "loading" : "idle");
    setQuote(null);
    setQuoteStatus(valid ? "loading" : "idle");
  }

  // Validate + apply a coupon against the current subtotal. The checkout route
  // re-validates authoritatively at pay time; this is the instant preview.
  async function applyCoupon(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setCouponInput(trimmed);
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          subtotalPaise,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setCoupon({ code: data.code, discountPaise: data.discountPaise, label: data.label });
        setCouponError(null);
      } else {
        setCoupon(null);
        setCouponError(data?.error ?? "This code isn’t valid.");
      }
    } catch {
      setCouponError("Couldn’t check that code. Please try again.");
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  // Live cross-checks for inline feedback (validate() enforces them on submit).
  const stateMatches =
    pinStatus === "done" && !!pinInfo?.state && form.state === pinInfo.state;
  const stateConflict =
    pinStatus === "done" &&
    !!pinInfo?.state &&
    !!form.state &&
    form.state !== pinInfo.state;
  // City↔state is a soft check (India Post name search misses some spellings,
  // e.g. "Bengaluru"), so we only warn on a *positive* contradiction.
  const cityWarning = cityState === "mismatch";

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setPayError(null);
    const e = validate(form, { status: pinStatus, info: pinInfo });
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    try {
      // 1. Create the pending order + Razorpay order on the server.
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          shipping: form,
          paymentMethod: method,
          couponCode: coupon?.code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.error ?? "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }

      // 2. Load Razorpay Checkout. Both methods pay through Razorpay now — COD
      // prepays only the delivery fee (data.amount), the goods are cash on
      // delivery; online pays the full total.
      const isCod = method === "COD";
      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) {
        setPayError("Couldn't load the payment window. Check your connection.");
        setSubmitting(false);
        return;
      }

      // 3. Open the payment popup.
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Klenich",
        description: isCod
          ? `Delivery fee · order ${data.orderNumber}`
          : `Order ${data.orderNumber}`,
        order_id: data.razorpayOrderId,
        prefill: data.prefill,
        notes: { orderNumber: data.orderNumber },
        theme: { color: "#1F3D2B" },
        // Surface UPI first — including the "UPI ID" (VPA collect) entry, plus
        // QR and app intent — while keeping all other enabled methods below it.
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay using UPI",
                instruments: [
                  // No flow restriction — exposes every UPI flow the account
                  // supports (QR, app intent, and the "Enter UPI ID" collect
                  // field once UPI Collect is enabled on the Razorpay account).
                  { method: "upi" },
                ],
              },
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (response: RazorpayResponse) => {
          // 4. Verify the signature server-side before celebrating. This runs
          // as a Razorpay SDK callback, well after the outer try/catch below
          // has already exited — so it needs its own error handling, or a
          // network hiccup / non-JSON error response leaves the button stuck
          // on "Processing" forever with setSubmitting(false) never reached.
          try {
            const verify = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const vdata = await verify.json();
            if (verify.ok && vdata.ok) {
              setPaidPaise(data.amount);
              // COD: the goods total is still owed in cash on delivery.
              setCodDuePaise(isCod ? data.totalPaise - data.amount : 0);
              setShippedTo(`${form.city}, ${form.state} — ${form.pincode}`);
              setOrderNumber(vdata.orderNumber);
              clear();
              setPlaced(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              setPayError(
                vdata.error ?? "We couldn't confirm your payment. If money was deducted, contact us.",
              );
            }
          } catch {
            setPayError(
              "We couldn't confirm your payment. If money was deducted, contact us.",
            );
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      rzp.on("payment.failed", (resp) => {
        setPayError(resp.error?.description ?? "Payment failed. Please try again.");
        setSubmitting(false);
      });
      rzp.open();
    } catch {
      setPayError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (placed) {
    return (
      <section className="mx-auto max-w-2xl px-8 py-24 text-center">
        <span className="smallcaps text-brass-deep">
          {method === "COD" ? "Order Placed" : "Payment Successful"}
        </span>
        <h1 className="mt-4 font-serif text-4xl">Thank you — order confirmed ✓</h1>
        <p className="mt-4 text-ink/65">
          {method === "COD" ? (
            <>
              Your delivery fee is paid and your order is confirmed — please keep{" "}
              <strong>{formatINR(codDuePaise)}</strong> ready to pay in cash on
              delivery. <br />
            </>
          ) : (
            <>
              We’ve received your payment and your order is being prepared.{" "}
              <br />
            </>
          )}
          A confirmation will be sent to <strong>{form.email}</strong>.
        </p>
        <div className="mx-auto mt-8 max-w-sm border border-line bg-paper p-6 text-left text-sm">
          <p className="smallcaps text-brass-deep">Order number</p>
          <p className="mt-1 font-serif text-2xl">{orderNumber}</p>
          {method === "COD" ? (
            <>
              <p className="smallcaps mt-4 text-brass-deep">Paid now (delivery)</p>
              <p className="mt-1 font-serif text-2xl">{formatINR(paidPaise)}</p>
              <p className="smallcaps mt-4 text-brass-deep">
                Due on delivery (cash)
              </p>
              <p className="mt-1 font-serif text-2xl">{formatINR(codDuePaise)}</p>
            </>
          ) : (
            <>
              <p className="smallcaps mt-4 text-brass-deep">Amount paid</p>
              <p className="mt-1 font-serif text-2xl">{formatINR(paidPaise)}</p>
            </>
          )}
          <p className="mt-3 text-ink/55">Shipping to {shippedTo}</p>
        </div>
        <Link
          href="/"
          className="smallcaps mt-8 inline-block border border-ink px-9 py-4 btn-fill"
        >
          Back to home
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-8 py-16">
      <Reveal>
        <span className="smallcaps text-brass-deep">Checkout</span>
        <h1 className="mt-4 font-serif text-4xl">Shipping details</h1>
        <Ornament align="left" className="mt-5" />
      </Reveal>

      {!authenticated && !guestDismissed && (
        <div className="fade-in mt-8 border border-forest/30 bg-forest/5 p-6">
          <p className="smallcaps text-forest">Log in to check out faster</p>
          <p className="mt-1 text-sm text-ink/70">
            Sign in or create an account to save your address, track this order, and
            keep your cart across devices.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/login?next=/checkout"
              className="smallcaps bg-forest px-6 py-2.5 text-bone btn-fill-forest"
            >
              Log in
            </Link>
            <Link
              href="/register?next=/checkout"
              className="smallcaps border border-forest px-6 py-2.5 text-forest btn-fill"
            >
              Sign up
            </Link>
            <button
              type="button"
              onClick={() => setGuestDismissed(true)}
              className="smallcaps link-underline self-center py-2.5 text-ink/55 transition-colors hover:text-forest"
            >
              Continue as guest
            </button>
          </div>
        </div>
      )}

      {prefill && !prefillDone && (
        <div className="fade-in mt-8 flex flex-wrap items-center justify-between gap-4 border border-forest/30 bg-forest/5 p-5">
          <div>
            <p className="smallcaps text-forest">Deliver to your saved address?</p>
            <p className="mt-1 text-sm text-ink/70">
              {prefill.line1}
              {prefill.line2 ? `, ${prefill.line2}` : ""}, {prefill.city}, {prefill.state} — {prefill.pincode}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={applyPrefill}
              className="smallcaps bg-forest px-5 py-2.5 text-bone btn-fill-forest"
            >
              Use this address
            </button>
            <button
              type="button"
              onClick={() => setPrefillDone(true)}
              className="smallcaps px-4 py-2.5 text-ink/55 transition-colors hover:text-forest"
            >
              Enter a new one
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-10 grid gap-12 md:grid-cols-[1fr_340px]"
        noValidate
      >
        {/* Form */}
        <Reveal delay={120} className="space-y-5">
          <Field label="Full name" error={errors.fullName}>
            <input className={inputCls(errors.fullName)} value={form.fullName} onChange={set("fullName")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              <input type="email" className={inputCls(errors.email)} value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Mobile" error={errors.phone}>
              <input inputMode="numeric" maxLength={10} placeholder="10-digit" className={inputCls(errors.phone)} value={form.phone} onChange={set("phone")} />
            </Field>
          </div>
          <Field label="Address line 1" error={errors.line1}>
            <input className={inputCls(errors.line1)} value={form.line1} onChange={set("line1")} />
          </Field>
          <Field label="Address line 2 (optional)">
            <input className={inputCls()} value={form.line2} onChange={set("line2")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="City" error={errors.city}>
              <input className={inputCls(errors.city)} value={form.city} onChange={set("city")} />
              {cityWarning && !errors.city && (
                <span className="mt-1 block text-xs text-[#9a6b1f]">
                  Doesn’t look like a city in {form.state} — double-check.
                </span>
              )}
              {cityState === "ok" && !errors.city && (
                <span className="mt-1 block text-xs text-forest">
                  ✓ In {form.state}
                </span>
              )}
            </Field>
            <Field label="State" error={errors.state}>
              <select className={inputCls(errors.state || (stateConflict ? " " : ""))} value={form.state} onChange={set("state")}>
                <option value="">Select…</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {stateConflict && !errors.state && (
                <span className="mt-1 block text-xs text-[#b3402f]">
                  This pincode is in {pinInfo?.state}.
                </span>
              )}
              {stateMatches && (
                <span className="mt-1 block text-xs text-forest">
                  ✓ Matches pincode
                </span>
              )}
            </Field>
            <Field label="Pincode" error={errors.pincode}>
              <input inputMode="numeric" maxLength={6} className={inputCls(errors.pincode)} value={form.pincode} onChange={onPincodeChange} />
              {/^\d{6}$/.test(form.pincode) && pinStatus === "loading" && (
                <span className="mt-1 block text-xs text-ink/45">Verifying…</span>
              )}
              {/^\d{6}$/.test(form.pincode) && pinStatus === "error" && !errors.pincode && (
                <span className="mt-1 block text-xs text-[#b3402f]">
                  Couldn’t verify this pincode.
                </span>
              )}
              {/^\d{6}$/.test(form.pincode) && pinStatus === "done" && (
                <span className="mt-1 block text-xs text-forest">
                  ✓ {pinInfo?.state ?? pinInfo?.rawState ?? "Verified"}
                </span>
              )}
            </Field>
          </div>
        </Reveal>

        {/* Summary */}
        <Reveal delay={220} className="md:w-[340px]">
        <aside className="h-fit border border-line bg-paper p-7">
          <p className="smallcaps text-brass-deep">Your Order</p>
          <ul className="mt-5 space-y-3 text-sm">
            {items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3">
                <span className="text-ink/70">
                  {item.name}
                  <span className="text-ink/45">
                    {" "}
                    {[item.fragrance, item.size].filter(Boolean).join(" · ")} × {item.quantity}
                  </span>
                  <span className="smallcaps mt-0.5 block text-ink/35">
                    SKU {item.sku}
                  </span>
                </span>
                <span>{formatINR(item.pricePaise * item.quantity)}</span>
              </li>
            ))}
          </ul>

          {/* Payment method */}
          <div className="mt-6 space-y-2 border-t border-line pt-5">
            <p className="smallcaps text-ink/70">Payment method</p>
            {(
              [
                ["ONLINE", "Pay online", "UPI · cards · netbanking · wallets"],
                [
                  "COD",
                  "Cash on Delivery",
                  "Prepay delivery now · pay cash for goods on delivery",
                ],
              ] as const
            ).map(([val, title, sub]) => {
              // COD is disabled when the quote says this pincode can't take it.
              const codBlocked = val === "COD" && serviceable && !codAvailable;
              return (
              <label
                key={val}
                className={`flex items-start gap-2.5 border px-3 py-2.5 text-sm transition-colors ${
                  codBlocked
                    ? "cursor-not-allowed border-line opacity-50"
                    : method === val
                      ? "cursor-pointer border-forest bg-bone"
                      : "cursor-pointer border-line"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  className="mt-0.5 accent-forest"
                  checked={method === val}
                  disabled={codBlocked}
                  onChange={() => setMethod(val)}
                />
                <span>
                  <span className="block text-ink/80">{title}</span>
                  <span className="block text-xs text-ink/45">
                    {codBlocked ? "Not available for this pincode" : sub}
                  </span>
                </span>
              </label>
              );
            })}
          </div>

          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/70">
                {method === "COD" ? "Subtotal (cash on delivery)" : "Subtotal"}
              </dt>
              <dd>{formatINR(subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/70">
                {method === "COD" ? "Delivery (pay now)" : "Delivery"}
              </dt>
              <dd>
                {shippingPaise != null
                  ? formatINR(shippingPaise)
                  : quoteStatus === "loading"
                    ? "Calculating…"
                    : quoteStatus === "done" && quote?.serviceable === false
                      ? "Not deliverable"
                      : "Enter pincode"}
              </dd>
            </div>
            {discountPaise > 0 && (
              <div className="flex justify-between text-forest">
                <dt>Discount{coupon ? ` (${coupon.code})` : ""}</dt>
                <dd>−{formatINR(discountPaise)}</dd>
              </div>
            )}
          </dl>

          {/* Coupon */}
          <div className="mt-4">
            {coupon ? (
              <div className="flex items-center justify-between gap-3 border border-forest/30 bg-forest/5 px-3 py-2 text-sm">
                <span className="text-forest">
                  <strong>{coupon.code}</strong> applied · {coupon.label}
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="smallcaps text-xs text-ink/55 transition-colors hover:text-forest"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon(couponInput);
                      }
                    }}
                    placeholder="Discount code"
                    className="w-full border border-line bg-white px-3 py-2 text-sm uppercase outline-none focus:border-forest"
                  />
                  <button
                    type="button"
                    onClick={() => applyCoupon(couponInput)}
                    disabled={couponChecking || !couponInput.trim()}
                    className="smallcaps shrink-0 border border-forest px-4 py-2 text-forest btn-fill disabled:opacity-50"
                  >
                    {couponChecking ? "…" : "Apply"}
                  </button>
                </div>
                {couponError && <p className="mt-1 text-xs text-[#b3402f]">{couponError}</p>}
              </>
            )}
          </div>

          <div className="mt-5 flex justify-between border-t border-line pt-5 font-serif text-xl">
            <span>Total</span>
            <span>{shippingPaise == null ? "—" : formatINR(totalPaise)}</span>
          </div>
          {method === "COD" && shippingPaise != null && (
            <p className="mt-2 text-xs text-ink/55">
              Pay <strong>{formatINR(shippingPaise)}</strong> now to confirm —{" "}
              <strong>{formatINR(subtotalPaise - discountPaise)}</strong> in cash on delivery.
            </p>
          )}
          {quoteStatus === "done" && quote?.serviceable === false && (
            <p className="mt-3 text-center text-xs text-[#b3402f]">
              We don’t deliver to this pincode yet — please try another address.
            </p>
          )}
          {quoteStatus === "error" && (
            <p className="mt-3 text-center text-xs text-[#b3402f]">
              Couldn’t calculate delivery — check your pincode or try again.
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !canPay || !accountChosen}
            className="smallcaps mt-7 block w-full bg-forest px-6 py-4 text-center text-bone btn-fill-forest disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "Processing…"
              : !accountChosen
                ? "Log in or continue as guest"
                : !canPay
                  ? "Enter a deliverable pincode"
                  : method === "COD"
                    ? `Pay ${formatINR(shippingPaise!)} & place order`
                    : `Pay ${formatINR(totalPaise)}`}
          </button>
          {payError && (
            <p className="mt-3 text-center text-xs text-[#b3402f]">{payError}</p>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink/55">
            <span aria-hidden>🔒</span>{" "}
            {method === "COD"
              ? "Delivery fee paid securely now · goods in cash on delivery."
              : "256-bit SSL · secure payment via Razorpay"}
          </p>
          <p className="mt-1 text-center text-xs text-ink/40">
            UPI, cards, netbanking &amp; wallets accepted.
          </p>
          <TrustBadges className="mt-7" />
          <Link
            href="/cart"
            className="smallcaps mt-4 block py-1 text-center text-ink/55 hover:text-forest"
          >
            Back to cart
          </Link>
        </aside>
        </Reveal>
      </form>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="smallcaps mb-2 block text-ink/70">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#b3402f]">{error}</span>}
    </label>
  );
}

function inputCls(error?: string) {
  return `w-full border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-forest ${
    error ? "border-[#b3402f]" : "border-line"
  }`;
}