"use client";

import { useEffect, useState, type ReactNode } from "react";

// Auto-advancing slider. Advances every `interval` ms, pauses on hover, and
// honors reduced-motion (no auto-advance). Manual dots + optional arrows.
export function Carousel({
  slides,
  interval = 4500,
  showArrows = true,
  showDots = true,
  className = "",
  ariaLabel,
}: {
  slides: ReactNode[];
  interval?: number;
  showArrows?: boolean;
  showDots?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (n <= 1 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = setInterval(() => setIndex((p) => (p + 1) % n), interval);
    return () => clearInterval(t);
  }, [n, paused, interval]);

  const go = (i: number) => setIndex(((i % n) + n) % n);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="w-full shrink-0"
              aria-hidden={i !== index || undefined}
              inert={i !== index}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {showArrows && n > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bone/80 text-lg text-ink backdrop-blur transition-colors hover:bg-forest hover:text-bone"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bone/80 text-lg text-ink backdrop-blur transition-colors hover:bg-forest hover:text-bone"
          >
            ›
          </button>
        </>
      )}

      {showDots && n > 1 && (
        <div className="mt-7 flex justify-center gap-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index || undefined}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-7 bg-forest"
                  : "w-1.5 bg-line hover:bg-ink/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
