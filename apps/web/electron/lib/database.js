"use strict";

/**
 * First-run database provisioning (SQLite desktop bundle).
 *
 * ⚠️ DEFERRED (MUS-247: SQLite → hosted PostgreSQL). The runtime now uses
 * hosted Postgres via DATABASE_URL, so the bundled file-DB model below no longer
 * matches production. The desktop app needs reworking to connect to a Postgres
 * connection string instead of seeding a local `template.db`; that packaging
 * change is a tracked follow-up and intentionally out of scope for the DB
 * migration. This module is left intact so the existing Electron code keeps
 * importing, but the bundled-SQLite path is not used by the hosted app.
 *
 * The app's Prisma client opened the SQLite file directly and did NOT run
 * migrations, so the writable user database had to already contain the schema.
 * We shipped a schema-only `template.db` and copied it into the per-user data
 * directory on first launch. Schema upgrades across versions were out of scope.
 * See docs/ELECTRON.md.
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
