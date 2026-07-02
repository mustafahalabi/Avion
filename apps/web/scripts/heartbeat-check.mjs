// Container liveness probe for the worker/driver heartbeat files (MUS-269).
//
// The worker and driver loops each write an ISO timestamp to a heartbeat file
// once per iteration (see src/worker/heartbeat.ts). This script exits 0 when
// the file exists and its mtime is fresher than the allowed age, 1 otherwise —
// exactly what a Docker HEALTHCHECK needs.
//
// Usage:
//   node scripts/heartbeat-check.mjs [file] [maxAgeSeconds]
//
// Env (fallbacks for the positional args):
//   HEARTBEAT_FILE             — heartbeat file to check
//   HEARTBEAT_MAX_AGE_SECONDS  — freshness window (default 300)
//
// Choose the freshness window per process: the driver beats every tick
// (DRIVER_TICK_INTERVAL_MS, default 15s), but ONE worker iteration can
// legitimately last a whole agent session (WORKER_SESSION_TIMEOUT_SECONDS,
// default 1800s, plus install/validation time) — so the worker's window must
// exceed that, e.g. 3600s. See docs/DEPLOYMENT.md.

import { statSync } from "node:fs";

const file = process.argv[2] ?? process.env.HEARTBEAT_FILE;
const maxAgeSeconds = Number(
  process.argv[3] ?? process.env.HEARTBEAT_MAX_AGE_SECONDS ?? 300
);

if (!file) {
  console.error(
    "heartbeat-check: no heartbeat file given (arg 1 or HEARTBEAT_FILE)."
  );
  process.exit(1);
}

if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
  console.error(
    `heartbeat-check: invalid max age "${process.argv[3] ?? process.env.HEARTBEAT_MAX_AGE_SECONDS}".`
  );
  process.exit(1);
}

try {
  const ageSeconds = (Date.now() - statSync(file).mtimeMs) / 1000;
  if (ageSeconds > maxAgeSeconds) {
    console.error(
      `heartbeat-check: ${file} is stale (${Math.round(ageSeconds)}s old > ${maxAgeSeconds}s allowed).`
    );
    process.exit(1);
  }
  console.log(
    `heartbeat-check: ${file} is fresh (${Math.round(ageSeconds)}s old <= ${maxAgeSeconds}s allowed).`
  );
  process.exit(0);
} catch {
  console.error(`heartbeat-check: cannot stat ${file} (missing?).`);
  process.exit(1);
}
