/**
 * @avion/shared — the contract layer between the frontend (@avion/web) and the
 * backend (@avion/api).
 *
 * Both ends import these types and event-name constants so the realtime board's
 * REST payloads and Socket.IO messages stay in lockstep. Keep this package
 * dependency-free and runtime-light: types plus a couple of `const` maps only.
 */

// ─── Socket.IO wiring ────────────────────────────────────────────────────────

/** Namespace the live board connects to (e.g. `io(`${API_URL}${BOARD_NAMESPACE}`)`). */
export const BOARD_NAMESPACE = "/board" as const;

/** Socket.IO event names — referenced on both the server and client. */
export const BOARD_EVENTS = {
  /** server → client: the full board snapshot (on connect and on each tick). */
  snapshot: "board:snapshot",
  /** server → client: lightweight heartbeat with the server clock + sequence. */
  tick: "board:tick",
  /** client → server: ask for an immediate fresh snapshot. */
  requestSnapshot: "board:request-snapshot",
} as const;

export type BoardEventName = (typeof BOARD_EVENTS)[keyof typeof BOARD_EVENTS];

/** Strongly-typed map of server→client events for socket.io generics. */
export interface BoardServerToClientEvents {
  "board:snapshot": (snapshot: BoardSnapshot) => void;
  "board:tick": (tick: BoardTick) => void;
}

/** Strongly-typed map of client→server events for socket.io generics. */
export interface BoardClientToServerEvents {
  "board:request-snapshot": () => void;
}

// ─── Domain payloads ─────────────────────────────────────────────────────────

/** ExecutionSession.status lifecycle from the Prisma schema. */
export type ExecutionStatus =
  | "queued"
  | "prepared"
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | "needs_clarification";

export const ACTIVE_STATUSES: ExecutionStatus[] = ["queued", "prepared", "running"];

/** A single agent execution session, flattened for the board feed. */
export interface SessionSummary {
  id: string;
  companyId: string;
  companyName: string | null;
  status: ExecutionStatus | string;
  agentType: string;
  taskTitle: string | null;
  prUrl: string | null;
  prNumber: number | null;
  prStatus: string | null;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface StatusCount {
  status: string;
  count: number;
}

/** Headline counters shown across the top of the board. */
export interface BoardMetrics {
  totalSessions: number;
  /** queued + prepared + running */
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  openPullRequests: number;
  tasksInProgress: number;
  unreadNotifications: number;
}

export interface CompanyRef {
  id: string;
  name: string;
}

/** The complete realtime board state. Sent over REST and over the socket. */
export interface BoardSnapshot {
  /** ISO timestamp the snapshot was generated on the server. */
  generatedAt: string;
  metrics: BoardMetrics;
  statusCounts: StatusCount[];
  recentSessions: SessionSummary[];
  companies: CompanyRef[];
}

/** Heartbeat emitted every poll tick so clients can show "live" + latency. */
export interface BoardTick {
  at: string; // ISO-8601
  seq: number;
}

// ─── REST DTOs ───────────────────────────────────────────────────────────────

/** GET /api/health */
export interface HealthResponse {
  status: "ok";
  service: "avion-api";
  uptimeSeconds: number;
  db: "up" | "down";
  time: string;
}

/** GET /api/board/snapshot → BoardSnapshot (re-exported alias for clarity). */
export type BoardSnapshotResponse = BoardSnapshot;

/** GET /api/board/sessions?limit= */
export interface SessionsResponse {
  sessions: SessionSummary[];
}
