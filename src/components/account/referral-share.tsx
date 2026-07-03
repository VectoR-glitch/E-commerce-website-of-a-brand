"use client";

import { useState } from "react";

// Shareable referral link with one-tap copy + a WhatsApp share (the dominant
// share channel in India). The URL is built server-side and passed in.
export function ReferralShare({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the link is visible to copy manually
    }
  }

  const message = `Try Klenich plant-powered home care — sign up with my link and we both get bonus points on your first order: ${url}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-none border border-line bg-white px-3 py-1.5 text-sm tracking-wide text-ink">
          {code}
        </code>
        <span className="text-xs text-ink/50">is your referral code</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 border border-line bg-white px-3 py-2 text-sm text-ink/70 outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="smallcaps shrink-0 border border-forest px-4 py-2 text-forest btn-fill"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="smallcaps shrink-0 bg-forest px-4 py-2 text-bone btn-fill-forest"
        >
          Share
        </a>
      </div>
    </div>
  );
}
