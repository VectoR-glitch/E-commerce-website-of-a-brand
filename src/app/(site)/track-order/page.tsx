"use client";

import { useState } from "react";
import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/kicker";
import { OrderTrackingView } from "@/components/order-tracking-view";
import type { OrderTracking } from "@/lib/order-tracking";

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setTracking(data.tracking as OrderTracking);
    } catch {
      setError("Couldn’t reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-8 py-20">
      <Reveal>
        <header className="text-center">
          <Kicker>Track Order</Kicker>
          <h1 className="mt-4 font-serif text-5xl">Where&rsquo;s my order?</h1>
          <Ornament className="mt-6" />
          <p className="mt-4 text-ink/65">
            Enter your order number and the email used at checkout to see its status.
          </p>
        </header>
      </Reveal>

      <Reveal delay={120}>
        {tracking ? (
          <div className="mt-10">
            <OrderTrackingView tracking={tracking} />
            <button
              type="button"
              onClick={() => {
                setTracking(null);
                setError(null);
              }}
              className="smallcaps mt-4 text-ink/60 hover:text-forest"
            >
              ← Look up another order
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <label className="block">
              <span className="smallcaps mb-2 block text-ink/70">Order Number</span>
              <input
                required
                placeholder="KLN-2026-0042"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
              />
            </label>
            <label className="block">
              <span className="smallcaps mb-2 block text-ink/70">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
              />
            </label>
            {error && (
              <p role="alert" className="border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="smallcaps w-full bg-forest px-9 py-4 text-bone btn-fill-forest disabled:opacity-60"
            >
              {loading ? "Checking…" : "Track Order"}
            </button>
            <p className="text-center text-sm text-ink/55">
              Can&rsquo;t find it?{" "}
              <Link href="/contact" className="text-forest underline underline-offset-2">
                Contact us
              </Link>{" "}
              and we&rsquo;ll check for you.
            </p>
          </form>
        )}
      </Reveal>
    </div>
  );
}
