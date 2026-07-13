import type { NextConfig } from "next";

// Baseline security headers applied to every response. These are the
// non-breaking hardening headers — they don't restrict where scripts/styles/
// images load from, so they're safe to ship without a Razorpay test pass.
//
// NOT included yet: a restrictive Content-Security-Policy `script-src`/
// `default-src`. A real CSP must allowlist Razorpay's checkout.js + frames,
// Google Fonts, and Next's inline bootstrap — get that wrong and checkout
// silently breaks. Build + verify it against the live payment flow in
// staging, then tighten the CSP below.
const securityHeaders = [
  // Force HTTPS for 2 years (Vercel serves everything over TLS).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Don't let the browser MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: legacy header (superseded by CSP frame-ancestors below, kept
  // for older browsers).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Trim the Referer sent to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny powerful browser features the storefront never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Safe CSP subset: stop others from framing us (clickjacking), block <base>
  // injection, and disallow plugins. No script/style/img restrictions here, so
  // nothing on the page can break.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an `X-Powered-By: Next.js` response header.
  poweredByHeader: false,
  // Allow phones/other devices on the LAN to load the dev server's /_next
  // resources (JS chunks, HMR). Without this, Next 16 blocks them cross-origin
  // and the page can't hydrate. Dev-only; ignored in production builds.
  allowedDevOrigins: ["192.168.1.24"],
  experimental: {
    // Image uploads (product + kit photos) go through Server Actions, which
    // default to a 1 MB body limit. We accept images up to 5 MB (see
    // MAX_IMAGE_BYTES) — allow headroom for multipart overhead so a 5 MB file
    // isn't rejected with a "Failed to fetch".
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;