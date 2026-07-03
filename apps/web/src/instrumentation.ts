/**
 * Next.js instrumentation — runs once when the server process boots (dev, `next
 * start`, and standalone). We use it to start the live-preview engine IN-PROCESS,
 * so running the app is all it takes for previews to work — no extra command, no
 * feature flag. This is the zero-config product path for the local / self-hosted
 * model. Set `PREVIEW_DISABLED=true` to turn it off.
 */
export async function register(): Promise<void> {
  // Only the Node.js server runtime can run the engine (it manages child
  // processes + Postgres). Skip the Edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isPreviewEnabled } = await import("@/worker/preview-config");
  if (!isPreviewEnabled()) return;

  // Guard against double-start (Next may evaluate this module more than once).
  const g = globalThis as typeof globalThis & { __avionPreviewEngineStarted?: boolean };
  if (g.__avionPreviewEngineStarted) return;
  g.__avionPreviewEngineStarted = true;

  try {
    const { startPreviewEngine } = await import("@/lib/preview/preview-engine");
    // The app owns SIGINT/SIGTERM; we only add a synchronous exit hook so Ctrl-C
    // tears down running dev servers instead of orphaning them until next boot.
    await startPreviewEngine({ installSignalHandlers: false, killChildrenOnExit: true });
  } catch (error) {
    // Never take the app down because the preview engine failed to start.
    g.__avionPreviewEngineStarted = false;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[preview] engine failed to start in-process: ${message}`);
  }
}
