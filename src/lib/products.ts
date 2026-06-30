import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { products as presentation, type Product, type ClaimTone } from "@/lib/catalog";

// Price, stock, editorial content AND images all come from Postgres now — the
// admin owns them. Images live in the DB (served via /api/product-image/[id]);
// catalog.ts only supplies display order + fallbacks. Merge happens by `slug`.

// Select (NOT include) so we never load image binaries on storefront pages —
// only the id + scoping metadata needed to build URLs.
const productSelect = {
  id: true,
  slug: true,
  name: true,
  active: true,
  tagline: true,
  claim: true,
  claimTone: true,
  description: true,
  benefits: true,
  howToUse: true,
  safety: true,
  placeholder: true,
  variants: true,
  images: {
    select: { id: true, fragrance: true, size: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
  },
} satisfies Prisma.ProductSelect;

type DbProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

const imageUrl = (id: string) => `/api/product-image/${id}`;

function hydrate(meta: Product, db: DbProduct): Product {
  const variants = db.variants
    .filter((v) => v.active)
    .map((v) => ({
      id: v.id, // stable identity for the cart/checkout (survives SKU edits)
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

  // Rebuild the image maps from DB rows: default (primary), per-fragrance, and
  // per-variant. Fall back to the catalog /public paths if a product has no DB
  // images yet, so the storefront never renders a broken image.
  const primary = db.images.find((i) => i.isPrimary) ?? db.images[0];
  const fragranceImages: Record<string, string> = {};
  const variantImages: Record<string, string> = {};
  for (const im of db.images) {
    if (im.fragrance && im.size) variantImages[`${im.fragrance}|${im.size}`] = imageUrl(im.id);
    else if (im.fragrance) fragranceImages[im.fragrance] = imageUrl(im.id);
  }

  return {
    ...meta, // slug + any fallback fields from catalog
    name: db.name,
    // Editorial content from the DB; fall back to catalog if a field is unset.
    tagline: db.tagline ?? meta.tagline,
    claim: db.claim ?? meta.claim,
    claimTone: (db.claimTone as ClaimTone | null) ?? meta.claimTone,
    description: db.description ?? meta.description,
    benefits: db.benefits.length ? db.benefits : meta.benefits,
    howToUse: db.howToUse.length ? db.howToUse : meta.howToUse,
    safety: db.safety ?? meta.safety,
    placeholder: db.placeholder ?? meta.placeholder,
    // Images from the DB, with catalog /public as the fallback.
    image: primary ? imageUrl(primary.id) : meta.image,
    fragranceImages: Object.keys(fragranceImages).length ? fragranceImages : meta.fragranceImages,
    variantImages: Object.keys(variantImages).length ? variantImages : meta.variantImages,
    fragrances: meta.fragrances.filter((f) => dbFragrances.has(f)),
    sizes: meta.sizes.filter((s) => dbSizes.has(s)),
    variants,
  };
}

export async function getProducts(): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: { active: true },
    select: productSelect,
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
    select: productSelect,
  });
  if (!db || !db.active) return undefined;

  const meta = presentation.find((p) => p.slug === slug);
  if (!meta) return undefined;

  return hydrate(meta, db);
}