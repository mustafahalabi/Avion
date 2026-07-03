/**
 * Server-Sent Events stream for a single execution session's live agent output.
 *
 * The worker appends `SessionLogChunk` rows as the agent CLI produces lines
 * (out-of-process, no pub/sub) — so, exactly like the `/work/live` board stream,
 * this route change-detects with a tight server-side poll and *pushes* new
 * events to the connected chat/watch UI the moment they land, with heartbeats to
 * keep the connection alive. The client tracks the max `seq` it has seen and
 * renders a humanized feed (see `humanize.ts`) or the raw drawer from `detail`.
 *
 * The poll here is tighter than the board's (default 1s) because live agent
 * output should feel immediate.
 *
 * Auth + scope: Clerk middleware (`src/proxy.ts`) protects `/api/*`,
 * `getCurrentUser` resolves the signed-in CEO, and the stream is scoped to that
 * CEO's company — a session belonging to another company is refused with a plain
 * 403 (we never stream cross-tenant output).
 *
 * Stop condition: each tick tails events after a `seq` cursor and, when the
 * stream goes quiet, re-checks the session status. Once the session is terminal
 * *and* fully drained, a final `done:true` payload is sent and the stream closes.
 *
 * Resilience: a transient DB error is logged and retried with exponential
 * backoff; after a run of consecutive failures the stream emits a `fatal` event
 * and closes, so the client reconnects cleanly (re-authenticating and
 * re-scoping on the fresh request) rather than silently freezing.
 *
 * Node runtime + dynamic: Prisma needs Node, and the stream must never be
 * statically cached.
 */

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import {
  getSessionStreamMeta,
  readSessionLogEvents,
} from "@/lib/agent-stream/session-log-store";
import {
  isTerminalSessionStatus,
  type SessionStreamPayload,
} from "@/lib/agent-stream/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-side tail cadence — tight so live agent output feels immediate. */
const POLL_INTERVAL_MS = Number(process.env.SESSION_STREAM_INTERVAL_MS ?? 1000);
/** Cap on the backoff applied after consecutive read failures. */
const MAX_INTERVAL_MS = 30_000;
/** After this many consecutive failures, give up and let the client reconnect. */
const MAX_CONSECUTIVE_FAILURES = 5;
/** Send a comment heartbeat at least this often so idle connections stay open. */
const HEARTBEAT_INTERVAL_MS = 15_000;
/** Max events pulled per tick — pages through a large backlog in order. */
const READ_PAGE_SIZE = 200;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId } = await params;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) {
    return new Response("No company", { status: 404 });
  }

  const meta = await getSessionStreamMeta(sessionId);
  if (!meta) {
    return new Response("Not found", { status: 404 });
  }
  // Company scope: refuse another tenant's session with a plain status — never
  // leak whether/what the session is beyond "you can't watch this".
  if (meta.companyId !== company.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      // The SSE cursor: highest `seq` already sent to the client. 0 = from start.
      let lastSeq = 0;
      // Last status pushed — the change signal. "" guarantees a first payload.
      let lastEmittedStatus = "";
      // Current known status; seeded from the scope check, refreshed when quiet.
      let currentStatus = meta.status;
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

      // One tail tick: pull events after the cursor, refresh status when the
      // stream is quiet, push on any change, and close once terminal + drained.
      // Re-arms itself with a recursive timeout (never setInterval) so ticks can
      // never overlap.
      const tick = async (): Promise<void> => {
        if (closed) return;
        try {
          const events = await readSessionLogEvents(
            sessionId,
            lastSeq,
            READ_PAGE_SIZE
          );
          if (events.length > 0) {
            // Events are ascending by seq, so the last one is the new max.
            lastSeq = events[events.length - 1].seq;
            // Output is still flowing — the session is by definition not
            // drained, so skip the extra status read and reuse the last known.
          } else {
            // Quiet tick: this is the only moment `done` can flip, so re-check
            // the session status to detect the terminal transition.
            const fresh = await getSessionStreamMeta(sessionId);
            if (fresh) currentStatus = fresh.status;
          }

          const done =
            isTerminalSessionStatus(currentStatus) && events.length === 0;
          const statusChanged = currentStatus !== lastEmittedStatus;
          const now = Date.now();

          if (events.length > 0 || statusChanged || done) {
            const payload: SessionStreamPayload = {
              events,
              status: currentStatus,
              done,
            };
            lastEmittedStatus = currentStatus;
            lastBeatAt = now;
            enqueue(`data: ${JSON.stringify(payload)}\n\n`);
            if (done) {
              // Terminal and fully drained — the client stops listening on this.
              cleanup();
              return;
            }
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
            `[session-sse] tail failed for session ${sessionId} (attempt ${failures})`,
            error
          );
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            // Don't freeze behind a "Live" badge — tell the client and bow out
            // so it reconnects on a fresh, fully re-authenticated request.
            enqueue(
              `event: fatal\ndata: ${JSON.stringify({ reason: "stream_unavailable" })}\n\n`
            );
            cleanup();
            return;
          }
          // Back off so a struggling DB isn't hammered every second per client.
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

      // Push the initial snapshot immediately, then tail for new events.
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
