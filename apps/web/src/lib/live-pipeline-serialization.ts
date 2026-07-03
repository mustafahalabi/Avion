/**
 * Wire (de)serialization for the Live pipeline.
 *
 * The Live board is streamed to the browser over Server-Sent Events as JSON.
 * {@link LivePipeline} contains `Date` instances (`updatedAt`, `createdAt`)
 * which `JSON.stringify` renders as ISO strings; this module turns the payload
 * into a stable wire string on the server and revives the `Date`s on the client
 * so the pure board components keep their exact `Date`-typed props.
 *
 * It is intentionally **pure** (no I/O): the SSE route serializes, the client
 * hook parses, and both stay in lock-step. Because the serialized string is
 * fully deterministic for a given pipeline, the route can also use it directly
 * as a change signal — re-sending only when the bytes differ.
 */

import type {
  LiveNotification,
  LiveNotificationsPayload,
  LivePipeline,
} from "./live-pipeline-data";
import type {
  LifecycleBoard,
  LifecycleColumn,
  WorkItemView,
} from "./work-lifecycle";
import type { TimelineItem } from "@/components/timeline-entry";

// ─── Wire shapes — identical to the runtime shapes but with ISO-string dates ───

type WireWorkItemView = Omit<
  WorkItemView,
  "updatedAt" | "startedAt" | "completedAt"
> & {
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};
type WireLifecycleColumn = Omit<LifecycleColumn, "items"> & {
  readonly items: readonly WireWorkItemView[];
};
type WireLifecycleBoard = Omit<LifecycleBoard, "columns"> & {
  readonly columns: readonly WireLifecycleColumn[];
};
type WireTimelineItem = Omit<TimelineItem, "createdAt"> & {
  readonly createdAt: string;
};
type WireLiveNotification = Omit<LiveNotification, "createdAt"> & {
  readonly createdAt: string;
};

/** The JSON-safe form of {@link LiveNotificationsPayload} sent over the wire. */
export interface WireLiveNotificationsPayload {
  readonly notifications: readonly WireLiveNotification[];
  readonly unreadNotificationCount: number;
}

/** The JSON-safe form of {@link LivePipeline} sent over the wire. */
export interface WireLivePipeline extends WireLiveNotificationsPayload {
  readonly board: WireLifecycleBoard;
  readonly stream: readonly WireTimelineItem[];
}

// ─── Serialize ─────────────────────────────────────────────────────────────────

/**
 * Serializes a {@link LivePipeline} to its deterministic wire string.
 *
 * `JSON.stringify` renders the `Date` fields as ISO strings (via `Date.toJSON`)
 * and preserves key/array order, so the result is stable for identical data —
 * which lets the SSE route compare two serializations to detect change.
 *
 * @param pipeline - The loaded live pipeline.
 * @returns A JSON string ready to put on an SSE `data:` line.
 */
export function serializeLivePipeline(pipeline: LivePipeline): string {
  return JSON.stringify(pipeline);
}

// ─── Parse / revive ──────────────────────────────────────────────────────────

function reviveWorkItem(item: WireWorkItemView): WorkItemView {
  return {
    ...item,
    updatedAt: new Date(item.updatedAt),
    startedAt: item.startedAt ? new Date(item.startedAt) : null,
    completedAt: item.completedAt ? new Date(item.completedAt) : null,
  };
}

function reviveColumn(column: WireLifecycleColumn): LifecycleColumn {
  return { ...column, items: column.items.map(reviveWorkItem) };
}

function reviveBoard(board: WireLifecycleBoard): LifecycleBoard {
  return { ...board, columns: board.columns.map(reviveColumn) };
}

function reviveTimelineItem(event: WireTimelineItem): TimelineItem {
  return { ...event, createdAt: new Date(event.createdAt) };
}

function reviveNotification(n: WireLiveNotification): LiveNotification {
  return { ...n, createdAt: new Date(n.createdAt) };
}

function reviveNotifications(
  wire: Partial<WireLiveNotificationsPayload> | null | undefined
): LiveNotificationsPayload {
  // Defensive: a board-only frame (or an older serialization) may omit these.
  return {
    notifications: (wire?.notifications ?? []).map(reviveNotification),
    unreadNotificationCount: wire?.unreadNotificationCount ?? 0,
  };
}

/**
 * Parses a wire string back into a fully-typed {@link LivePipeline}, reviving
 * the ISO-string dates into `Date` instances so the board components receive
 * exactly the props they expect.
 *
 * @param raw - The JSON string from an SSE `data:` line.
 * @returns The revived live pipeline.
 */
export function parseLivePipeline(raw: string): LivePipeline {
  const wire = JSON.parse(raw) as WireLivePipeline;
  return {
    board: reviveBoard(wire.board),
    stream: wire.stream.map(reviveTimelineItem),
    ...reviveNotifications(wire),
  };
}

// ─── Notifications-only channel ──────────────────────────────────────────────

/**
 * Serializes just the unread-notifications slice — the payload the app-wide
 * "needs-you" SSE channel (`?only=notifications`) streams, so it never drags the
 * whole board. Deterministic, so the route can diff it as a change signal.
 */
export function serializeLiveNotifications(
  payload: LiveNotificationsPayload
): string {
  return JSON.stringify(payload);
}

/**
 * Parses the notifications-only wire string, reviving `createdAt` into a `Date`.
 * Tolerant of missing fields so a malformed frame degrades to "nothing unread"
 * rather than throwing.
 */
export function parseLiveNotifications(raw: string): LiveNotificationsPayload {
  const wire = JSON.parse(raw) as Partial<WireLiveNotificationsPayload>;
  return reviveNotifications(wire);
}
