"use client";

import { useEffect, useRef, useState } from "react";

// A hairline brass bar pinned to the very top that tracks read progress —
// echoes the Ornament pinstripe motif — with a small brass droplet riding its
// leading edge. It follows scroll position directly (no transition) so it
// stays accurate, and doubles as a click-to-jump seek bar for pointer users.
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

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
      ref={barRef}
      onClick={seek}
      aria-hidden="true"
      className="group/scrub fixed inset-x-0 top-0 z-50 h-2 cursor-pointer"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-line/0 transition-colors duration-200 group-hover/scrub:bg-line/50" />
      <div
        className="absolute inset-x-0 top-0 h-0.5 origin-left bg-brass"
        style={{ transform: `scaleX(${progress})` }}
      />
      <div
        className="scroll-droplet pointer-events-none absolute top-0.5 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${progress * 100}%` }}
      >
        <span className="block h-1.5 w-1.5 rounded-full bg-brass-deep" />
      </div>
    </div>
  );
}
