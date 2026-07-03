import { isPreviewEnabled } from "./preview-config";
import { validateConfig } from "./worker-config";
import { workerLogger } from "./worker-logger";
import { startPreviewEngine } from "@/lib/preview/preview-engine";

/**
 * Optional standalone host for the live-preview engine (`pnpm preview`).
 *
 * The engine runs IN-PROCESS with the app by default (see `instrumentation.ts`),
 * so this command is NOT required — it exists only for running the engine as a
 * dedicated, isolated process (e.g. to keep dev servers off the web process).
 *
 * LOCAL / SELF-HOSTED: it clones and runs users' repo code on this host. Turn it
 * off anywhere multi-tenant with `PREVIEW_DISABLED=true`.
 */
async function main(): Promise<void> {
  validateConfig();

  if (!isPreviewEnabled()) {
    workerLogger.warn("Preview is disabled (PREVIEW_DISABLED=true). Exiting.");
    process.exit(0);
  }

  workerLogger.info("Preview engine started (standalone process).");
  const engine = await startPreviewEngine({ installSignalHandlers: true });
  await engine.done;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  workerLogger.error(`Preview service crashed: ${message}`);
  process.exit(1);
});
