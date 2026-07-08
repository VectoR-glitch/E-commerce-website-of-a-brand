import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moves the connection URL out of schema.prisma into this config.
// Used by the CLI for migrate/introspect/studio — DIRECT_URL (Neon's
// non-pooled connection), since DDL/advisory locks aren't safe over a
// transaction-pooled (PgBouncer) connection. The runtime client (src/lib/
// prisma.ts) uses DATABASE_URL instead, which should be the POOLED string.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});