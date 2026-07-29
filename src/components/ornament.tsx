"use client";

import { useEffect, useRef } from "react";

// A fine brass pinstripe with a small central diamond motif — an understated
// nod to traditional Indian border ornamentation. Mostly decorative, but on
// hover (or tap, for touch) it blooms briefly and beads two tiny brass drops
// off the tips — a quiet, one-off flourish echoing "Bliss in Every Drop",
// not an ambient loop. `align="left"` drops the leading line for editorial,
// left-aligned headings.
export function Ornament({
  className = "",
  align = "center",
}: {
  className?: string;
  align?: "center" | "left";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function bloom() {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("is-active");
    // Force reflow so a rapid re-hover restarts the animation from scratch.
    void el.offsetWidth;
    el.classList.add("is-active");
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => el.classList.remove("is-active"), 900);
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onMouseEnter={bloom}
      onClick={bloom}
      className={`ornament flex cursor-pointer items-center text-brass ${
        align === "left" ? "justify-start" : "justify-center"
      } ${className}`}
    >
      {align === "center" && (
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-brass/70 sm:w-24" />
      )}
      <span className="relative mx-2 inline-flex shrink-0">
        <svg
          width="34"
          height="10"
          viewBox="0 0 34 10"
          fill="currentColor"
          className="ornament-glyph shrink-0"
        >
          <circle cx="4" cy="5" r="1.4" />
          <rect x="14" y="2" width="6" height="6" transform="rotate(45 17 5)" />
          <circle cx="30" cy="5" r="1.4" />
        </svg>
        <span className="ornament-drop ornament-drop-l" />
        <span className="ornament-drop ornament-drop-r" />
      </span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-brass/70 sm:w-24" />
    </div>
  );
}