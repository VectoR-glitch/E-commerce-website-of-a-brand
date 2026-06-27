import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// Old placeholder SKU -> real internal code (from STOCK REPORT.xlsx).
const MAP: Record<string, string> = {
  "KLN-DW-LIM-820": "000023",
  "KLN-FL-JAS-500": "000011",
  "KLN-FL-JAS-1000": "000017",
  "KLN-FL-JAS-2000": "000019",
  "KLN-FL-LAV-500": "000012",
  "KLN-FL-LAV-1000": "000018",
  "KLN-FL-LAV-2000": "000020",
  "KLN-FL-LEM-500": "000013",
  "KLN-FL-LEM-1000": "000016",
  "KLN-FL-LEM-2000": "000021",
  "KLN-TC-500": "000014",
  "KLN-TC-1000": "000022",
};

async function main() {
  for (const [oldSku, newSku] of Object.entries(MAP)) {
    const res = await prisma.variant.updateMany({
      where: { sku: oldSku },
      data: { sku: newSku },
    });
    console.log(`${oldSku} -> ${newSku}  (${res.count} updated)`);
  }

  console.log("\nFinal variants:");
  const all = await prisma.variant.findMany({
    select: { sku: true, fragrance: true, size: true, pricePaise: true },
    orderBy: { sku: "asc" },
  });
  for (const v of all) {
    console.log(
      `  ${v.sku}  ${(v.fragrance ?? "—").padEnd(11)} ${v.size.padEnd(6)} ₹${v.pricePaise / 100}`,
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