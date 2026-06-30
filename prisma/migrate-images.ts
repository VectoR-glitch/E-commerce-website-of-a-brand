import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { products } from "../src/lib/catalog";

// One-time: import the /public/products/*.webp images into Postgres as
// ProductImage rows, reconstructing the catalog's default / per-fragrance /
// per-variant slots. Idempotent — clears each product's images first.
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });
const PUBLIC = join(process.cwd(), "public");

function readImage(webPath: string): Uint8Array<ArrayBuffer> {
  // "/products/x.webp" → public/products/x.webp. Uint8Array.from copies into a
  // fresh ArrayBuffer-backed array, matching Prisma's Bytes type.
  return Uint8Array.from(readFileSync(join(PUBLIC, webPath)));
}

async function main() {
  for (const p of products) {
    const dbp = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (!dbp) {
      console.log(`${p.slug}: not in DB — skipped`);
      continue;
    }
    await prisma.productImage.deleteMany({ where: { productId: dbp.id } });

    let sortOrder = 0;
    const add = (path: string, fragrance: string | null, size: string | null, isPrimary: boolean, alt: string) =>
      prisma.productImage.create({
        data: {
          productId: dbp.id,
          data: readImage(path),
          contentType: "image/webp",
          fragrance,
          size,
          isPrimary,
          sortOrder: sortOrder++,
          alt,
        },
      });

    // default / primary
    await add(p.image, null, null, true, p.name);
    // per-fragrance
    for (const [frag, path] of Object.entries(p.fragranceImages ?? {})) {
      await add(path, frag, null, false, `${p.name} — ${frag}`);
    }
    // per-variant (fragrance|size)
    for (const [key, path] of Object.entries(p.variantImages ?? {})) {
      const [frag, size] = key.split("|");
      await add(path, frag, size, false, `${p.name} — ${frag} ${size}`);
    }

    const count = await prisma.productImage.count({ where: { productId: dbp.id } });
    console.log(`${p.slug}: ${count} images imported`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });