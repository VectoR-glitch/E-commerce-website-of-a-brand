"use client";

import { useState } from "react";
import { Ornament } from "@/components/ornament";
import { COUNTRIES } from "@/lib/country-codes";
import { CountryCodeSelect } from "@/components/country-code-select";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `country` holds the selected ISO code; the dial code is derived from it.
  const [form, setForm] = useState({
    name: "",
    email: "",
    country: "IN",
    phone: "",
    message: "",
  });
  // Honeypot: stays empty for real users; bots that fill every field trip it.
  const [company, setCompany] = useState("");

  const dial = COUNTRIES.find((c) => c.iso === form.country)?.dial ?? "+91";

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Mobile number: keep digits only — strip anything the user types/pastes that
  // isn't 0-9, capped at 15 (max length of an international number).
  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 15) }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          // Send the full international number, e.g. "+91 9876543210".
          phone: `${dial} ${form.phone}`,
          message: form.message,
          company,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn’t reach the server. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Contact</span>
        <h1 className="mt-4 font-serif text-5xl">Get in touch</h1>
        <Ornament className="mt-6" />
        <p className="mt-4 text-ink/65">
          Questions, feedback, or order help — we’d love to hear from you.
        </p>
      </header>

      <div className="mt-10 flex flex-wrap justify-center gap-8 border-y border-line py-6 text-center text-sm">
        <div>
          <p className="smallcaps text-brass-deep">Email</p>
          <a
            href="mailto:bharatblissofficial@gmail.com"
            className="mt-1 block text-ink/70 hover:text-forest"
          >
            bharatblissofficial@gmail.com
          </a>
        </div>
        <div>
          <p className="smallcaps text-brass-deep">Phone / WhatsApp</p>
          <a href="tel:+918981221994" className="mt-1 block text-ink/70 hover:text-forest">
            +91 89812 21994
          </a>
        </div>
        <div>
          <p className="smallcaps text-brass-deep">Address</p>
          <p className="mt-1 text-ink/70">Rajarhat, Kolkata, West Bengal 700135</p>
        </div>
      </div>

      {sent ? (
        <div className="mt-12 border border-line bg-paper p-10 text-center">
          <h2 className="font-serif text-2xl">Thanks for reaching out ✓</h2>
          <p className="mt-3 text-ink/65">
            We’ve received your message and will get back to you soon.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-12 space-y-5">
          {/* Honeypot — visually hidden, off-screen, excluded from tab order and
              a11y tree. Real users never see or fill it; bots often do. */}
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
          <label className="block">
            <span className="smallcaps mb-2 block text-ink/70">Name</span>
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={set("name")}
              className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="smallcaps mb-2 block text-ink/70">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={set("email")}
              className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="smallcaps mb-2 block text-ink/70">Mobile Number</span>
            <div className="flex">
              <CountryCodeSelect
                value={form.country}
                onChange={(iso) => setForm((f) => ({ ...f, country: iso }))}
              />
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                pattern="\d{6,15}"
                title="Enter 6 to 15 digits"
                maxLength={15}
                value={form.phone}
                onChange={setPhone}
                onKeyDown={(e) => {
                  // Block non-digit character keys (allow control/navigation keys).
                  if (
                    e.key.length === 1 &&
                    !/\d/.test(e.key) &&
                    !e.ctrlKey &&
                    !e.metaKey
                  ) {
                    e.preventDefault();
                  }
                }}
                placeholder="9876543210"
                className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
              />
            </div>
          </label>
          <label className="block">
            <span className="smallcaps mb-2 block text-ink/70">Message</span>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={set("message")}
              className="w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="smallcaps bg-forest px-9 py-4 text-bone btn-fill-forest disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}