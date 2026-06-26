import { defineConfig } from "prisma/config";
import path from "node:path";

// Use the local SQLite database file regardless of shell environment
const DB_PATH = path.resolve(process.cwd(), "prisma/dev.db");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: `file:${DB_PATH}`,
  },
});
