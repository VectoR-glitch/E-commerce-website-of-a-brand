"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, flagEmoji } from "@/lib/country-codes";

/**
 * Compact country dial-code picker. The closed trigger stays slim (flag + dial
 * code only); the open panel lists full country names + codes with a search
 * box, so everything is readable without widening the field.
 */
export function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string; // ISO code, e.g. "IN"
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = COUNTRIES.find((c) => c.iso === value) ?? COUNTRIES[0];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter((c) =>
        `${c.name} ${c.dial}`.toLowerCase().includes(q),
      )
    : COUNTRIES;

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(iso: string) {
    onChange(iso);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${selected.name} ${selected.dial}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-full items-center gap-1.5 border border-r-0 border-line bg-white py-2.5 pr-2 pl-3 text-sm whitespace-nowrap outline-none focus:border-forest"
      >
        <span className="text-base leading-none">{flagEmoji(selected.iso)}</span>
        <span>{selected.dial}</span>
        <span className="text-ink/40">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-72 border border-line bg-white shadow-lg">
          <input
            autoFocus
            aria-label="Search country"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country…"
            className="w-full border-b border-line px-3 py-2 text-sm outline-none"
          />
          <ul role="listbox" className="max-h-60 overflow-auto">
            {filtered.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  onClick={() => choose(c.iso)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bone ${
                    c.iso === value ? "bg-bone" : ""
                  }`}
                >
                  <span className="text-base leading-none">
                    {flagEmoji(c.iso)}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-ink/55">{c.dial}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-ink/55">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
