#!/usr/bin/env node
/**
 * ⚠️ DEFERRED (MUS-247: SQLite → hosted PostgreSQL).
 *
 * This script built the schema-only *SQLite* template that the Electron desktop
 * app shipped and opened as a local file database. The runtime has migrated to
 * hosted PostgreSQL (`provider = "postgresql"`), so a bundled file DB no longer
 * applies: the desktop app must instead connect to a Postgres `DATABASE_URL`.
 *
 * Reworking the desktop packaging for a hosted DB (connection-string config,
 * no offline file DB) is intentionally out of scope for the database migration.
 * Until that follow-up lands, this script fails fast rather than silently
 * producing a broken (or impossible) SQLite template under a Postgres schema.
 *
 * Usage: node scripts/build-db-template.mjs [outputPath]
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.error(
  "[template-db] SHELVED (MUS-267): the Electron desktop app is formally parked. " +
    "Its SQLite template DB was superseded by the hosted-Postgres migration (MUS-247), " +
    "and the product ships as web + hosted services (MUS-269). Desktop packaging is " +
    "not maintained; `electron:dev` still works for local experimentation.\n" +
    "See docs/ELECTRON.md. To un-shelve, reopen MUS-267 and rework packaging for a " +
    "PostgreSQL DATABASE_URL (connection-string config, no offline file DB)."
);
process.exit(1);
// eslint-disable-next-line no-unreachable

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const output = path.resolve(
  process.argv[2] || path.join(projectRoot, "build", "template.db")
);
const tempDb = path.join(os.tmpdir(), `eos-template-${process.pid}.db`);

function cleanupTemp() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    try {
      rmSync(tempDb + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
}

cleanupTemp();

const prismaBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);

console.log(`[template-db] pushing schema → ${tempDb}`);
const result = spawnSync(
  prismaBin,
  ["db", "push", "--url", `file:${tempDb}`, "--accept-data-loss"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    // prisma.cmd is a .cmd shim on Windows; Node won't spawn it without a shell.
    shell: process.platform === "win32",
    env: {
      ...process.env,
      // Belt-and-suspenders: prisma.config.ts also honours this override.
      EOS_PRISMA_DB_URL: `file:${tempDb}`,
    },
  }
);

if (result.error) {
  cleanupTemp();
  console.error("[template-db] failed to spawn prisma:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  cleanupTemp();
  console.error("[template-db] prisma db push failed");
  process.exit(result.status ?? 1);
}

mkdirSync(path.dirname(output), { recursive: true });
copyFileSync(tempDb, output);
cleanupTemp();

console.log(`[template-db] wrote ${output}`);
