#!/usr/bin/env node
/**
 * Produces everything the Electron packager needs under `build/`:
 *
 *   build/standalone/      self-contained Next.js production server
 *   build/worker.js        bundled execution worker (esbuild, CJS)
 *   build/driver.js        bundled scheduler driver  (esbuild, CJS)
 *   build/template.db      schema-only SQLite template (first-run seed)
 *
 * The standalone server's better-sqlite3 native binding is rebuilt for
 * Electron's ABI in an isolated copy so the developer's node_modules (and the
 * test/dev workflow, which run on system Node) are never disturbed.
 *
 * Flags:
 *   --skip-next     reuse an existing .next/standalone build
 *   --skip-native   skip the Electron native rebuild (dev/CI smoke builds)
 *
 * Run via `npm run electron:build`. Packaging (`npm run dist`) consumes `build/`.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ─── SHELVED: Electron production packaging is parked (MUS-267 decision) ───────
// The product ships as web + hosted services (MUS-269); desktop packaging was
// built for the pre-Postgres SQLite era (MUS-247 removed better-sqlite3 and the
// bundled file DB) and is not maintained. `electron:dev` is a thin shell over
// `next dev` and is *expected* to run, but is unverified against the Postgres
// runtime. This guard fails fast so the decision is explicit at the entry
// point; to un-shelve, reopen MUS-267 and delete this block after reworking the
// packaging (see docs/ELECTRON.md). Nothing below is deleted — only parked.
if (process.env.EOS_ELECTRON_BUILD_UNSHELVE !== "1") {
  console.error(
    "[electron:build] SHELVED (MUS-267): desktop packaging is parked. See " +
      "docs/ELECTRON.md. Set EOS_ELECTRON_BUILD_UNSHELVE=1 only after reworking " +
      "packaging for a hosted-Postgres DATABASE_URL."
  );
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const skipNext = args.has("--skip-next");
const skipNative = args.has("--skip-native");

const BUILD = path.join(root, "build");
const STANDALONE_SRC = path.join(root, ".next", "standalone");
const STANDALONE_OUT = path.join(BUILD, "standalone");

function run(cmd, cmdArgs, env = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}`);
  const res = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
    // On Windows, `npx`/CLI shims are `.cmd` files; Node refuses to spawn those
    // without a shell (post CVE-2024-27980). Args here are space-free, so this
    // is safe.
    shell: process.platform === "win32",
  });
  if (res.error) {
    throw new Error(`${cmd} ${cmdArgs.join(" ")} failed: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(" ")} exited with ${res.status}`);
  }
}

function freshCopy(src, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// ── 0. Generate the Prisma client ───────────────────────────────────────────
// The client is emitted to src/generated/prisma, which is gitignored — a clean
// checkout / CI runner has no client until this runs, and `next build` would
// fail to resolve `@/generated/prisma`.
function generatePrismaClient() {
  run("npx", ["--no-install", "prisma", "generate"]);
}

// ── 1. Build the standalone Next.js server ──────────────────────────────────
function buildNext() {
  if (skipNext && existsSync(STANDALONE_SRC)) {
    console.log("[electron-build] reusing existing .next/standalone");
    return;
  }
  run("npx", ["--no-install", "next", "build"], { EOS_ELECTRON_BUILD: "1" });
  if (!existsSync(STANDALONE_SRC)) {
    throw new Error(
      "Expected .next/standalone after build — is `output: 'standalone'` active? " +
        "(EOS_ELECTRON_BUILD must be 1)"
    );
  }
}

// Files Next may trace into the standalone output that must NEVER ship in an
// installer (secrets, the developer's dev database) or are pure bloat.
const PRUNE = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production.local",
  ".env.live",
  ".env.example",
  "build",
  "release",
  "package-lock.json",
  "tsconfig.tsbuildinfo",
  ".git",
  ".next/cache",
  "prisma/dev.db",
  "prisma/dev.db-journal",
];

// ── 2. Assemble the standalone bundle (server + static + public) ────────────
function assembleStandalone() {
  freshCopy(STANDALONE_SRC, STANDALONE_OUT);

  // Hard guarantee: strip secrets, the dev database, and build artifacts that
  // tracing may have copied in (belt-and-suspenders with tracingExcludes).
  for (const rel of PRUNE) {
    rmSync(path.join(STANDALONE_OUT, rel), { recursive: true, force: true });
  }

  // Over-tracing (a dynamic fs read in repository-analyzer) drags the whole
  // src/ tree in. The compiled server runs from .next/, so strip plaintext app
  // source — but keep src/generated (the Prisma client) which is referenced.
  const srcDir = path.join(STANDALONE_OUT, "src");
  if (existsSync(srcDir)) {
    for (const entry of readdirSync(srcDir)) {
      if (entry !== "generated") {
        rmSync(path.join(srcDir, entry), { recursive: true, force: true });
      }
    }
  }

  // Standalone output omits these — they must sit next to server.js.
  cpSync(path.join(root, ".next", "static"), path.join(STANDALONE_OUT, ".next", "static"), {
    recursive: true,
  });
  if (existsSync(path.join(root, "public"))) {
    cpSync(path.join(root, "public"), path.join(STANDALONE_OUT, "public"), {
      recursive: true,
    });
  }
  console.log(`[electron-build] standalone assembled → ${STANDALONE_OUT}`);
}

// ── 3. Rebuild better-sqlite3 for Electron's ABI (isolated copy) ────────────
async function rebuildNative() {
  if (skipNative) {
    console.warn(
      "[electron-build] --skip-native: standalone better-sqlite3 keeps system ABI " +
        "(will NOT load inside a packaged Electron app)."
    );
    return;
  }

  const electronVersion = require("electron/package.json").version;
  const { rebuild } = require("@electron/rebuild");

  const nativeRoot = path.join(BUILD, "native");
  const nativePkg = path.join(nativeRoot, "node_modules", "better-sqlite3");
  freshCopy(
    path.join(root, "node_modules", "better-sqlite3"),
    nativePkg
  );
  // @electron/rebuild treats buildPath as a project root and needs a manifest.
  writeFileSync(
    path.join(nativeRoot, "package.json"),
    JSON.stringify(
      { name: "eos-native-build", version: "1.0.0", dependencies: { "better-sqlite3": "*" } },
      null,
      2
    )
  );

  console.log(`[electron-build] rebuilding better-sqlite3 for Electron ${electronVersion}…`);
  await rebuild({
    buildPath: nativeRoot,
    electronVersion,
    onlyModules: ["better-sqlite3"],
    force: true,
  });

  // Place the Electron-ABI build into the standalone bundle.
  freshCopy(nativePkg, path.join(STANDALONE_OUT, "node_modules", "better-sqlite3"));
  console.log("[electron-build] better-sqlite3 (Electron ABI) placed in standalone");
}

// ── 4. Bundle the worker + driver ───────────────────────────────────────────
async function bundleAutomation() {
  const esbuild = require("esbuild");
  await esbuild.build({
    entryPoints: {
      worker: path.join(root, "src", "worker", "index.ts"),
      driver: path.join(root, "src", "worker", "driver.ts"),
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outdir: BUILD,
    // Native module resolved at runtime from the standalone bundle (NODE_PATH).
    external: ["better-sqlite3"],
    tsconfig: path.join(root, "tsconfig.json"),
    // The generated Prisma client polyfills a global __dirname from
    // `import.meta.url` at module top-level. Under CJS output that is empty and
    // throws on load, so define it from the bundle's own filename.
    banner: {
      js: 'const importMetaUrl=require("url").pathToFileURL(__filename).href;',
    },
    define: { "import.meta.url": "importMetaUrl" },
    logLevel: "info",
    legalComments: "none",
  });
  console.log("[electron-build] worker.js + driver.js bundled");
}

// ── 5. Schema template DB ───────────────────────────────────────────────────
function buildTemplateDb() {
  run("node", [path.join("scripts", "build-db-template.mjs"), path.join("build", "template.db")]);
}

async function main() {
  mkdirSync(BUILD, { recursive: true });
  if (!skipNext) generatePrismaClient();
  buildNext();
  assembleStandalone();
  await rebuildNative();
  await bundleAutomation();
  buildTemplateDb();
  console.log("\n[electron-build] done. Run `npm run dist` to package.");
}

main().catch((err) => {
  console.error("\n[electron-build] FAILED:", err.message);
  process.exit(1);
});
