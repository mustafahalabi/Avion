/**
 * Shared contract for live agent-output streaming.
 *
 * This is the *additive* channel that lets a running execution session surface
 * what the agent is doing in near real time, without touching the existing
 * poll-snapshot board infra or the stdout parsers. It is deliberately
 * dependency-free (no Prisma, no Node APIs) so it can be imported from both the
 * worker (server) and the chat UI (client).
 *
 * Altitude: events carry the raw agent line in `detail` and a short one-line
 * `label`; the UI decides how much to show — a humanized feed by default
 * (see `humanize.ts`) or the raw line behind an opt-in "watch the agent" drawer.
 */

/** Semantic category of a single streamed agent activity event. */
export type AgentStreamEventType =
  | "status" // lifecycle marker: agent started / finished
  | "text" // agent natural-language output line
  | "tool" // an action the agent took (edit/read/run) — best-effort detected
  | "result" // final result / summary line
  | "stderr" // stderr line
  | "raw"; // uncategorized raw stdout line

/** A single event as emitted by an adapter, before a seq number is assigned. */
export interface AgentStreamEventInput {
  type: AgentStreamEventType;
  /** Short one-line content (trimmed by the emitter; truncated by the store). */
  label: string;
  /** Optional longer detail (the full raw line / command / text). */
  detail?: string | null;
  /** Milliseconds since the agent run started, for a relative "elapsed" display. */
  atMs: number;
}

/** A stored event with its assigned monotonic per-session sequence number. */
export interface AgentStreamEvent extends AgentStreamEventInput {
  /** 1-based, strictly increasing within a session. The SSE cursor. */
  seq: number;
}

/**
 * Callback an adapter calls for each observed line/lifecycle event.
 * Passed in via `ExecutionContext.onStream`. Must never throw into the adapter.
 */
export type AgentStreamHandler = (event: AgentStreamEventInput) => void;

/** Max characters persisted for `label` — keeps rows small. */
export const AGENT_STREAM_LABEL_MAX = 500;
/** Max characters persisted for `detail` — bounds a pathological single line. */
export const AGENT_STREAM_DETAIL_MAX = 4000;
/**
 * Hard cap on events persisted per session. A runaway agent that prints
 * megabytes of output can't grow the table without bound; the worker stops
 * appending past this and records a single truncation marker.
 */
export const AGENT_STREAM_MAX_EVENTS_PER_SESSION = Number(
  process.env.AGENT_STREAM_MAX_EVENTS ?? 5000
);

/**
 * SSE payload emitted by the session-stream endpoint on each push.
 *
 * The client tracks the max `seq` it has seen and reconnects/paginates from
 * there; `done` tells it the session is terminal so it can stop listening.
 */
export interface SessionStreamPayload {
  /** New events since the client's last seq, ascending by seq. */
  events: AgentStreamEvent[];
  /** Current session status (queued|prepared|running|completed|failed|...). */
  status: string;
  /** True once the session is terminal and no further events will arrive. */
  done: boolean;
}

/** Session statuses that are terminal — no further stream events will arrive. */
export const TERMINAL_SESSION_STATUSES: readonly string[] = [
  "completed",
  "failed",
  "canceled",
];

/** Whether a session status is terminal (streaming should stop). */
export function isTerminalSessionStatus(status: string): boolean {
  return TERMINAL_SESSION_STATUSES.includes(status);
}
