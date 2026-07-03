/**
 * Batching sink that persists live agent-output events as a session runs.
 *
 * The worker passes {@link SessionLogStreamer.handler} to the adapter as
 * `ExecutionContext.onStream`; the adapter calls it synchronously for every
 * lifecycle marker and stdout/stderr line it observes. This streamer assigns a
 * monotonic per-session `seq`, buffers events in memory, and flushes them to the
 * `SessionLogChunk` store on a timer.
 *
 * Streaming is **best-effort by contract**: the handler is synchronous and never
 * throws into the adapter, and no DB failure ever escapes — a rejected flush is
 * logged and its batch dropped. Nothing here can slow down, block, or fail the
 * actual execution; the returned result is derived from the run, not the stream.
 */

import { appendSessionLogEvents } from "@/lib/agent-stream/session-log-store";
import {
  AGENT_STREAM_MAX_EVENTS_PER_SESSION,
  type AgentStreamEvent,
  type AgentStreamEventInput,
  type AgentStreamHandler,
} from "@/lib/agent-stream/types";

import { workerLogger } from "./worker-logger";

/** Default cadence for draining the in-memory buffer to the store. */
const DEFAULT_FLUSH_INTERVAL_MS = 750;

/** Configuration for a single session's streamer. */
export interface SessionLogStreamerParams {
  /** Owning ExecutionSession id. */
  sessionId: string;
  /** Denormalized company id (stored on each chunk for scoped reads). */
  companyId: string;
  /** Buffer drain cadence in ms; defaults to {@link DEFAULT_FLUSH_INTERVAL_MS}. */
  flushIntervalMs?: number;
}

/** A live-output sink bound to one execution session. */
export interface SessionLogStreamer {
  /**
   * Pass this as `ExecutionContext.onStream`. Synchronous and never throws —
   * it assigns a seq and buffers the event; persistence happens out of band.
   */
  handler: AgentStreamHandler;
  /** Flush buffered events now (best-effort; never throws). */
  flush(): Promise<void>;
  /**
   * Flush remaining events and stop the timer. Call once when the run ends.
   * Never throws, so it is safe to `await` in a `finally` block.
   */
  stop(): Promise<void>;
}

/**
 * Creates a batching streamer for one session.
 *
 * The returned `handler` is safe to call on the adapter's hot path: it assigns a
 * monotonic `seq` (1-based) and pushes into an in-memory buffer. A `setInterval`
 * drains the buffer to {@link appendSessionLogEvents}; overlapping flushes are
 * coalesced onto a single in-flight promise, and any DB failure drops that batch
 * (logged, never rethrown). Once {@link AGENT_STREAM_MAX_EVENTS_PER_SESSION}
 * real events have been accepted, the handler emits one synthetic truncation
 * marker and then ignores further events, bounding the table for a runaway run.
 *
 * @param params - Session/company ids and optional flush cadence.
 * @returns A {@link SessionLogStreamer} the worker wires into `adapter.run`.
 */
export function createSessionLogStreamer(
  params: SessionLogStreamerParams
): SessionLogStreamer {
  const { sessionId, companyId } = params;
  const flushIntervalMs = params.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;

  let seq = 0;
  let acceptedRealEvents = 0;
  let truncated = false;
  let buffer: AgentStreamEvent[] = [];
  let inFlight: Promise<void> | null = null;

  /** Assigns the next monotonic seq and buffers the event. */
  function push(input: AgentStreamEventInput): void {
    seq += 1;
    buffer.push({ ...input, seq });
  }

  const handler: AgentStreamHandler = (event) => {
    try {
      if (truncated) return;
      if (acceptedRealEvents >= AGENT_STREAM_MAX_EVENTS_PER_SESSION) {
        // Cap reached: record ONE visible marker, then ignore everything after.
        truncated = true;
        push({
          type: "status",
          label: `Output truncated after ${AGENT_STREAM_MAX_EVENTS_PER_SESSION} events`,
          detail: null,
          atMs: event.atMs,
        });
        return;
      }
      acceptedRealEvents += 1;
      push(event);
    } catch {
      // Best-effort: streaming must never throw into the adapter's hot path.
    }
  };

  /**
   * Drains the current buffer to the store once. Overlapping calls coalesce
   * onto the in-flight promise (the "no overlapping flush" guard); a rejected
   * write drops that batch and never escapes.
   */
  function flush(): Promise<void> {
    if (inFlight) return inFlight;
    if (buffer.length === 0) return Promise.resolve();
    const batch = buffer;
    buffer = [];
    inFlight = appendSessionLogEvents(sessionId, companyId, batch)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        workerLogger.error(
          `Agent-stream flush dropped ${batch.length} event(s) for session ${sessionId}: ${message}`
        );
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  const timer: ReturnType<typeof setInterval> = setInterval(() => {
    void flush();
  }, flushIntervalMs);

  return {
    handler,
    flush,
    async stop(): Promise<void> {
      clearInterval(timer);
      // Two passes drain deterministically: the first awaits any in-flight
      // batch (and coalesces onto it), the second persists whatever the buffer
      // still holds. Both are non-throwing.
      await flush();
      await flush();
    },
  };
}
