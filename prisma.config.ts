import { defineConfig } from "prisma/config";

// Datasource URL comes from the environment (DATABASE_URL) so the Prisma CLI
// (migrate / db push / studio) targets the same hosted PostgreSQL the runtime
// uses. Migration commands and the integration-test harness may append a
// `?schema=…` to scope work to a throwaway schema.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
