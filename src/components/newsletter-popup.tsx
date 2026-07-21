"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NewsletterForm } from "@/components/newsletter-form";

// Shown once per browser (localStorage-gated) to a new visitor, a few seconds
// after their first page load. Skipped on routes where an interruption would
// actively hurt (mid-checkout, cart, auth, account, admin) — this is meant to
// greet a browsing visitor, not a paying or signed-in one.
const STORAGE_KEY = "klenich_newsletter_popup_dismissed";
const SHOW_DELAY_MS = 4000;
const SKIP_PREFIXES = ["/checkout", "/cart", "/login", "/register", "/account", "/admin"];

export function NewsletterPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const skip = SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Arm the show-timer once per mount on an eligible route, but only if this
  // browser hasn't already dismissed or subscribed.
  useEffect(() => {
    if (skip) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [skip]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  // Scroll lock, Esc-to-close, and a basic Tab focus-trap while open — same
  // pattern as CartDrawer.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusable(): HTMLElement[] {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={dismiss}
        className="absolute inset-0 bg-ink/40"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="newsletter-popup-heading"
          className="relative w-full max-w-sm border border-line bg-paper p-8 shadow-xl"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-3 text-ink/50 hover:text-ink"
          >
            ✕
          </button>
          <p className="smallcaps text-brass-deep">Welcome</p>
          <h2 id="newsletter-popup-heading" className="mt-2 font-serif text-2xl leading-snug">
            Get 10% off your first order
          </h2>
          <p className="mt-2 text-sm text-ink/70">
            Sign up for The Journal — a one-time code, sent straight to your inbox.
          </p>
          <div className="mt-5">
            <NewsletterForm onSuccess={() => localStorage.setItem(STORAGE_KEY, "1")} />
          </div>
        </div>
      </div>
    </div>
  );
}
