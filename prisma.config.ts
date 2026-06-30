import { defineConfig } from "prisma/config";
import path from "node:path";

// Use the local SQLite database file regardless of shell environment.
// EOS_PRISMA_DB_URL lets the build tooling point `prisma db push` at a throwaway
// file when generating the shipped schema template (scripts/build-db-template.mjs)
// without touching the developer's prisma/dev.db.
const DB_PATH = path.resolve(process.cwd(), "prisma/dev.db");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.EOS_PRISMA_DB_URL ?? `file:${DB_PATH}`,
  },
});
