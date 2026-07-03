import fs from "node:fs";
import os from "node:os";

import { createHeartbeat } from "@/worker/heartbeat";
import { PREVIEW_CONFIG } from "@/worker/preview-config";
import { workerLogger } from "@/worker/worker-logger";
import {
  claimNextQueuedPreview,
  killProcessGroup,
  reconcileOrphansOnStartup,
} from "@/lib/preview/preview-service-db";
import {
  reconcileActivePreviews,
  shutdownAllPreviews,
  startPreview,
  type PreviewRegistry,
} from "@/lib/preview/preview-runner";

/**
 * The live-preview engine — the poll/claim/reconcile loop that owns running dev
 * servers. Extracted so it can run either in-process with the app (the default,
 * zero-config product path, started from `instrumentation.ts`) or as a dedicated
 * `pnpm preview` process. The engine is the same; only the host differs.
 */

export interface PreviewEngineHandle {
  /** Stops the loop and tears down all running previews. */
  stop: () => Promise<void>;
  /** Resolves when the loop exits (after `stop`). Standalone hosts await this. */
  done: Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Starts the preview engine and returns immediately with a handle. The loop runs
 * in the background (its pending timers keep the process alive for a standalone
 * host). Callers that own the process (the `pnpm preview` service) should install
 * signal handlers and `await handle.done`; in-process hosts should not.
 */
export async function startPreviewEngine(opts?: {
  /** Install SIGINT/SIGTERM handlers that stop the engine and exit (standalone only). */
  installSignalHandlers?: boolean;
  /**
   * Register a synchronous `exit` hook that SIGKILLs running dev servers when the
   * host process dies. Use in-process (the app owns SIGINT/SIGTERM) so Ctrl-C
   * doesn't leave an orphaned dev server until the next boot's reconcile.
   */
  killChildrenOnExit?: boolean;
}): Promise<PreviewEngineHandle> {
  const registry: PreviewRegistry = new Map();
  const host = `${os.hostname()}:${process.pid}`;
  let shuttingDown = false;
  // Previews claimed but not yet registered (mid-startPreview) — count to the cap.
  let startingCount = 0;

  const stop = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    workerLogger.info("Preview engine stopping; tearing down running previews...");
    await shutdownAllPreviews(registry);
  };

  if (opts?.installSignalHandlers) {
    process.on("SIGINT", () => void stop().then(() => process.exit(0)));
    process.on("SIGTERM", () => void stop().then(() => process.exit(0)));
  }

  if (opts?.killChildrenOnExit) {
    // `exit` handlers must be synchronous — process-group SIGKILL is. This runs
    // on normal shutdown paths (incl. after the app's own SIGINT handling).
    process.on("exit", () => {
      for (const active of registry.values()) {
        if (active.child.pid) killProcessGroup(active.child.pid, "SIGKILL");
      }
    });
  }

  // Crash recovery: reconcile previews orphaned by a previous run, then clear
  // any stale checkout dirs before starting fresh.
  const reaped = await reconcileOrphansOnStartup();
  if (reaped > 0) {
    workerLogger.info(`Reconciled ${reaped} orphaned preview(s) from a previous run.`);
  }
  try {
    fs.rmSync(PREVIEW_CONFIG.PREVIEW_BASE_DIR, { recursive: true, force: true });
  } catch {
    // best-effort — a stale checkout dir is not fatal.
  }

  const heartbeat = createHeartbeat("preview", process.env.PREVIEW_HEARTBEAT_FILE);

  const done = (async () => {
    while (!shuttingDown) {
      heartbeat.beat();

      try {
        await reconcileActivePreviews(registry);
      } catch (error) {
        workerLogger.error(`Preview reconcile failed: ${msg(error)}`);
      }

      const capacity = registry.size + startingCount;
      if (capacity < PREVIEW_CONFIG.PREVIEW_MAX_CONCURRENT) {
        try {
          const claimed = await claimNextQueuedPreview({
            host,
            maxLifetimeSeconds: PREVIEW_CONFIG.PREVIEW_MAX_LIFETIME_SECONDS,
          });
          if (claimed) {
            workerLogger.info(`Claimed preview ${claimed.id}; starting...`);
            startingCount++;
            void startPreview({ session: claimed, registry }).finally(() => {
              startingCount--;
            });
          }
        } catch (error) {
          workerLogger.error(`Preview claim/start failed: ${msg(error)}`);
        }
      }

      await sleep(PREVIEW_CONFIG.PREVIEW_POLL_INTERVAL_MS);
    }
  })();

  return { stop, done };
}
