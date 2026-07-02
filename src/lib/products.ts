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

function hydrate(meta: Product | undefined, db: DbProduct): Product {
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

  // The DB is the source of truth for which fragrances/sizes exist. We honour
  // the catalog's curated order for known values, then APPEND any DB-only ones
  // (a newly-added fragrance/size the static catalog doesn't know about) so
  // every active variant is selectable on the PDP — not silently dropped.
  const dbFragrances = new Set(
    variants.map((v) => v.fragrance).filter((f): f is string => Boolean(f)),
  );
  const dbSizes = new Set(variants.map((v) => v.size));
  const metaFragrances = meta?.fragrances ?? [];
  const metaSizes = meta?.sizes ?? [];
  const fragrances = [
    ...metaFragrances.filter((f) => dbFragrances.has(f)),
    ...[...dbFragrances].filter((f) => !metaFragrances.includes(f)),
  ];
  const sizes = [
    ...metaSizes.filter((s) => dbSizes.has(s)),
    ...[...dbSizes].filter((s) => !metaSizes.includes(s)),
  ];

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
    slug: db.slug,
    name: db.name,
    // Editorial content from the DB; fall back to catalog if a field is unset.
    // A DB-only product (no catalog meta) uses safe defaults.
    tagline: db.tagline ?? meta?.tagline ?? "",
    claim: db.claim ?? meta?.claim ?? "",
    claimTone: (db.claimTone as ClaimTone | null) ?? meta?.claimTone ?? "fresh",
    description: db.description ?? meta?.description,
    benefits: db.benefits.length ? db.benefits : meta?.benefits,
    howToUse: db.howToUse.length ? db.howToUse : meta?.howToUse,
    safety: db.safety ?? meta?.safety,
    placeholder: db.placeholder ?? meta?.placeholder ?? "🧴",
    // Images from the DB, with catalog /public as the fallback.
    image: primary ? imageUrl(primary.id) : (meta?.image ?? ""),
    fragranceImages: Object.keys(fragranceImages).length ? fragranceImages : meta?.fragranceImages,
    variantImages: Object.keys(variantImages).length ? variantImages : meta?.variantImages,
    fragrances,
    sizes,
    variants,
  };
}

export async function getProducts(): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: { active: true },
    select: productSelect,
  });
  const bySlug = new Map(dbProducts.map((p) => [p.slug, p]));
  const inCatalog = new Set(presentation.map((m) => m.slug));

  // Curated catalog first (keeps the intentional storefront ordering), then any
  // DB-only products (added via admin, not in the static catalog) appended so
  // new products actually appear on the storefront.
  const curated = presentation
    .map((meta) => {
      const db = bySlug.get(meta.slug);
      return db ? hydrate(meta, db) : null;
    })
    .filter((p): p is Product => p !== null);
  const extras = dbProducts
    .filter((db) => !inCatalog.has(db.slug))
    .map((db) => hydrate(undefined, db));
  return [...curated, ...extras];
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const db = await prisma.product.findUnique({
    where: { slug },
    select: productSelect,
  });
  if (!db || !db.active) return undefined;

  // A DB-only product (no static catalog entry) is still valid — hydrate falls
  // back to safe defaults when there's no meta.
  const meta = presentation.find((p) => p.slug === slug);
  return hydrate(meta, db);
}