/**
 * Database URL resolution for @avion/api (MUS-265).
 *
 * The api treats the shared Avion database as read-only. To make that a
 * database-level guarantee (not just convention), it prefers a dedicated
 * API_DATABASE_URL — expected to authenticate as the SELECT-only
 * `avion_api_ro` role (see scripts/provision-readonly-role.ts) — and falls
 * back to the shared DATABASE_URL for local dev.
 */

export type DatabaseUrlSource = "API_DATABASE_URL" | "DATABASE_URL";

export interface ResolvedDatabaseUrl {
  url: string;
  source: DatabaseUrlSource;
}

export function resolveApiDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): ResolvedDatabaseUrl {
  const apiUrl = env.API_DATABASE_URL?.trim();
  if (apiUrl) return { url: apiUrl, source: "API_DATABASE_URL" };

  const sharedUrl = env.DATABASE_URL?.trim();
  if (sharedUrl) return { url: sharedUrl, source: "DATABASE_URL" };

  throw new Error(
    "Neither API_DATABASE_URL nor DATABASE_URL is set for @avion/api. Copy " +
      "apps/api/.env.example to apps/api/.env and point it at the same PostgreSQL " +
      "as apps/web — preferably via API_DATABASE_URL with the read-only " +
      "avion_api_ro role (pnpm --filter @avion/api db:provision-readonly).",
  );
}
