"use strict";

/**
 * Static configuration + path resolution for the Electron shell.
 *
 * Everything that depends on "are we packaged or running from source" and "where
 * do the bundled resources live" is centralised here so the rest of the main
 * process never branches on it directly.
 */

const path = require("node:path");
const { app } = require("electron");

const isDev = !app.isPackaged;

/**
 * Preferred localhost port for the embedded Next.js server in production.
 *
 * Pinned (not random) so OAuth callback URLs and Clerk allowed origins stay
 * stable across launches. Override with EOS_APP_PORT. In dev we attach to the
 * `next dev` server, which defaults to 3000.
 */
const DEV_PORT = Number(process.env.EOS_DEV_PORT || 3000);
const PREFERRED_PROD_PORT = Number(process.env.EOS_APP_PORT || 34567);

/** Loopback host the embedded server binds to (never expose on the network). */
const HOST = "127.0.0.1";

/**
 * Host the BrowserWindow loads and OAuth/Clerk are based on. Must be `localhost`,
 * NOT 127.0.0.1: Clerk's development "dev browser" handshake is origin-sensitive
 * and hangs in a loading state on a raw IP (the app renders a blank screen).
 * The server still *binds* to HOST (127.0.0.1); localhost resolves to it.
 */
const APP_HOST = "localhost";

/**
 * Resolves the directory that holds packaged extra resources
 * (standalone server, worker/driver bundles, template DB).
 *
 * In a packaged app this is `process.resourcesPath`; from source it is the
 * repo's `build/` working area produced by `scripts/build-electron.mjs`.
 */
function resourcesDir() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, "..", "..", "build");
}

/** Absolute path to the standalone Next.js server entry (`server.js`). */
function standaloneServerEntry() {
  return path.join(resourcesDir(), "standalone", "server.js");
}

/** Absolute path to the standalone server's working directory. */
function standaloneDir() {
  return path.join(resourcesDir(), "standalone");
}

/** node_modules inside the standalone bundle (holds the Electron-ABI better-sqlite3). */
function standaloneNodeModules() {
  return path.join(standaloneDir(), "node_modules");
}

/** Absolute path to a bundled worker/driver script under resources. */
function automationBundle(name) {
  return path.join(resourcesDir(), name);
}

/** Absolute path to the shipped schema-only SQLite template. */
function templateDbPath() {
  return path.join(resourcesDir(), "template.db");
}

/** Writable database file inside the OS-standard per-user data directory. */
function userDbPath() {
  return path.join(app.getPath("userData"), "engineering-os.db");
}

/**
 * The repo's dev database (prisma/dev.db) — used in development so the Electron
 * shell, the `next dev` server, and any automation all share one database.
 */
function devDatabasePath() {
  return path.join(__dirname, "..", "..", "prisma", "dev.db");
}

/** Writable env file where generated/overridable runtime secrets are persisted. */
function userEnvPath() {
  return path.join(app.getPath("userData"), "eos.env");
}

/** A `.env.production` shipped alongside the standalone server, if present. */
function bundledEnvPath() {
  return path.join(standaloneDir(), ".env.production");
}

module.exports = {
  isDev,
  HOST,
  APP_HOST,
  DEV_PORT,
  PREFERRED_PROD_PORT,
  resourcesDir,
  standaloneServerEntry,
  standaloneDir,
  standaloneNodeModules,
  automationBundle,
  templateDbPath,
  userDbPath,
  devDatabasePath,
  userEnvPath,
  bundledEnvPath,
};
