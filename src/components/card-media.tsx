"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// Auto-cycles a product card's variant images with a soft crossfade, and shows
// the current variant's label. Pauses under reduced motion. Lives inside the
// card's <Link>, so it's just visuals (no nested link).
export function CardMedia({
  slides,
  name,
  interval = 4800,
}: {
  slides: { src: string; label: string }[];
  name: string;
  interval?: number;
}) {
  const n = slides.length;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (n <= 1) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = setInterval(() => setI((p) => (p + 1) % n), interval);
    return () => clearInterval(t);
  }, [n, interval]);

  return (
    <>
      {slides.map((s, idx) => (
        <Image
          key={`${idx}-${s.src}`}
          src={s.src}
          alt={`${name} — ${s.label}`}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className={`object-contain transition-opacity duration-700 ease-out ${
            idx === i ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <span className="smallcaps absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-line bg-bone/80 px-3 py-1 text-brass-deep backdrop-blur">
        {slides[i]?.label}
      </span>
    </>
  );
}
