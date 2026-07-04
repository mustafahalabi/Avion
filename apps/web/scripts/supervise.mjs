#!/usr/bin/env node
/**
 * Process supervisor for the Avion loop (Goal 4 — operational hardening).
 *
 * One command brings up exactly one of each long-running process (worker +
 * driver by default, optionally the web dev server), health-checked by liveness
 * and restarted on crash with exponential backoff. Combined with the DB
 * single-instance lock (src/worker/single-instance-lock.ts), a second supervisor
 * — or a stray manual `pnpm worker` — cannot double-run the loop: the duplicate
 * exits immediately and this supervisor backs off instead of hot-looping.
 *
 *   pnpm supervise                 # worker + driver
 *   SUPERVISE_INCLUDE_DEV=1 pnpm supervise   # + next dev (web)
 *   SUPERVISE_SERVICES=worker pnpm supervise # explicit subset
 *
 * It loads apps/web/.env itself, so children inherit DATABASE_URL +
 * CREDENTIALS_ENCRYPTION_KEY without a separate `set -a; . .env` step.
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");

/** Minimal .env loader (KEY=VALUE lines; supports `export`, quotes, comments). */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const stripped = line.startsWith("export ") ? line.slice(7) : line;
    const eq = stripped.indexOf("=");
    if (eq < 0) continue;
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't clobber values already present in the real environment.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(appDir, ".env"));

if (!process.env.DATABASE_URL) {
  console.error(
    "[supervise] DATABASE_URL is not set (and apps/web/.env didn't provide it). Aborting."
  );
  process.exit(1);
}

// Health-check window per service. A worker iteration can legitimately hold for
// a whole agent session, so its heartbeat window is generous (2× the session
// timeout, min 1h); the driver ticks every ~15s so a few minutes stale is dead.
const hbDir = process.env.SUPERVISE_HEARTBEAT_DIR ?? join(tmpdir(), "avion-supervise");
const sessionTimeoutS = Number(process.env.WORKER_SESSION_TIMEOUT_SECONDS ?? 1800);
const workerHbMaxMs = Number(
  process.env.SUPERVISE_WORKER_HEARTBEAT_MAX_MS ?? Math.max(3_600_000, sessionTimeoutS * 2 * 1000)
);
const driverHbMaxMs = Number(process.env.SUPERVISE_DRIVER_HEARTBEAT_MAX_MS ?? 300_000);

/** Available service definitions. A `heartbeat` file + `maxAgeMs` enables the watchdog. */
const ALL_SERVICES = {
  worker: {
    name: "worker",
    cmd: "node_modules/.bin/tsx",
    args: ["src/worker/index.ts"],
    heartbeat: join(hbDir, "worker.heartbeat"),
    heartbeatEnv: "WORKER_HEARTBEAT_FILE",
    maxAgeMs: workerHbMaxMs,
  },
  driver: {
    name: "driver",
    cmd: "node_modules/.bin/tsx",
    args: ["src/worker/driver.ts"],
    heartbeat: join(hbDir, "driver.heartbeat"),
    heartbeatEnv: "DRIVER_HEARTBEAT_FILE",
    maxAgeMs: driverHbMaxMs,
  },
  dev: { name: "web", cmd: "node_modules/.bin/next", args: ["dev"] },
};

function resolveServices() {
  const explicit = process.env.SUPERVISE_SERVICES;
  let names = explicit
    ? explicit.split(",").map((s) => s.trim()).filter(Boolean)
    : ["worker", "driver"];
  if (!explicit && /^(1|true|yes|on)$/i.test(process.env.SUPERVISE_INCLUDE_DEV ?? "")) {
    names.push("dev");
  }
  const services = names.map((n) => ALL_SERVICES[n]).filter(Boolean);
  if (services.length === 0) {
    console.error(`[supervise] No known services in "${names.join(",")}". Known: ${Object.keys(ALL_SERVICES).join(", ")}.`);
    process.exit(1);
  }
  return services;
}

const services = resolveServices();
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
// A child that stayed up at least this long is "stable" — its next restart
// resets to the base delay instead of inheriting an escalated backoff.
const BACKOFF_RESET_MS = 60_000;
// After the watchdog SIGTERMs a stale child, escalate to SIGKILL if it's still
// alive + stale this long later (a hung process may ignore SIGTERM).
const WATCHDOG_KILL_GRACE_MS = 15_000;
let shuttingDown = false;
const children = new Map(); // name → child process
const killSentAt = new Map(); // name → ts of the watchdog's SIGTERM, for SIGKILL escalation

/** Spawns one service and re-arms a backoff restart when it exits. */
function start(service, backoffMs = BASE_BACKOFF_MS) {
  if (shuttingDown) return;
  const childEnv = { ...process.env };
  if (service.heartbeatEnv) childEnv[service.heartbeatEnv] = service.heartbeat;
  const child = spawn(service.cmd, service.args, {
    cwd: appDir,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(service.name, child);
  killSentAt.delete(service.name); // fresh start clears any stale-kill tracking
  const startedAt = Date.now();
  // Guard so a spawn that emits BOTH 'error' and 'exit' only restarts once.
  let handled = false;

  const prefix = (stream, tag) => {
    stream.setEncoding("utf8");
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        console.log(`[${service.name}${tag}] ${line}`);
      }
    });
  };
  prefix(child.stdout, "");
  prefix(child.stderr, ":err");

  // Both 'exit' and 'error' (spawn failure — ENOENT etc.) route here so a child
  // that never starts is still restarted, not silently dropped from `children`.
  const onDown = (why) => {
    if (handled) return;
    handled = true;
    children.delete(service.name);
    killSentAt.delete(service.name);
    if (shuttingDown) return;
    // Reset the backoff once the child proved stable (ran past the reset window),
    // so a crash after hours of healthy uptime restarts fast — while a hot-loop
    // (e.g. the single-instance lock refusing a duplicate) keeps backing off.
    const ranMs = Date.now() - startedAt;
    const next =
      ranMs >= BACKOFF_RESET_MS
        ? BASE_BACKOFF_MS
        : Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    console.error(
      `[supervise] ${service.name} down (${why}); restarting in ${backoffMs}ms`
    );
    setTimeout(() => start(service, next), backoffMs);
  };

  child.on("exit", (code, signal) => onDown(`exit code=${code} signal=${signal}`));
  child.on("error", (err) => onDown(`spawn error: ${err.message}`));
}

/** Graceful shutdown: stop restarting, forward SIGTERM, wait, then exit. */
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[supervise] received ${signal}; stopping ${children.size} child process(es)…`);
  for (const [name, child] of children) {
    console.log(`[supervise] SIGTERM → ${name} (pid ${child.pid})`);
    child.kill("SIGTERM");
  }
  // Give children time to release locks + clean up, then exit.
  const deadline = setTimeout(() => {
    for (const [, child] of children) child.kill("SIGKILL");
    process.exit(0);
  }, 10_000);
  const check = setInterval(() => {
    if (children.size === 0) {
      clearTimeout(deadline);
      clearInterval(check);
      process.exit(0);
    }
  }, 200);
}

/**
 * Liveness watchdog: a hung (not crashed) process keeps its PID but stops
 * beating its heartbeat file. When a service's heartbeat is older than its
 * generous window, SIGTERM it — the exit handler then restarts it.
 */
function checkHeartbeats() {
  if (shuttingDown) return;
  const now = Date.now();
  for (const service of services) {
    if (!service.heartbeat || !service.maxAgeMs) continue;
    const child = children.get(service.name);
    if (!child) continue; // already down → the exit handler owns the restart
    let ageMs = 0;
    try {
      ageMs = now - statSync(service.heartbeat).mtimeMs;
    } catch {
      continue; // no heartbeat yet (just started) — give it time
    }
    if (ageMs > service.maxAgeMs) {
      const sentAt = killSentAt.get(service.name);
      if (sentAt === undefined) {
        console.error(
          `[supervise] ${service.name} heartbeat stale (${Math.round(ageMs / 1000)}s > ${Math.round(
            service.maxAgeMs / 1000
          )}s); SIGTERM`
        );
        killSentAt.set(service.name, now);
        child.kill("SIGTERM");
      } else if (now - sentAt > WATCHDOG_KILL_GRACE_MS) {
        // Still alive + stale after SIGTERM → it's ignoring the signal; force it.
        console.error(`[supervise] ${service.name} ignored SIGTERM; SIGKILL`);
        killSentAt.set(service.name, now); // re-arm the grace in case SIGKILL is slow
        child.kill("SIGKILL");
      }
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(
  `[supervise] bringing up: ${services.map((s) => s.name).join(", ")} (single-instance guarded)`
);
for (const service of services) start(service);
setInterval(checkHeartbeats, 30_000).unref();
