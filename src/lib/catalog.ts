/**
 * KLENICH catalog — single source of truth for the storefront (temporary).
 * Mirrors the locked Pillar 2 SKU architecture.
 *
 * Later: marketing fields (name, description, images, fragrances) move to Sanity;
 * price + inventory become the source of truth in Postgres, snapshotted into the
 * order at checkout. Keep that split in mind when wiring real data.
 */

export type ClaimTone = "gentle" | "fresh" | "tough";

export type Variant = {
  /** undefined when the product has no fragrance axis */
  fragrance?: string;
  size: string;
  /** price in paise to avoid float issues (₹199 = 19900) */
  pricePaise: number;
  sku: string;
  /** live stock from Postgres; undefined when using static catalog */
  stock?: number;
};

export type Product = {
  slug: string;
  name: string;
  /** short PDP/card line */
  tagline: string;
  /** the tiered, compliance-safe claim (Pillar 3) */
  claim: string;
  claimTone: ClaimTone;
  fragrances: string[];
  sizes: string[];
  variants: Variant[];
  /** main product image (card + PDP default), served from /public */
  image: string;
  /** per-fragrance images (used on cards + PDP fallback) */
  fragranceImages?: Record<string, string>;
  /** per-variant images keyed by `${fragrance}|${size}` for the size-aware PDP */
  variantImages?: Record<string, string>;
  /** emoji fallback if an image is missing */
  placeholder: string;
  /** editorial PDP copy (optional) */
  description?: string;
  benefits?: string[];
  howToUse?: string[];
  /** caution note shown for products that need it (e.g. acidic cleaners) */
  safety?: string;
};

export const FRAGRANCE_HEX: Record<string, string> = {
  Lime: "var(--color-lime)",
  Jasmine: "var(--color-jasmine)",
  Lavender: "var(--color-lavender)",
  Lemongrass: "var(--color-lemongrass)",
};

export const products: Product[] = [
  {
    slug: "dishwash-gel-lime",
    name: "Dishwash Gel",
    tagline: "Lime — cuts grease, kind to hands",
    claim: "Gentle on hands",
    claimTone: "gentle",
    fragrances: ["Lime"],
    sizes: ["820ml"],
    image: "/products/dishwash-gel-lime.webp",
    placeholder: "🧴",
    description:
      "A plant-powered dishwash gel that cuts through oil and grease while staying kind to the hands you use all day. The fresh lime scent rinses away clean, leaving your dishes squeaky — and your skin un-stripped, without the harsh, drying chemicals most dishwashes rely on.",
    benefits: [
      "Cuts grease & dried-on food",
      "Gentle on everyday hands",
      "Fresh lime scent, rinses clean",
      "Plant-powered formula",
    ],
    howToUse: [
      "Squeeze a small amount onto a wet sponge, or straight into a sink of warm water.",
      "Wash as usual — a little goes a long way.",
      "Rinse clean. No filmy residue left behind.",
    ],
    variants: [
      { fragrance: "Lime", size: "820ml", pricePaise: 19900, sku: "000023" },
    ],
  },
  {
    slug: "floor-cleaner",
    name: "Floor Cleaner",
    tagline: "Plant-powered shine, no harsh fumes",
    claim: "Plant-based · no harsh fumes",
    claimTone: "fresh",
    fragrances: ["Jasmine", "Lavender", "Lemongrass"],
    sizes: ["500ml", "1L", "2L"],
    image: "/products/floor-jasmine-1l.webp",
    fragranceImages: {
      Jasmine: "/products/floor-jasmine-1l.webp",
      Lavender: "/products/floor-lavender-1l.webp",
      Lemongrass: "/products/floor-lemongrass-1l.webp",
    },
    variantImages: {
      "Jasmine|500ml": "/products/floor-jasmine-500.webp",
      "Jasmine|1L": "/products/floor-jasmine-1l.webp",
      "Jasmine|2L": "/products/floor-jasmine-2l.webp",
      "Lavender|500ml": "/products/floor-lavender-500.webp",
      "Lavender|1L": "/products/floor-lavender-1l.webp",
      "Lavender|2L": "/products/floor-lavender-2l.webp",
      "Lemongrass|500ml": "/products/floor-lemongrass-500.webp",
      "Lemongrass|1L": "/products/floor-lemongrass-1l.webp",
      "Lemongrass|2L": "/products/floor-lemongrass-2l.webp",
    },
    placeholder: "🪣",
    description:
      "A plant-powered floor cleaner that lifts everyday dirt and grime to a streak-free shine — without the harsh chemical fumes that hang in the air long after you've finished mopping. Gentle enough for homes where kids crawl and pets pad across the floor, in three calming fragrances.",
    benefits: [
      "Streak-free, residue-free shine",
      "No harsh, lingering fumes",
      "Family- & pet-friendly floors",
      "Three calming fragrances",
    ],
    howToUse: [
      "Add 1–2 capfuls to a bucket of water.",
      "Mop as usual across sealed floors.",
      "No rinsing needed — let it air-dry to a clean finish.",
    ],
    variants: [
      { fragrance: "Jasmine", size: "500ml", pricePaise: 11800, sku: "000011" },
      { fragrance: "Jasmine", size: "1L", pricePaise: 22000, sku: "000017" },
      { fragrance: "Jasmine", size: "2L", pricePaise: 43000, sku: "000019" },
      { fragrance: "Lavender", size: "500ml", pricePaise: 11800, sku: "000012" },
      { fragrance: "Lavender", size: "1L", pricePaise: 22000, sku: "000018" },
      { fragrance: "Lavender", size: "2L", pricePaise: 43000, sku: "000020" },
      { fragrance: "Lemongrass", size: "500ml", pricePaise: 11800, sku: "000013" },
      { fragrance: "Lemongrass", size: "1L", pricePaise: 22000, sku: "000016" },
      { fragrance: "Lemongrass", size: "2L", pricePaise: 43000, sku: "000021" },
    ],
  },
  {
    slug: "toilet-cleaner",
    name: "Toilet Cleaner",
    tagline: "Tough on stains & germs",
    claim: "Tough on tough stains",
    claimTone: "tough",
    fragrances: [],
    sizes: ["500ml", "1L"],
    image: "/products/toilet-cleaner.webp",
    placeholder: "🚽",
    description:
      "A thick toilet cleaner that clings to the bowl to tackle tough stains and limescale build-up, leaving it fresh and clean. This is the powerful end of the Klenich range — formulated to work hard where it needs to, and used as directed for a deep, confident clean.",
    benefits: [
      "Clings to lift tough stains",
      "Fights limescale & build-up",
      "Thick, no-splash formula",
      "Leaves the bowl fresh",
    ],
    howToUse: [
      "Lift the seat and squeeze around and under the rim.",
      "Leave for 5–10 minutes to let it work.",
      "Scrub with a toilet brush and flush.",
    ],
    safety:
      "Contains acidic cleaning agents. For toilet use only. Keep out of reach of children. Avoid contact with skin and eyes — rinse thoroughly with water if contact occurs. Do not mix with other cleaning products.",
    variants: [
      { size: "500ml", pricePaise: 11800, sku: "000014" },
      { size: "1L", pricePaise: 22000, sku: "000022" },
    ],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/** Lowest variant price for a product, in paise. */
export function priceFromPaise(product: Product): number {
  return Math.min(...product.variants.map((v) => v.pricePaise));
}

/** Format paise as ₹ with no decimals (FMCG prices are whole rupees). */
export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}