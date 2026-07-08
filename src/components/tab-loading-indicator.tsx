"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Rounded-square forest backdrop (matches app/icon.svg) with a rotating brass
// arc, cycled via setInterval to fake a spinning favicon while a new route is
// loading — the browser's own tab spinner never appears for App Router
// client-side transitions, since no full navigation actually happens.
const FRAME_COUNT = 12;
const FRAME_INTERVAL_MS = 90;
const SAFETY_TIMEOUT_MS = 6000; // clears itself if a click never actually navigates

function spinnerFrame(deg: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="#1F3D2B"/>` +
    `<circle cx="32" cy="32" r="16" fill="none" stroke="#F5F1E8" stroke-opacity="0.25" stroke-width="5"/>` +
    `<path d="M32 16 A16 16 0 0 1 48 32" fill="none" stroke="#B08D4C" stroke-width="5" stroke-linecap="round" transform="rotate(${deg} 32 32)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Invisible root-layout companion — spins the browser tab's favicon during a
// route transition. Renders nothing.
export function TabLoadingIndicator() {
  const pathname = usePathname();
  const originalHrefRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef(0);

  function getLink(): HTMLLinkElement | null {
    return document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (originalHrefRef.current) {
      const link = getLink();
      if (link) link.href = originalHrefRef.current;
      originalHrefRef.current = null;
    }
  }

  function start() {
    if (intervalRef.current) return; // already spinning
    const link = getLink();
    if (!link) return;
    originalHrefRef.current = link.href;
    // Show the first frame immediately — otherwise a fast transition can
    // finish (and stop() run) before the interval's first tick ever fires.
    frameRef.current = 0;
    link.href = spinnerFrame(0);
    intervalRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % FRAME_COUNT;
      link.href = spinnerFrame((360 / FRAME_COUNT) * frameRef.current);
    }, FRAME_INTERVAL_MS);
    timeoutRef.current = setTimeout(stop, SAFETY_TIMEOUT_MS);
  }

  // The new route has rendered (pathname actually changed) — stop spinning.
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Detect the START of a same-tab internal navigation. The App Router has no
  // built-in "navigation started" event, so this listens for the two things
  // that cause one: a plain click on an in-page link, and back/forward.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // NOT gated on e.defaultPrevented — Next.js's <Link> always calls
      // preventDefault() to intercept the click for client-side routing, and
      // React's own delegated listener runs before this one, so by the time
      // we see the event that flag is already set for every normal Link click.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return; // opens elsewhere
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    function onPopState() {
      start();
    }
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
    // start/stop only touch refs, not props/state — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
