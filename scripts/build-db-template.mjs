#!/usr/bin/env node
/**
 * Builds the schema-only SQLite template that ships with the desktop app.
 *
 * The app's Prisma client (better-sqlite3 driver adapter) opens the database
 * file directly and never runs migrations, so the file must already contain the
 * full schema. The repo's migration history is squashed (the `init` migration
 * is empty and later ones use SQLite table-rebuild SQL), so we materialise the
 * schema from `schema.prisma` via `prisma db push` against a throwaway file,
 * then copy the result to the build output.
 *
 * Usage: node scripts/build-db-template.mjs [outputPath]
 *   default outputPath: build/template.db
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
