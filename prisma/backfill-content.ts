import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { products } from "../src/lib/catalog";

// One-time backfill: copy the editorial content currently hardcoded in
// catalog.ts into the Product rows, keyed by slug. Idempotent (updateMany sets
// absolute values), so safe to re-run.
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const p of products) {
    const res = await prisma.product.updateMany({
      where: { slug: p.slug },
      data: {
        tagline: p.tagline,
        claim: p.claim,
        claimTone: p.claimTone,
        description: p.description ?? null,
        benefits: p.benefits ?? [],
        howToUse: p.howToUse ?? [],
        safety: p.safety ?? null,
        placeholder: p.placeholder,
      },
    });
    console.log(`${p.slug}: ${res.count ? "✓ updated" : "✗ NOT FOUND in DB"}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });