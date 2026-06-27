"use client";

import { useEffect, useState } from "react";

// A maker's signature, hidden behind the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
// triggers a brief 🍁 moment. Purely decorative, pointer-events:none, and
// self-cleaning — it never interferes with the page.
const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

// Mobile equivalent: the same shape as swipes, then two taps for B + A.
const SWIPES = [
  "up", "up", "down", "down",
  "left", "right", "left", "right",
  "tap", "tap",
];

type Leaf = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
};

function makeLeaves(count: number): Leaf[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    size: 16 + Math.random() * 30,
    delay: Math.random() * 1.1,
    duration: 3 + Math.random() * 2.5,
    drift: (Math.random() - 0.5) * 260,
    rotate: 360 + Math.random() * 720,
  }));
}

function isEditable(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable === true
  );
}

export function MapleEasterEgg() {
  const [burst, setBurst] = useState<{ id: number; leaves: Leaf[] } | null>(null);

  useEffect(() => {
    let kpos = 0; // keyboard progress
    let tpos = 0; // touch (swipe) progress
    let start: { x: number; y: number } | null = null;

    function fire() {
      const reduce =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      setBurst({ id: Date.now(), leaves: makeLeaves(reduce ? 0 : 18) });
    }

    // Desktop: the classic Konami keypresses.
    function onKey(e: KeyboardEvent) {
      if (isEditable(e.target)) return; // don't hijack typing
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[kpos]) {
        kpos += 1;
        if (kpos === KONAMI.length) {
          kpos = 0;
          fire();
        }
      } else {
        kpos = key === KONAMI[0] ? 1 : 0; // allow a fresh attempt
      }
    }

    // Mobile: the same sequence as swipes (then two taps). Passive listeners —
    // we only read coordinates and never preventDefault, so scrolling is intact.
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    function onTouchEnd(e: TouchEvent) {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const max = Math.max(absX, absY);

      let gesture: string;
      if (max < 14) {
        if (isEditable(e.target)) return; // a tap on a control, not the egg
        gesture = "tap";
      } else if (max < 36) {
        tpos = 0; // ambiguous tiny swipe — reset
        return;
      } else if (absX > absY) {
        gesture = dx > 0 ? "right" : "left";
      } else {
        gesture = dy > 0 ? "down" : "up";
      }

      if (gesture === SWIPES[tpos]) {
        tpos += 1;
        if (tpos === SWIPES.length) {
          tpos = 0;
          fire();
        }
      } else {
        tpos = gesture === SWIPES[0] ? 1 : 0;
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Self-clean once the longest leaf has finished falling.
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 6500);
    return () => clearTimeout(t);
  }, [burst]);

  if (!burst) return null;

  // Per-leaf keyframes (baked-in drift/rotation) avoid CSS custom properties.
  const keyframes =
    burst.leaves
      .map(
        (l, i) =>
          `@keyframes maple-fall-${i}{0%{transform:translate3d(0,-12vh,0) rotate(0deg);opacity:0}8%{opacity:1}100%{transform:translate3d(${l.drift.toFixed(0)}px,112vh,0) rotate(${l.rotate.toFixed(0)}deg);opacity:0}}`,
      )
      .join("") +
    `@keyframes maple-pop{0%{transform:translate(-50%,-50%) scale(0) rotate(-40deg);opacity:0}35%{transform:translate(-50%,-55%) scale(1.5) rotate(12deg);opacity:1}65%{transform:translate(-50%,-65%) scale(1.25) rotate(-6deg);opacity:1}100%{transform:translate(-50%,-130%) scale(1.1) rotate(0deg);opacity:0}}`;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2147483647,
      }}
    >
      <style>{keyframes}</style>

      {/* Centerpiece leaf that pops in and floats up */}
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          fontSize: "clamp(64px, 16vw, 120px)",
          lineHeight: 1,
          animation: "maple-pop 2.6s cubic-bezier(0.22,1,0.36,1) forwards",
          filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.25))",
        }}
      >
        🍁
      </span>

      {/* Gentle shower of falling leaves */}
      {burst.leaves.map((l, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${l.left}vw`,
            fontSize: `${l.size}px`,
            lineHeight: 1,
            animation: `maple-fall-${i} ${l.duration.toFixed(2)}s linear ${l.delay.toFixed(2)}s forwards`,
            willChange: "transform, opacity",
          }}
        >
          🍁
        </span>
      ))}
    </div>
  );
}

export default MapleEasterEgg;