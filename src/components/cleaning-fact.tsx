"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CLEANING_FACTS } from "@/lib/cleaning-facts";

/**
 * A "Did you know?" strip showing a random cleaning fact. Re-randomizes on every
 * page navigation (keyed on pathname). Renders nothing on the server pass to
 * avoid hydration mismatch, then fills in on the client.
 */
export function CleaningFact() {
  const pathname = usePathname();
  const [fact, setFact] = useState<string | null>(null);

  useEffect(() => {
    // Defer out of the synchronous effect body (avoids a cascading render);
    // picks a fresh random fact on mount and on every navigation.
    const id = requestAnimationFrame(() =>
      setFact(CLEANING_FACTS[Math.floor(Math.random() * CLEANING_FACTS.length)]),
    );
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  if (!fact) return null;

  return (
    <aside className="border-y border-line bg-sage/25">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-8 py-3 text-center text-sm text-forest">
        <span className="smallcaps text-brass-deep">Did you know</span>
        <span className="text-ink/75">{fact}</span>
      </p>
    </aside>
  );
}