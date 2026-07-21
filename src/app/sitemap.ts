import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { getProducts } from "@/lib/products";
import { products as staticCatalog } from "@/lib/catalog";
import { getPublishedPosts } from "@/lib/blog";

// Static, indexable routes with sensible crawl priorities. Transactional pages
// (cart, checkout) are intentionally excluded — they're disallowed in robots.
const staticRoutes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/shop", priority: 0.9, freq: "weekly" },
  { path: "/subscribe", priority: 0.7, freq: "monthly" },
  { path: "/why-klenich", priority: 0.6, freq: "monthly" },
  { path: "/rewards", priority: 0.6, freq: "monthly" },
  { path: "/our-story", priority: 0.6, freq: "monthly" },
  { path: "/blog", priority: 0.6, freq: "weekly" },
  { path: "/help", priority: 0.4, freq: "monthly" },
  { path: "/shipping-returns", priority: 0.4, freq: "yearly" },
  { path: "/contact", priority: 0.4, freq: "yearly" },
  { path: "/track-order", priority: 0.4, freq: "yearly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Prefer live, active products; fall back to the static catalog so the
  // sitemap still renders if the database is briefly unavailable.
  let slugs: string[];
  try {
    slugs = (await getProducts()).map((p) => p.slug);
  } catch {
    slugs = staticCatalog.map((p) => p.slug);
  }

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  const productEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${SITE_URL}/product/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // A blog fetch failure shouldn't take down the whole sitemap — same
  // defensive pattern as the product-slug fallback above.
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPublishedPosts();
    blogEntries = posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.publishedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    }));
  } catch {
    blogEntries = [];
  }

  return [...staticEntries, ...productEntries, ...blogEntries];
}
