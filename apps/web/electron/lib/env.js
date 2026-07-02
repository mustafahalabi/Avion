"use strict";

/**
 * Runtime environment resolution for the embedded server, worker and driver.
 *
 * Precedence (lowest → highest):
 *   1. `.env.production` bundled next to the standalone server (build-time keys,
 *      e.g. the Clerk publishable key — note NEXT_PUBLIC_* are already inlined
 *      at build time, so only server-side vars here actually take effect).
 *   2. `eos.env` in the per-user data directory (user-editable overrides).
 *   3. Values this shell computes/injects (DB path, port, base URL).
 *
 * On first launch we also generate and persist the per-install secrets the app
 * needs to be stable across restarts (credential encryption + OAuth state), so
 * encrypted data written today still decrypts tomorrow.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");

const { userEnvPath, bundledEnvPath } = require("./config");

/** Parses a minimal KEY=VALUE `.env` file (supports quotes + `#` comments). */
function parseEnvFile(filePath) {
  const out = {};
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Serialises a flat record back into `.env` form. */
function serializeEnvFile(record) {
  return (
    Object.entries(record)
      .map(([k, v]) => `${k}=${JSON.stringify(String(v))}`)
      .join("\n") + "\n"
  );
}

/** A 64-char hex string suitable for AES-256 / HMAC keys. */
function generateHexKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Loads the user override env, generating + persisting any missing per-install
 * secrets on first run. Returns the (possibly augmented) record.
 */
function loadOrInitUserEnv() {
  const filePath = userEnvPath();
  const existing = parseEnvFile(filePath);
  let mutated = false;

  for (const key of ["CREDENTIALS_ENCRYPTION_KEY", "OAUTH_STATE_SECRET"]) {
    if (!existing[key]) {
      existing[key] = generateHexKey();
      mutated = true;
    }
  }

  if (mutated) {
    try {
      fs.writeFileSync(filePath, serializeEnvFile(existing), { mode: 0o600 });
    } catch (err) {
      // Non-fatal: the app still runs this session, just without persistence.
      console.error("[eos] could not persist generated secrets:", err.message);
    }
  }

  return existing;
}

/**
 * Builds the full environment for a spawned child (server / worker / driver).
 *
 * @param {object} opts
 * @param {string} opts.dbPath   Absolute path to the writable SQLite file.
 * @param {string} opts.baseUrl  Origin the server is reachable at (for OAuth).
 * @param {string} [opts.port]   Port the embedded server should bind to.
 * @param {string} [opts.nodePath] Extra NODE_PATH entry (native module resolution).
 * @returns {NodeJS.ProcessEnv}
 */
function buildChildEnv({ dbPath, baseUrl, port, nodePath }) {
  const bundled = parseEnvFile(bundledEnvPath());
  const user = loadOrInitUserEnv();

  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env,
    ...bundled,
    ...user,
    NODE_ENV: "production",
    // The app's Prisma client honours this over DATABASE_URL/cwd.
    ENGINEERING_OS_DATABASE_PATH: dbPath,
    // Kept in sync so any code path that reads DATABASE_URL also works.
    DATABASE_URL: `file:${dbPath}`,
  };

  if (baseUrl) {
    // OAuth callbacks are derived from this; must match the live origin.
    env.OAUTH_REDIRECT_BASE_URL = baseUrl;
  }
  if (port) {
    env.PORT = String(port);
    env.HOSTNAME = "127.0.0.1";
  }
  if (nodePath) {
    env.NODE_PATH = [nodePath, process.env.NODE_PATH]
      .filter(Boolean)
      .join(require("node:path").delimiter);
  }

  return env;
}

module.exports = {
  parseEnvFile,
  serializeEnvFile,
  generateHexKey,
  loadOrInitUserEnv,
  buildChildEnv,
};
