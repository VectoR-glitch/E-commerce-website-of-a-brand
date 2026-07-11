import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /cart and /checkout are NOT disallowed here (Google's own guidance:
      // blocking crawl and noindex-ing are not equivalent — a page blocked
      // from crawling can still surface as a bare, snippet-less search
      // result, since a crawler that can't fetch it can never see its
      // noindex tag either). Both instead carry real `robots: noindex`
      // metadata (cart/layout.tsx, checkout/layout.tsx) so they're crawlable
      // but reliably excluded. /api/ and /verify-email stay disallowed since
      // they're route handlers with no HTML page for a noindex tag to live
      // on. /admin also has its own noindex metadata (admin/layout.tsx) —
      // this disallow is a second layer, not the only one.
      disallow: ["/api/", "/verify-email", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
