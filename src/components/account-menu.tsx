"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

/**
 * Signed-in account control: an icon button that opens a small dropdown with
 * the Ops dashboard link (admins only) and Sign out. Closes on outside-click or
 * Escape. Rendered only when a session exists (see HeaderAccount) — the signed-
 * out state is a plain link straight to /login, no client JS needed.
 */
export function AccountMenu({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn-fill inline-flex items-center justify-center border border-ink p-2.5 text-ink"
      >
        <UserIcon />
      </button>

      {open && (
        <div
          role="menu"
          className="menu-in absolute right-0 top-full z-40 mt-2 w-56 border border-line bg-bone shadow-sm"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="smallcaps text-ink/45">Signed in as</p>
            <p className="truncate text-sm text-ink" title={email}>{email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="smallcaps block px-4 py-3 text-ink/75 transition-colors hover:bg-paper hover:text-forest"
          >
            My Account
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="smallcaps block border-t border-line px-4 py-3 text-ink/75 transition-colors hover:bg-paper hover:text-forest"
            >
              Ops Dashboard
            </Link>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="smallcaps block w-full border-t border-line px-4 py-3 text-left text-ink/75 transition-colors hover:bg-paper hover:text-forest"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}