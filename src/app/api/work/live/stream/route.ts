/**
 * Server-Sent Events stream for the Live board (`/work/live`).
 *
 * The board's data is mutated out-of-process by the execution worker (polls
 * every ~5s) and the driver (ticks every ~15s) writing to the database — there
 * is no pub/sub to subscribe to. So this route does the canonical thing: it
 * change-detects with a tight server-side poll and *pushes* the new pipeline to
 * connected clients the moment it differs, with periodic heartbeats to keep the
 * connection alive. Clients render in place from the push instead of doing a
 * full-page refresh, so work visibly moves across the board in near real time.
 *
 * Auth: Clerk middleware (`src/proxy.ts`) protects `/api/*`, and `getCurrentUser`
 * resolves the signed-in CEO; the stream is scoped to that CEO's company.
 *
 * Resilience: a transient DB error is logged and retried with exponential
 * backoff; after a run of consecutive failures the stream emits a `fatal` event
 * and closes, so the client reconnects cleanly (re-authenticating and
 * re-resolving the company on the fresh request) rather than silently freezing.
 *
 * Node runtime + dynamic: Prisma needs Node, and the stream must never be
 * statically cached.
 */

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { loadLivePipeline } from "@/lib/live-pipeline-data";
import { serializeLivePipeline } from "@/lib/live-pipeline-serialization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-side change-detection cadence — far tighter than the old 5s page refresh. */
const POLL_INTERVAL_MS = Number(process.env.LIVE_STREAM_INTERVAL_MS ?? 2500);
/** Cap on the backoff applied after consecutive load failures. */
const MAX_INTERVAL_MS = 30_000;
/** After this many consecutive failures, give up and let the client reconnect. */
const MAX_CONSECUTIVE_FAILURES = 5;
/** Send a comment heartbeat at least this often so idle connections stay open. */
const HEARTBEAT_INTERVAL_MS = 15_000;

/** Parses a positive-integer query param, clamped to a safe range. */
function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) {
    return new Response("No company", { status: 404 });
  }
  const companyId = company.id;

  // Let callers (e.g. the compact Control Center widget) request a smaller slice
  // so the SSR seed and the streamed payload stay in lock-step. Clamped so a
  // crafted URL can't ask for an unbounded board.
  const params = new URL(request.url).searchParams;
  const streamLimit = clampInt(params.get("streamLimit"), 24, 0, 100);
  const doneLimit = clampInt(params.get("doneLimit"), 8, 0, 50);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      // Last serialization sent — the change signal. "" guarantees a first push.
      let lastSent = "";
      let lastBeatAt = Date.now();
      let failures = 0;
      let interval = POLL_INTERVAL_MS;

      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      };

      const enqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Consumer disconnected between the closed-check and enqueue — that's
          // expected (tab closed / navigated away), not an error worth logging.
          cleanup();
        }
      };

      // One change-detection tick: load the board, push only if it changed,
      // otherwise heartbeat if we've been quiet too long. Re-arms itself with a
      // recursive timeout (never setInterval) so ticks can never overlap.
      const tick = async (): Promise<void> => {
        if (closed) return;
        try {
          const pipeline = await loadLivePipeline(companyId, {
            streamLimit,
            doneLimit,
          });
          const json = serializeLivePipeline(pipeline);
          const now = Date.now();
          if (json !== lastSent) {
            lastSent = json;
            lastBeatAt = now;
            enqueue(`data: ${json}\n\n`);
          } else if (now - lastBeatAt >= HEARTBEAT_INTERVAL_MS) {
            lastBeatAt = now;
            enqueue(`: ping\n\n`);
          }
          // Recovered — reset the failure backoff.
          failures = 0;
          interval = POLL_INTERVAL_MS;
        } catch (error) {
          failures += 1;
          console.error(
            `[live-sse] pipeline load failed for company ${companyId} (attempt ${failures})`,
            error
          );
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            // Don't freeze behind a "Live" badge — tell the client and bow out
            // so it reconnects on a fresh, fully re-authenticated request.
            enqueue(`event: fatal\ndata: ${JSON.stringify({ reason: "pipeline_unavailable" })}\n\n`);
            cleanup();
            return;
          }
          // Back off so a struggling DB isn't hammered every 2.5s per client.
          interval = Math.min(interval * 2, MAX_INTERVAL_MS);
        }
        if (!closed) {
          timer = setTimeout(() => {
            void tick();
          }, interval);
        }
      };

      // Stop as soon as the client disconnects or navigates away.
      request.signal.addEventListener("abort", cleanup);
      if (request.signal.aborted) {
        cleanup();
        return;
      }

      // Push the initial snapshot immediately, then poll for changes.
      void tick();
    },
    cancel() {
      // The consumer cancelled; abort fires too, but be defensive.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx/Vercel) so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
