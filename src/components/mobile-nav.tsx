"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/why-klenich", label: "Why Klenich" },
  { href: "/our-story", label: "Our Story" },
  { href: "/help", label: "Help" },
];

// Hamburger + dropdown panel for small screens (the desktop nav is hidden
// below md). The panel drops below the whole header via top-full.
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape and return focus to the toggle — standard menu keyboard UX.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center text-ink"
      >
        <span className="relative block h-3.5 w-[22px]">
          <span
            className={`absolute left-0 block h-0.5 w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
            }`}
          />
          <span
            className={`absolute left-0 top-1/2 block h-0.5 w-full -translate-y-1/2 rounded-full bg-current transition-all duration-200 ${
              open ? "scale-x-0 opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
            }`}
          />
        </span>
      </button>

      {open && (
        <>
          {/* tap-away backdrop — covers the page below the header only */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fade-in absolute left-0 right-0 top-full z-20 h-screen cursor-default bg-ink/10"
          />
          <nav
            id="mobile-menu"
            className="menu-in absolute left-0 right-0 top-full z-30 border-b border-line bg-bone shadow-sm"
          >
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${i * 55}ms` }}
                className="menu-item smallcaps block border-t border-line px-8 py-5 text-ink/75 transition-colors hover:bg-paper hover:text-forest"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
