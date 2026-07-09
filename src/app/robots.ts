import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep transactional + API routes out of the index — no SEO value and we
      // don't want carts/checkouts crawled. /verify-email is a redirect-only
      // route handler (no HTML page, so a noindex meta tag can't apply there).
      disallow: ["/cart", "/checkout", "/api/", "/verify-email"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
