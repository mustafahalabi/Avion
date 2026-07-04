/**
 * Single-instance lock for the worker and driver (Goal 4 — operational hardening).
 *
 * Running the loop as loose background processes led to a stray-process pileup
 * (two workers + three drivers alive at once), silently double-spending and
 * corrupting the driver's live/prepared accounting. This guard makes each role
 * (`worker`, `driver`) refuse to start when another instance already holds it.
 *
 * It uses a **Postgres session-level advisory lock** on a dedicated connection:
 *  - it is DB-backed, so it works across processes AND machines pointing at the
 *    same database (not just one host),
 *  - it is held for the connection's lifetime and **auto-released when the
 *    process dies** (the socket closes), so a crashed instance never wedges the
 *    lock — a supervisor can restart cleanly with no manual cleanup.
 */

import { Client } from "pg";

/** A held (or refused) single-instance lock. */
export interface InstanceLock {
  /** True when THIS process acquired the lock (may run); false when another holds it. */
  readonly acquired: boolean;
  /** The role this lock guards. */
  readonly role: string;
  /** Releases the lock + closes the dedicated connection. Idempotent, never throws. */
  release(): Promise<void>;
}

/**
 * Derives a stable 31-bit positive integer advisory-lock key from a role name.
 * (Kept in the positive int4 range so the `::int` cast is sign-safe and two
 * distinct roles get distinct keys.)
 *
 * @param role - Role name (e.g. "worker", "driver").
 * @returns A deterministic key in [0, 2^31).
 */
export function lockKeyFor(role: string): number {
  let hash = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < role.length; i++) {
    hash ^= role.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Fold to a non-negative 31-bit int.
  return (hash >>> 0) % 0x7fffffff;
}

/**
 * Strips Prisma's `?schema=` query param, which node-postgres doesn't understand
 * (mirrors `src/lib/prisma.ts`). Advisory locks are database-global regardless.
 */
function normalizeConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("schema");
    return parsed.toString();
  } catch {
    return url;
  }
}

/** A no-op released lock (used when disabled or when acquisition is refused). */
function refusedLock(role: string, acquired: boolean): InstanceLock {
  return { acquired, role, async release() {} };
}

/**
 * Attempts to acquire the single-instance lock for a role.
 *
 * @param role - Role to guard (e.g. "worker", "driver").
 * @param options.connectionString - Override DATABASE_URL (for tests).
 * @param options.enabled - When false, always "acquires" without touching the DB
 *   (escape hatch via `WORKER_SINGLE_INSTANCE=0`).
 * @returns An {@link InstanceLock}; check `.acquired` before running the loop.
 */
export async function acquireSingleInstanceLock(
  role: string,
  options: { connectionString?: string; enabled?: boolean } = {}
): Promise<InstanceLock> {
  if (options.enabled === false) {
    return refusedLock(role, true);
  }
  const url = options.connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to acquire the single-instance lock.");
  }

  const client = new Client({ connectionString: normalizeConnectionString(url) });
  await client.connect();

  const key = lockKeyFor(role);
  try {
    const res = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1::int) AS locked",
      [key]
    );
    const acquired = res.rows[0]?.locked === true;
    if (!acquired) {
      await client.end().catch(() => {});
      return refusedLock(role, false);
    }
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }

  let released = false;
  return {
    acquired: true,
    role,
    async release(): Promise<void> {
      if (released) return;
      released = true;
      try {
        await client.query("SELECT pg_advisory_unlock($1::int)", [key]);
      } catch {
        // Best-effort — process exit closes the socket and PG releases anyway.
      }
      try {
        await client.end();
      } catch {
        // Already closing.
      }
    },
  };
}

/** Whether single-instance guarding is enabled (default on; `WORKER_SINGLE_INSTANCE=0` disables). */
export function singleInstanceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.WORKER_SINGLE_INSTANCE ?? "").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}
