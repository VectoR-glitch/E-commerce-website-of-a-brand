import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// internal-code SKU -> EAN-13 barcode (from STOCK REPORT.xlsx)
const BARCODES: Record<string, string> = {
  "000011": "8908029280002",
  "000012": "8908029280019",
  "000013": "8908029280026",
  "000014": "8908029280033",
  "000016": "8908029280057",
  "000017": "8908029280064",
  "000018": "8908029280071",
  "000019": "8908029280088",
  "000020": "8908029280095",
  "000021": "8908029280101",
  "000022": "8908029280118",
  "000023": "8908029280125",
};

async function main() {
  // 1) Barcodes for the existing (active) variants.
  for (const [sku, barcode] of Object.entries(BARCODES)) {
    await prisma.variant.updateMany({ where: { sku }, data: { barcode } });
  }

  const toilet = await prisma.product.findUnique({ where: { slug: "toilet-cleaner" } });
  const dishwash = await prisma.product.findUnique({ where: { slug: "dishwash-gel-lime" } });
  if (!toilet || !dishwash) throw new Error("Base products not found.");

  // 2) Toilet Cleaner 250ml — real code/barcode, kept INACTIVE (off-site record).
  await prisma.variant.upsert({
    where: { sku: "000015" },
    update: { barcode: "8908029280040", fragrance: null, size: "250ml", active: false, stock: 447 },
    create: {
      sku: "000015", barcode: "8908029280040", productId: toilet.id,
      fragrance: null, size: "250ml", pricePaise: 0, stock: 447, active: false,
    },
  });

  // 3) Dish Wash 500ml — discontinued: empty SKU, no barcode, INACTIVE.
  await prisma.variant.upsert({
    where: { sku: "" },
    update: { fragrance: "Lime", size: "500ml", active: false, stock: 0 },
    create: {
      sku: "", barcode: null, productId: dishwash.id,
      fragrance: "Lime", size: "500ml", pricePaise: 0, stock: 0, active: false,
    },
  });

  const all = await prisma.variant.findMany({
    select: { sku: true, barcode: true, fragrance: true, size: true, active: true },
    orderBy: [{ active: "desc" }, { sku: "asc" }],
  });
  console.log(`\nVariants in DB (${all.length}):`);
  for (const v of all) {
    console.log(
      `  ${(v.sku || "(empty)").padEnd(8)} ${(v.barcode ?? "-").padEnd(14)} ${(v.fragrance ?? "—").padEnd(11)} ${v.size.padEnd(6)} ${v.active ? "ACTIVE" : "hidden"}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });