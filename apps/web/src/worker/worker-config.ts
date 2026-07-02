/** Worker runtime configuration loaded from environment variables. */
export interface WorkerConfig {
  readonly WORKER_POLL_INTERVAL_MS: number;
  readonly WORKER_REPO_BASE_DIR: string;
  readonly WORKER_SESSION_TIMEOUT_SECONDS: number;
  readonly WORKER_PERMISSION_MODE_OVERRIDE: string | null;
  readonly WORKER_MAX_RETRIES: number;
  /** Interval between driver ticks (the scheduler that enqueues/advances work). */
  readonly DRIVER_TICK_INTERVAL_MS: number;
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
  DRIVER_TICK_INTERVAL_MS: Number(process.env.DRIVER_TICK_INTERVAL_MS ?? 15000),
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
