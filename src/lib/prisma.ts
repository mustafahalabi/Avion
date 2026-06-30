import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Engineering OS / Avion runs on hosted PostgreSQL (see .env.example). The app,
// worker, and driver all connect to the same database via DATABASE_URL so the
// self-driving loop shares one durable, concurrent-safe store.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. A PostgreSQL connection string is required " +
        "(e.g. postgresql://user:pass@host:5432/db). See .env.example."
    );
  }

  // Prisma's `?schema=` convention isn't understood by node-postgres, so we
  // parse it out of the URL and feed it to the adapter's `schema` option
  // instead. This is what lets the integration tests isolate into a per-suite
  // PostgreSQL schema (the runtime/prod URL has no `schema` param → `public`).
  const parsed = new URL(connectionString);
  const schema = parsed.searchParams.get("schema") ?? undefined;
  parsed.searchParams.delete("schema");

  // When a schema is requested (integration tests), also pin the pool's
  // search_path so raw `$executeRawUnsafe` queries with unqualified table names
  // resolve to that schema too — not just the Prisma-generated queries the
  // adapter's `schema` option qualifies.
  const poolConfig: Record<string, unknown> = {
    connectionString: parsed.toString(),
  };
  if (schema) {
    // libpq startup option syntax (not SQL) — schema names from the test
    // harness are sanitized to [a-z0-9_], so no identifier quoting is needed.
    poolConfig.options = `-c search_path=${schema}`;
    // Keep per-suite pools small so many parallel integration suites don't
    // exhaust the shared test database's connection slots.
    poolConfig.max = 5;
  }

  const adapter = new PrismaPg(poolConfig, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

declare global {
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
