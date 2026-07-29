"use client";

import { useEffect, useRef } from "react";

// A single thin brass line-art droplet that trails the pointer with a gentle
// lag, and a thin ring that ripples outward from each click — like a drop
// hitting still water. Desktop/mouse only (pointer: fine), purely decorative
// (pointer-events: none, aria-hidden), and off entirely under reduced motion.
export function DropletCursor() {
  const dropRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!fine || reduce) return;

    const drop = dropRef.current;
    const field = fieldRef.current;
    if (!drop || !field) return;

    const mouse = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let raf = 0;
    let seen = false;

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!seen) {
        seen = true;
        pos.x = mouse.x;
        pos.y = mouse.y;
        drop!.style.opacity = "0.6";
      }
    }

    function onLeave() {
      drop!.style.opacity = "0";
    }

    let rippleId = 0;
    function onClick(e: MouseEvent) {
      const ring = document.createElement("span");
      ring.className = "droplet-ripple";
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      const id = `dr-${rippleId++}`;
      ring.dataset.id = id;
      field!.appendChild(ring);
      setTimeout(() => ring.remove(), 650);
    }

    function loop() {
      pos.x += (mouse.x - pos.x) * 0.16;
      pos.y += (mouse.y - pos.y) * 0.16;
      drop!.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -62%)`;
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("click", onClick);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 hidden sm:block"
    >
      <div
        ref={dropRef}
        className="fixed left-0 top-0 opacity-0 transition-opacity duration-300 will-change-transform"
      >
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
          <path
            d="M8 1.4C8 1.4 2 8.8 2 12.1C2 15.1 4.7 17.4 8 17.4C11.3 17.4 14 15.1 14 12.1C14 8.8 8 1.4 8 1.4Z"
            stroke="var(--color-brass)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
