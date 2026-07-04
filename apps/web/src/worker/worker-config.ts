/** Worker runtime configuration loaded from environment variables. */
export interface WorkerConfig {
  readonly WORKER_POLL_INTERVAL_MS: number;
  readonly WORKER_REPO_BASE_DIR: string;
  readonly WORKER_SESSION_TIMEOUT_SECONDS: number;
  readonly WORKER_PERMISSION_MODE_OVERRIDE: string | null;
  /**
   * Retries permitted after a task's first failed session. Enforced by the
   * driver's enqueue path (`assessTaskRetryState` in auto-execution-service).
   */
  readonly WORKER_MAX_RETRIES: number;
  /** Wall-clock bound for installing dependencies in a checkout before validation. */
  readonly WORKER_INSTALL_TIMEOUT_SECONDS: number;
  /** Interval between driver ticks (the scheduler that enqueues/advances work). */
  readonly DRIVER_TICK_INTERVAL_MS: number;
  /**
   * Max sessions one worker runs concurrently (Goal 5a — parallel execution).
   * Default 1 (single-threaded, unchanged). Raise to run a pool. Each session
   * still gets its own live feed. STRONGLY prefer `WORKER_SANDBOX=docker` when
   * >1 — parallel full-permission agents on the host would be catastrophic.
   */
  readonly WORKER_CONCURRENCY: number;
  /**
   * Opt back into running the agent at `full` (bypassPermissions) on an
   * UN-SANDBOXED host. Off by default: without a sandbox, `full` is capped to
   * `execute` for host safety (see worker-effective-permission.ts). Only set
   * this when you accept arbitrary host shell access from the agent.
   */
  readonly WORKER_ALLOW_UNSANDBOXED_FULL: boolean;
}

/**
 * Worker configuration with defaults for local development.
 */
export const WORKER_CONFIG: WorkerConfig = {
  WORKER_POLL_INTERVAL_MS: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000),
  WORKER_REPO_BASE_DIR: process.env.WORKER_REPO_BASE_DIR ?? "/tmp/eos-worker",
  WORKER_SESSION_TIMEOUT_SECONDS: Number(
    process.env.WORKER_SESSION_TIMEOUT_SECONDS ?? 1800
  ),
  WORKER_PERMISSION_MODE_OVERRIDE: process.env.WORKER_PERMISSION_MODE ?? null,
  WORKER_MAX_RETRIES: Number(process.env.WORKER_MAX_RETRIES ?? 1),
  WORKER_INSTALL_TIMEOUT_SECONDS: Number(
    process.env.WORKER_INSTALL_TIMEOUT_SECONDS ?? 600
  ),
  DRIVER_TICK_INTERVAL_MS: Number(process.env.DRIVER_TICK_INTERVAL_MS ?? 15000),
  WORKER_ALLOW_UNSANDBOXED_FULL: ["1", "true", "yes", "on"].includes(
    (process.env.WORKER_ALLOW_UNSANDBOXED_FULL ?? "").trim().toLowerCase()
  ),
  WORKER_CONCURRENCY: Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 1) || 1),
};

/**
 * Validates required worker environment variables.
 *
 * @throws Error when DATABASE_URL is missing.
 */
export function validateConfig(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set for the worker to connect to the PostgreSQL database."
    );
  }
}
