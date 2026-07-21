"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NewsletterForm } from "@/components/newsletter-form";
import { Kicker } from "@/components/kicker";
import { Ornament } from "@/components/ornament";

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
        className="fade-in absolute inset-0 bg-ink/50"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="newsletter-popup-heading"
          className="popup-in relative w-full max-w-lg border border-line bg-paper p-10 shadow-2xl sm:p-12"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center text-ink/70 transition-colors hover:text-forest"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="text-center">
            <Kicker>Welcome</Kicker>
            <h2
              id="newsletter-popup-heading"
              className="mt-3 font-serif text-3xl leading-tight sm:text-4xl"
            >
              Get 10% off your first order
            </h2>
            <Ornament className="mt-5" />
            <p className="mx-auto mt-5 max-w-sm text-ink/70">
              Sign up for The Journal — plant-powered cleaning notes, and a one-time
              code sent straight to your inbox.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-sm">
            <NewsletterForm
              className="w-full"
              onSuccess={() => localStorage.setItem(STORAGE_KEY, "1")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
