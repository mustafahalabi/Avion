import { defineConfig } from "prisma/config";

// Prisma 7 config. The api treats the shared database as READ-ONLY (no
// migrations live here — @avion/web owns them), so this only wires up the
// schema location + datasource URL for CLI commands like `prisma studio` /
// `prisma db pull`. The runtime connection is made by the @prisma/adapter-pg
// adapter in src/prisma/prisma.service.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Same precedence as the runtime (src/prisma/database-url.ts): prefer the
    // read-only API_DATABASE_URL, fall back to the shared DATABASE_URL.
    url: process.env.API_DATABASE_URL ?? process.env.DATABASE_URL,
  },
});
