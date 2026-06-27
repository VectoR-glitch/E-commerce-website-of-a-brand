import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// Mirrors the locked Pillar 2 catalog. Postgres owns price + stock.
const DEFAULT_STOCK = 100;

const catalog: {
  slug: string;
  name: string;
  variants: { sku: string; fragrance: string | null; size: string; pricePaise: number }[];
}[] = [
  {
    slug: "dishwash-gel-lime",
    name: "Dishwash Gel",
    variants: [
      { sku: "000023", fragrance: "Lime", size: "820ml", pricePaise: 19900 },
    ],
  },
  {
    slug: "floor-cleaner",
    name: "Floor Cleaner",
    variants: [
      { sku: "000011", fragrance: "Jasmine", size: "500ml", pricePaise: 11800 },
      { sku: "000017", fragrance: "Jasmine", size: "1L", pricePaise: 22000 },
      { sku: "000019", fragrance: "Jasmine", size: "2L", pricePaise: 43000 },
      { sku: "000012", fragrance: "Lavender", size: "500ml", pricePaise: 11800 },
      { sku: "000018", fragrance: "Lavender", size: "1L", pricePaise: 22000 },
      { sku: "000020", fragrance: "Lavender", size: "2L", pricePaise: 43000 },
      { sku: "000013", fragrance: "Lemongrass", size: "500ml", pricePaise: 11800 },
      { sku: "000016", fragrance: "Lemongrass", size: "1L", pricePaise: 22000 },
      { sku: "000021", fragrance: "Lemongrass", size: "2L", pricePaise: 43000 },
    ],
  },
  {
    slug: "toilet-cleaner",
    name: "Toilet Cleaner",
    variants: [
      { sku: "000014", fragrance: null, size: "500ml", pricePaise: 11800 },
      { sku: "000022", fragrance: null, size: "1L", pricePaise: 22000 },
    ],
  },
];

async function main() {
  for (const p of catalog) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { name: p.name, active: true },
      create: { slug: p.slug, name: p.name },
    });

    for (const v of p.variants) {
      await prisma.variant.upsert({
        where: { sku: v.sku },
        update: {
          fragrance: v.fragrance,
          size: v.size,
          pricePaise: v.pricePaise,
          active: true,
        },
        create: {
          sku: v.sku,
          productId: product.id,
          fragrance: v.fragrance,
          size: v.size,
          pricePaise: v.pricePaise,
          stock: DEFAULT_STOCK,
        },
      });
    }
    console.log(`✓ ${p.name} — ${p.variants.length} variant(s)`);
  }

  const [products, variants] = await Promise.all([
    prisma.product.count(),
    prisma.variant.count(),
  ]);
  console.log(`\nSeed complete: ${products} products, ${variants} variants.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });