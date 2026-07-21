"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/catalog";
import { INDIAN_STATES, normState } from "@/lib/constants";

// PDP delivery-estimate widget — same India Post (pincode → state) + live
// Shiprocket quote pattern as checkout (see checkout/page.tsx), just for a
// single unit of one variant rather than a full cart/address form. Lets a
// visitor confirm serviceability and the delivery fee before adding to cart,
// instead of only finding out at checkout.
type Quote = {
  serviceable: boolean;
  codAvailable?: boolean;
  prepaidPaise?: number;
  codPaise?: number | null;
};

export function DeliveryCheck({ variantId }: { variantId: string }) {
  const [pincode, setPincode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
      // Deferred so we don't setState synchronously in the effect body.
      const id = setTimeout(() => {
        setStatus("idle");
        setQuote(null);
      }, 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const pinRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
          signal: controller.signal,
        });
        const pinData = await pinRes.json();
        const offices: Array<Record<string, string>> = pinData?.[0]?.PostOffice ?? [];
        if (offices.length === 0) {
          if (!cancelled) {
            setStatus("error");
            setQuote(null);
          }
          return;
        }
        const rawState = String(offices[0].State ?? "");
        const state = INDIAN_STATES.find((s) => normState(s) === normState(rawState)) ?? "";

        const rateRes = await fetch("/api/shipping/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pincode, state, items: [{ variantId, quantity: 1 }] }),
          signal: controller.signal,
        });
        if (!rateRes.ok) throw new Error(String(rateRes.status));
        const data: Quote = await rateRes.json();
        if (!cancelled) {
          setQuote(data);
          setStatus("done");
        }
      } catch (err) {
        if (!cancelled && (err as { name?: string })?.name !== "AbortError") {
          setStatus("error");
          setQuote(null);
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [pincode, variantId]);

  return (
    <div className="mt-6 border border-line bg-paper p-4">
      <label htmlFor="pdp-pincode" className="smallcaps block text-ink/70">
        Check delivery to your pincode
      </label>
      <input
        id="pdp-pincode"
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="6-digit pincode"
        value={pincode}
        onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="mt-2 w-full max-w-[10rem] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest"
      />
      {status === "loading" && <p className="mt-2 text-sm text-ink/60">Checking…</p>}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-700">
          Couldn’t verify this pincode — please check it.
        </p>
      )}
      {status === "done" && quote && (
        <div className="mt-2 text-sm">
          {quote.serviceable ? (
            <>
              <p className="text-forest">✓ Delivers to {pincode}</p>
              <p className="mt-1 text-ink/70">
                Delivery: <span className="text-ink">{formatINR(quote.prepaidPaise ?? 0)}</span>
                {quote.codAvailable && (
                  <span className="ml-2 text-ink/60">· Cash on Delivery available</span>
                )}
              </p>
            </>
          ) : (
            <p className="text-red-700">Sorry, we don’t deliver to this pincode yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
