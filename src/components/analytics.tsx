"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Marketing analytics — both are no-ops until their env vars are set, so this
// is safe to ship before either account exists (same pattern as WhatsApp).
//   NEXT_PUBLIC_GA_MEASUREMENT_ID — Google Analytics 4, e.g. "G-XXXXXXXXXX"
//   NEXT_PUBLIC_META_PIXEL_ID     — Meta Pixel, numeric id from Events Manager
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// gtag.js + fbevents.js are ~330KB combined and were the single biggest hit
// to Lighthouse Performance (Speed Index/TTI) after adding them — neither
// needs to compete with the page's own hydration for main-thread time.
// Deferred to whichever comes first: the browser going idle, or the visitor's
// first interaction — same "idle-or-interaction" pattern used to lazy-load
// non-critical third-party scripts. Trade-off: a visit that bounces before
// either fires (well under a couple of seconds) won't be tracked.
const IDLE_TIMEOUT_MS = 4000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

function useDeferredLoad() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      setReady(true);
    };

    const hasIdleCallback = typeof window.requestIdleCallback === "function";
    const idleId = hasIdleCallback
      ? window.requestIdleCallback(trigger, { timeout: IDLE_TIMEOUT_MS })
      : window.setTimeout(trigger, IDLE_TIMEOUT_MS);

    INTERACTION_EVENTS.forEach((evt) =>
      window.addEventListener(evt, trigger, { once: true, passive: true }),
    );

    return () => {
      if (hasIdleCallback) window.cancelIdleCallback(idleId as number);
      else window.clearTimeout(idleId as number);
      INTERACTION_EVENTS.forEach((evt) => window.removeEventListener(evt, trigger));
    };
  }, [ready]);

  return ready;
}

// Unlike GA4 (which auto-tracks client-side route changes via Enhanced
// Measurement's history listener, on by default), the Meta Pixel has no
// built-in SPA support — without this, only the very first page of a visit
// ever gets a PageView, silently undercounting every route change after,
// which breaks ad attribution and retargeting-audience accuracy.
function useMetaPixelPageviews(enabled: boolean) {
  const pathname = usePathname();
  // The init script's own fbq('track', 'PageView') already covers whichever
  // page is current the moment the pixel finishes loading — skip firing again
  // for that same page once `enabled` flips true.
  const skipNext = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [enabled, pathname]);
}

export function Analytics() {
  const ready = useDeferredLoad();
  useMetaPixelPageviews(ready && Boolean(META_PIXEL_ID));
  if (!ready) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
      {META_PIXEL_ID && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
