"use client";

import { useState } from "react";
import { Ornament } from "@/components/ornament";

export default function TrackOrderPage() {
  const [checked, setChecked] = useState(false);
  const [orderNo, setOrderNo] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: look up order status from Postgres by order number + email.
    setChecked(true);
  }

  return (
    <div className="mx-auto max-w-xl px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Track Order</span>
        <h1 className="mt-4 font-serif text-5xl">Where’s my order?</h1>
        <Ornament className="mt-6" />
        <p className="mt-4 text-ink/65">
          Enter your order number to check its status.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-10 flex gap-3">
        <input
          required
          placeholder="e.g. KLN-2026-0042"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          className="flex-1 border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest"
        />
        <button
          type="submit"
          className="smallcaps bg-forest px-7 py-3 text-bone btn-fill-forest"
        >
          Track
        </button>
      </form>

      {checked && (
        <div className="mt-8 border border-line bg-paper p-8 text-center text-ink/65">
          <p className="font-serif text-xl text-ink">Order tracking coming soon</p>
          <p className="mt-2 text-sm">
            Live order tracking activates once checkout & orders go live. For now,
            reach us via the Contact page for any order query.
          </p>
        </div>
      )}
    </div>
  );
}