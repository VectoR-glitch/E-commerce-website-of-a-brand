"use client";

import { useId, useState } from "react";

export function NewsletterForm({ onSuccess }: { onSuccess?: () => void }) {
  const emailId = useId(); // unique per instance — this form renders more than once on a page (footer + popup)
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setCouponCode(data.couponCode ?? null);
      setState("sent");
      onSuccess?.();
    } catch {
      setError("Couldn’t reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "sent") {
    return couponCode ? (
      <p className="text-sm text-ink/70">
        Thanks for subscribing ✓ Here’s your code:{" "}
        <span className="font-serif text-forest">{couponCode}</span> — also on its way to your inbox.
      </p>
    ) : (
      <p className="text-sm text-ink/70">
        Thanks for subscribing ✓ Check your inbox for your code.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xs">
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={emailId}>
          Email address
        </label>
        <input
          id={emailId}
          required
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="smallcaps shrink-0 bg-forest px-4 py-2 text-sm text-bone btn-fill-forest disabled:opacity-60"
        >
          {state === "sending" ? "…" : "Join"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
