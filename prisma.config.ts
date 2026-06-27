import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moves the connection URL out of schema.prisma into this config.
// Used by the CLI for migrate/introspect; the runtime client uses a driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});