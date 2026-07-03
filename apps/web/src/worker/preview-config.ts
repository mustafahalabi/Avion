/** Live-preview service configuration loaded from environment variables. */
export interface PreviewConfig {
  readonly PREVIEW_POLL_INTERVAL_MS: number;
  /** Parent directory for preview checkouts (each session gets a subdir). */
  readonly PREVIEW_BASE_DIR: string;
  readonly PREVIEW_PORT_RANGE_START: number;
  readonly PREVIEW_PORT_RANGE_END: number;
  /** Max simultaneously-running previews on this host. */
  readonly PREVIEW_MAX_CONCURRENT: number;
  readonly PREVIEW_INSTALL_TIMEOUT_SECONDS: number;
  /** A preview is auto-stopped after this many seconds (resource safety). */
  readonly PREVIEW_MAX_LIFETIME_SECONDS: number;
  /** Grace period between SIGTERM and SIGKILL when stopping a dev server. */
  readonly PREVIEW_STOP_GRACE_MS: number;
  /** Loopback host the dev server binds to. */
  readonly PREVIEW_HOST: string;
  /** Cap on stored log characters (keep the tail). */
  readonly PREVIEW_LOG_MAX_CHARS: number;
}

/** Preview configuration with defaults for local development. */
export const PREVIEW_CONFIG: PreviewConfig = {
  PREVIEW_POLL_INTERVAL_MS: Number(process.env.PREVIEW_POLL_INTERVAL_MS ?? 2000),
  PREVIEW_BASE_DIR: process.env.PREVIEW_BASE_DIR ?? "/tmp/eos-preview",
  PREVIEW_PORT_RANGE_START: Number(process.env.PREVIEW_PORT_RANGE_START ?? 4100),
  PREVIEW_PORT_RANGE_END: Number(process.env.PREVIEW_PORT_RANGE_END ?? 4199),
  PREVIEW_MAX_CONCURRENT: Number(process.env.PREVIEW_MAX_CONCURRENT ?? 1),
  PREVIEW_INSTALL_TIMEOUT_SECONDS: Number(
    process.env.PREVIEW_INSTALL_TIMEOUT_SECONDS ?? 600
  ),
  PREVIEW_MAX_LIFETIME_SECONDS: Number(
    process.env.PREVIEW_MAX_LIFETIME_SECONDS ?? 3600
  ),
  PREVIEW_STOP_GRACE_MS: Number(process.env.PREVIEW_STOP_GRACE_MS ?? 5000),
  PREVIEW_HOST: process.env.PREVIEW_HOST ?? "127.0.0.1",
  PREVIEW_LOG_MAX_CHARS: Number(process.env.PREVIEW_LOG_MAX_CHARS ?? 200_000),
};

/**
 * Whether live preview is available. It's a built-in product capability, so it's
 * ON by default and runs in-process with the app — no flag or extra command to
 * start it. Set `PREVIEW_DISABLED=true` to turn it off (e.g. if you host Avion on
 * a shared/multi-tenant server where running users' repo code is undesirable).
 */
export function isPreviewEnabled(): boolean {
  return process.env.PREVIEW_DISABLED !== "true";
}
