"use client";

import { useState, useTransition } from "react";
import { requestBackInStockAlert } from "@/app/actions/back-in-stock";

// Shown on the PDP when the selected variant is sold out. Collects an email and
// registers a back-in-stock alert. Rendered with a `key={variantId}` by the
// parent, so switching to another sold-out variant gives a fresh form.
export function BackInStockForm({
  variantId,
  variantLabel,
  defaultEmail = "",
}: {
  variantId: string;
  variantLabel: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestBackInStockAlert({ variantId, email });
      if (res?.ok) {
        setDone(true);
        setMessage(
          res.alreadyInStock
            ? "Good news — it's back in stock! Refresh the page to add it to your cart."
            : "You're on the list — we'll email you the moment it's back.",
        );
      } else {
        setError(res?.error ?? "Couldn't sign you up. Please try again.");
      }
    });
  }

  return (
    <div className="mt-8 border border-line bg-bone/40 p-5">
      <p className="smallcaps text-ink/70">
        Sold out{variantLabel ? ` · ${variantLabel}` : ""}
      </p>
      {done ? (
        <p role="status" className="mt-2 text-sm text-forest">✓ {message}</p>
      ) : (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/65">
            Out of stock for now. Leave your email and we&rsquo;ll tell you the
            moment it&rsquo;s back — no spam, just this one alert.
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="back-in-stock-email" className="sr-only">Email address</label>
            <input
              id="back-in-stock-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="min-w-0 flex-1 border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
            />
            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="smallcaps shrink-0 border border-forest px-6 py-2.5 text-forest btn-fill disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "…" : "Notify me"}
            </button>
          </form>
          {error && <p role="alert" className="mt-2 text-sm text-[#b3402f]">{error}</p>}
        </>
      )}
    </div>
  );
}
