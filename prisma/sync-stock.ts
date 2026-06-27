import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// Real on-hand inventory synced from "STOCK REPORT.xlsx" (BALANCE STOCK column =
// Stock − Sales − Free − Sample). Internal SKU code -> sellable units.
// Re-runnable: sets absolute stock values, so safe to apply repeatedly.
const STOCK: Record<string, number> = {
  // Floor Cleaner — Jasmine
  "000011": 1054, // 500ml
  "000017": 98, //   1L
  "000019": 8, //    2L
  // Floor Cleaner — Lavender
  "000012": 328, //  500ml
  "000018": 68, //   1L
  "000020": 69, //   2L
  // Floor Cleaner — Lemongrass
  "000013": 431, //  500ml
  "000016": 143, //  1L
  "000021": 96, //   2L
  // Toilet Cleaner
  "000014": 1507, // 500ml
  "000022": 162, //  1L
  // Dishwash Gel
  "000023": 157, //  820ml

  // Hidden / off-site records (never sold on the storefront, kept for accuracy):
  "000015": 447, // Toilet Cleaner 250ml — real BALANCE STOCK, variant is inactive
};

// Discontinued Dishwash 500ml (empty SKU, inactive) — zero it out.
const DISCONTINUED_ZERO = [""];

async function main() {
  const before = await prisma.variant.findMany({
    where: { sku: { in: Object.keys(STOCK) } },
    select: { sku: true, stock: true, fragrance: true, size: true, active: true },
  });
  const prev = new Map(before.map((v) => [v.sku, v]));

  let updated = 0;
  const missing: string[] = [];
  for (const [sku, stock] of Object.entries(STOCK)) {
    const res = await prisma.variant.updateMany({ where: { sku }, data: { stock } });
    if (res.count === 0) missing.push(sku);
    else updated += res.count;
  }

  console.log(`\nStock sync — ${updated} variant(s) updated:\n`);
  for (const [sku, stock] of Object.entries(STOCK)) {
    const v = prev.get(sku);
    const label = v ? `${v.fragrance ?? "—"} ${v.size}`.padEnd(16) : "(not in DB)".padEnd(16);
    const old = v ? String(v.stock).padStart(5) : "  ?  ";
    const flag = v && !v.active ? " [hidden]" : "";
    console.log(`  ${sku}  ${label}  ${old} -> ${String(stock).padStart(5)}${flag}`);
  }
  if (missing.length) console.warn(`\n⚠ SKUs not found in DB: ${missing.join(", ")}`);

  for (const sku of DISCONTINUED_ZERO) {
    const res = await prisma.variant.updateMany({ where: { sku }, data: { stock: 0 } });
    if (res.count) console.log(`  ${sku || "(empty)"}  discontinued        -> ${String(0).padStart(5)} [hidden]`);
  }

  const total = Object.values(STOCK).reduce((a, b) => a + b, 0);
  console.log(`\nTotal sellable units across active catalog: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
