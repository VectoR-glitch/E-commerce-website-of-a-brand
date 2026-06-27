import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { products as presentation, type Product } from "@/lib/catalog";

// Authoritative price + stock come from Postgres; marketing copy (tagline,
// claim, placeholder, display order) comes from the presentation catalog until
// Sanity content is wired. Merge happens by `slug` / fragrance+size.

type DbProduct = Prisma.ProductGetPayload<{ include: { variants: true } }>;

function hydrate(meta: Product, db: DbProduct): Product {
  const variants = db.variants
    .filter((v) => v.active)
    .map((v) => ({
      fragrance: v.fragrance ?? undefined,
      size: v.size,
      pricePaise: v.pricePaise,
      sku: v.sku,
      stock: v.stock,
    }));

  // Preserve the curated display order from the presentation catalog, but only
  // surface fragrances/sizes that actually exist as active variants in the DB.
  const dbFragrances = new Set(
    variants.map((v) => v.fragrance).filter((f): f is string => Boolean(f)),
  );
  const dbSizes = new Set(variants.map((v) => v.size));

  return {
    ...meta,
    fragrances: meta.fragrances.filter((f) => dbFragrances.has(f)),
    sizes: meta.sizes.filter((s) => dbSizes.has(s)),
    variants,
  };
}

export async function getProducts(): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: { active: true },
    include: { variants: true },
  });
  const bySlug = new Map(dbProducts.map((p) => [p.slug, p]));

  // Iterate presentation order so the storefront ordering stays intentional.
  return presentation
    .map((meta) => {
      const db = bySlug.get(meta.slug);
      return db ? hydrate(meta, db) : null;
    })
    .filter((p): p is Product => p !== null);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const db = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true },
  });
  if (!db || !db.active) return undefined;

  const meta = presentation.find((p) => p.slug === slug);
  if (!meta) return undefined;

  return hydrate(meta, db);
}