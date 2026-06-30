import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seeds (or resets the password of) an ADMIN account so you can sign in to the
// ops console. Run with the credentials in env, e.g.:
//   ADMIN_SEED_EMAIL=klenichofficial@gmail.com ADMIN_SEED_PASSWORD='…' \
//     npx tsx prisma/seed-admin.ts
//
// hashPassword is inlined here (not imported from src/lib/auth, which is
// server-only and uses the @/ alias) but produces the EXACT same
// `scrypt$<saltHex>$<hashHex>` format that verifyPassword expects.
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const email = (process.env.ADMIN_SEED_EMAIL ?? "klenichofficial@gmail.com").trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD ?? "";

async function main() {
  if (password.length < 8) {
    throw new Error("Set ADMIN_SEED_PASSWORD (min 8 chars) to seed/reset the admin account.");
  }
  const passwordHash = hashPassword(password);
  const user = await prisma.customer.upsert({
    where: { email },
    create: { email, passwordHash, role: "ADMIN", name: "Klenich Admin" },
    update: { passwordHash, role: "ADMIN" },
  });
  console.log(`✓ Admin ready: ${user.email} (role ${user.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });