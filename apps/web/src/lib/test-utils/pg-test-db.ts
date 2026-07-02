import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { prisma as PrismaSingleton } from "../prisma";

/**
 * Integration-test database harness for PostgreSQL.
 *
 * Each integration suite gets its own isolated PostgreSQL *schema*. We apply the
 * real migration DDL into that schema, then point the Prisma singleton at
 * `…?schema=<schema>`. Because vitest's `forks` pool runs every test file in its
 * own process, mutating `process.env.DATABASE_URL` here is isolated per suite —
 * suites never see each other's tables and can run in parallel against one DB.
 *
 * This replaces the old per-file hand-written SQLite DDL: suites now test
 * against the *actual* schema, so they can't drift from `prisma/schema.prisma`.
 *
 * The target database comes from `TEST_DATABASE_URL` (falling back to
 * `DATABASE_URL`, then a local Docker default). Point it at a disposable
 * Postgres — never a production database.
 */

type PrismaClientInstance = typeof PrismaSingleton;

const REPO_ROOT = path.resolve(__dirname, "../../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "prisma", "migrations");

const DEFAULT_TEST_URL = "postgresql://postgres:postgres@localhost:5433/avion";

/** Base Postgres URL the tests run against, with any `?schema=` stripped. */
function baseUrl(): string {
  const raw =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_TEST_URL;
  const u = new URL(raw);
  u.searchParams.delete("schema");
  return u.toString();
}

/** Concatenated DDL of every migration (sorted) — the full current schema. */
let cachedDdl: string | null = null;
function migrationDdl(): string {
  if (cachedDdl !== null) return cachedDdl;
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const parts: string[] = [];
  for (const dir of dirs) {
    try {
      parts.push(readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8"));
    } catch {
      // directory without a migration.sql — skip
    }
  }
  if (parts.length === 0) {
    throw new Error(`No migration SQL found under ${MIGRATIONS_DIR}`);
  }
  cachedDdl = parts.join("\n");
  return cachedDdl;
}

/** Normalize a suite name into a safe schema identifier (`test_…`). */
export function schemaNameFor(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
  return s.startsWith("test_") ? s : `test_${s}`;
}

/**
 * Provision a clean isolated schema for one suite and return a Prisma client
 * scoped to it. Call once in `beforeAll`.
 *
 * @param name  A suite-unique label (e.g. "repository-write").
 */
export async function setupTestSchema(
  name: string
): Promise<{ prisma: PrismaClientInstance; schema: string }> {
  const schema = schemaNameFor(name);

  const admin = new Client({ connectionString: baseUrl() });
  await admin.connect();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.query(`CREATE SCHEMA "${schema}"`);
    // search_path persists for the session, so the migration DDL below creates
    // and cross-references its tables inside the new schema.
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(migrationDdl());
  } finally {
    await admin.end();
  }

  const url = new URL(baseUrl());
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.toString();
  delete (globalThis as Record<string, unknown>).prisma;

  const mod = await import("../prisma");
  return { prisma: mod.prisma, schema };
}

/** Drop the suite's schema and disconnect. Call once in `afterAll`. */
export async function teardownTestSchema(
  prisma: PrismaClientInstance,
  schema: string
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } catch {
    // best-effort cleanup
  }
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  delete (globalThis as Record<string, unknown>).prisma;
}
