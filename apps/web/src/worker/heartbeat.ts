/**
 * Process liveness heartbeats for the worker and driver (MUS-269).
 *
 * Neither long-running process listens on a port, so container orchestrators
 * have nothing to probe. The simplest honest liveness signal is a file the
 * loop touches once per iteration: a `HEALTHCHECK` (see
 * `apps/web/scripts/heartbeat-check.mjs`) then asserts the file's freshness.
 *
 * A heartbeat write must NEVER take the loop down — every failure path is
 * swallowed (with a single warning) so a read-only or missing volume degrades
 * the liveness signal, not the worker itself.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { WORKER_CONFIG } from "./worker-config";
import { workerLogger } from "./worker-logger";

/** A liveness heartbeat bound to a single timestamp file. */
export interface Heartbeat {
  /** Resolved path of the heartbeat file this instance writes. */
  readonly filePath: string;
  /**
   * Writes the current timestamp to the heartbeat file.
   *
   * @returns True when the write succeeded, false otherwise. Never throws.
   */
  beat(): boolean;
}

/**
 * Resolves the heartbeat file path for a process.
 *
 * @param processName - Short process name (e.g. "worker", "driver") used for
 *   the default file name.
 * @param envValue - Optional env override (e.g. `WORKER_HEARTBEAT_FILE`);
 *   blank/whitespace values are ignored.
 * @returns The env override when set, otherwise
 *   `<WORKER_REPO_BASE_DIR>/<processName>.heartbeat`.
 */
export function resolveHeartbeatFilePath(
  processName: string,
  envValue?: string | null
): string {
  const trimmed = envValue?.trim();
  if (trimmed) {
    return trimmed;
  }
  return path.join(
    WORKER_CONFIG.WORKER_REPO_BASE_DIR,
    `${processName}.heartbeat`
  );
}

/**
 * Writes an ISO timestamp to the heartbeat file, creating parent directories
 * as needed.
 *
 * @param filePath - Heartbeat file path.
 * @param now - Timestamp to record (defaults to the current time).
 * @returns True on success, false on any filesystem failure. Never throws.
 */
export function writeHeartbeat(filePath: string, now: Date = new Date()): boolean {
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${now.toISOString()}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a heartbeat for a long-running process loop.
 *
 * The returned `beat()` is safe to call every loop iteration: failures are
 * swallowed and logged as a warning exactly once (not once per iteration).
 *
 * @param processName - Short process name (e.g. "worker", "driver").
 * @param envValue - Optional env override for the file path.
 * @returns A {@link Heartbeat} bound to the resolved file path.
 */
export function createHeartbeat(
  processName: string,
  envValue?: string | null
): Heartbeat {
  const filePath = resolveHeartbeatFilePath(processName, envValue);
  let warned = false;

  return {
    filePath,
    beat(): boolean {
      const ok = writeHeartbeat(filePath);
      if (!ok && !warned) {
        warned = true;
        workerLogger.warn(
          `Heartbeat write failed for ${processName} at ${filePath}. ` +
            "Liveness checks may report this process as stale; the loop itself keeps running."
        );
      }
      return ok;
    },
  };
}
