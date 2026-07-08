import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// database connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  // Prisma 7 requires a driver adapter. DATABASE_URL should be Neon's POOLED
  // (PgBouncer) connection string in deployed environments — every serverless
  // invocation otherwise opens its own direct Postgres connection, which
  // exhausts Neon's direct-connection limit under any real concurrency.
  // Migrations use DIRECT_URL instead (see prisma.config.ts) since DDL isn't
  // safe over a transaction-pooled connection. `max` caps how many
  // connections THIS instance's pool opens to the pooler — serverless
  // functions rarely need more than a couple at once, so a low cap here adds
  // a second layer of protection even against the pooler's own connection cap.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}