"use client";

import { useEffect, useState } from "react";

// A bold forest-green "liquid" bar pinned to the very top that fills as you
// read — a literal pour, not a hairline — with a brass droplet riding its
// leading edge. It follows scroll position directly (no transition) so it
// stays accurate, and doubles as a click-to-jump seek bar for pointer users.
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    const frac = e.clientX / window.innerWidth;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: frac * max, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div
      onClick={seek}
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-2 cursor-pointer bg-sage/60 transition-[filter] duration-200 hover:brightness-105"
    >
      <div
        className="h-full origin-left bg-forest"
        style={{ transform: `scaleX(${progress})` }}
      />
      <div
        className="scroll-droplet pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${progress * 100}%` }}
      >
        <span className="block h-2.5 w-2.5 rounded-full border border-bone bg-brass-deep" />
      </div>
    </div>
  );
}
