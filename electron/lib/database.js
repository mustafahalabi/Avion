"use strict";

/**
 * First-run database provisioning.
 *
 * The app's Prisma client (better-sqlite3 driver adapter) opens the SQLite file
 * directly and does NOT run migrations. So the writable user database must
 * already contain the schema. We ship a schema-only `template.db` (built at
 * package time via `prisma db push`) and copy it into the per-user data
 * directory on first launch.
 *
 * Schema upgrades across app versions are intentionally out of scope here — the
 * existing user DB is left untouched once created. See docs/ELECTRON.md.
 */

const fs = require("node:fs");

const { templateDbPath, userDbPath } = require("./config");

/**
 * Ensures a usable database exists in userData, seeding from the shipped
 * template on first run.
 *
 * @returns {{ path: string, created: boolean }}
 */
function ensureUserDatabase() {
  const dest = userDbPath();

  if (fs.existsSync(dest)) {
    return { path: dest, created: false };
  }

  const template = templateDbPath();
  if (!fs.existsSync(template)) {
    throw new Error(
      `Schema template database not found at ${template}. ` +
        `Run \`npm run electron:build\` to generate it before packaging.`
    );
  }

  fs.copyFileSync(template, dest);
  // Best-effort: drop any stale WAL/journal siblings that could shadow the copy.
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    try {
      fs.rmSync(dest + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }

  return { path: dest, created: true };
}

module.exports = { ensureUserDatabase };
