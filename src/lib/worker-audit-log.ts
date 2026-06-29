import { randomUUID } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * All event types that can be recorded in a worker audit log.
 *
 * - session_*     — lifecycle transitions for an execution session
 * - file_*        — filesystem operations performed by the agent
 * - command_*     — shell commands executed or blocked by guardrails
 * - permission_check — a permission gate was evaluated (may or may not pass)
 * - guardrail_triggered — a guardrail rule fired and blocked an action
 * - branch_created — the agent created a git branch
 * - pr_opened      — the agent opened a pull request
 * - validation_run — tsc / lint / test commands were executed
 */
export type AuditEventType =
  | "session_started"
  | "session_completed"
  | "session_failed"
  | "file_read"
  | "file_written"
  | "file_deleted"
  | "command_executed"
  | "command_blocked"
  | "permission_check"
  | "guardrail_triggered"
  | "branch_created"
  | "pr_opened"
  | "validation_run";

/**
 * Severity of an audit event.
 *
 * - info  — normal operation (reads, successful writes, session lifecycle)
 * - warn  — noteworthy but non-fatal (permission check passed with caveats)
 * - error — something failed or was blocked (command blocked, session failed)
 */
export type AuditSeverity = "info" | "warn" | "error";

/**
 * A single immutable event captured by the audit log.
 */
export interface AuditEvent {
  /** Globally unique event ID. */
  readonly id: string;
  /** ID of the ExecutionSession this event belongs to. */
  readonly sessionId: string;
  /** Classification of the action that triggered this event. */
  readonly type: AuditEventType;
  /** ISO 8601 timestamp (UTC) when the event occurred. */
  readonly timestamp: string;
  /** System or role that produced the event, e.g. 'claude_code', 'system'. */
  readonly actor: string;
  /** Arbitrary structured payload for the event type. */
  readonly details: Record<string, unknown>;
  /** Severity level. */
  readonly severity: AuditSeverity;
}

// ─── Serialization Shape ──────────────────────────────────────────────────────

/** Internal JSON envelope written by `serialize()`. */
interface AuditLogEnvelope {
  readonly version: 1;
  readonly sessionId: string;
  readonly events: AuditEvent[];
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * Accumulates audit events for a single execution session in memory.
 *
 * Events are ordered chronologically by insertion. The log is append-only —
 * individual events cannot be removed or mutated after recording.
 *
 * @example
 * ```ts
 * const log = createWorkerAuditLog("ses_abc123");
 * log.log("session_started", { agentType: "claude_code" });
 * log.log("file_read", { path: "src/lib/foo.ts" });
 * log.log("command_executed", { command: "npm run test", exitCode: 0 });
 * log.log("session_completed", { filesChanged: 3 });
 *
 * console.log(log.getSummary());
 * // → "[ses_abc123] 4 events: 1× session_started, 1× file_read, ..."
 *
 * const json = log.serialize();
 * const restored = WorkerAuditLog.deserialize(json);
 * ```
 */
export class WorkerAuditLog {
  private readonly _sessionId: string;
  private readonly _events: AuditEvent[];

  constructor(sessionId: string) {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error("WorkerAuditLog: sessionId must be a non-empty string");
    }
    this._sessionId = sessionId;
    this._events = [];
  }

  // ─── Read Accessors ─────────────────────────────────────────────────────────

  /** The session ID this log is scoped to. */
  get sessionId(): string {
    return this._sessionId;
  }

  // ─── Mutation ───────────────────────────────────────────────────────────────

  /**
   * Appends a new event to the log and returns the recorded event.
   *
   * @param type     - Event type classification.
   * @param details  - Arbitrary structured payload for this event.
   * @param severity - Severity level; defaults to 'info'.
   * @param actor    - The actor that produced the event; defaults to 'claude_code'.
   * @returns The immutable event that was recorded.
   *
   * @example
   * ```ts
   * const event = log.log("file_written", { path: "src/lib/foo.ts", bytes: 1024 });
   * console.log(event.id); // "3f2a…"
   * ```
   */
  log(
    type: AuditEventType,
    details: Record<string, unknown>,
    severity: AuditSeverity = "info",
    actor = "claude_code"
  ): AuditEvent {
    const event: AuditEvent = {
      id: randomUUID(),
      sessionId: this._sessionId,
      type,
      timestamp: new Date().toISOString(),
      actor,
      details,
      severity,
    };
    this._events.push(event);
    return event;
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  /**
   * Returns a shallow copy of all recorded events in insertion order.
   *
   * @example
   * ```ts
   * const all = log.getEvents();
   * console.log(all.length); // 4
   * ```
   */
  getEvents(): AuditEvent[] {
    return [...this._events];
  }

  /**
   * Returns all events of the specified type, in insertion order.
   *
   * @param type - The event type to filter on.
   * @returns Filtered array (may be empty).
   *
   * @example
   * ```ts
   * const writes = log.getEventsByType("file_written");
   * ```
   */
  getEventsByType(type: AuditEventType): AuditEvent[] {
    return this._events.filter((e) => e.type === type);
  }

  /**
   * Returns all events at or above the given severity level.
   *
   * Severity order: info < warn < error
   *
   * @param minSeverity - Minimum severity to include.
   * @returns Filtered array in insertion order.
   *
   * @example
   * ```ts
   * const problems = log.getEventsBySeverity("warn");
   * ```
   */
  getEventsBySeverity(minSeverity: AuditSeverity): AuditEvent[] {
    const order: Record<AuditSeverity, number> = { info: 0, warn: 1, error: 2 };
    type SeverityLevel = keyof typeof order;
    const threshold = order[minSeverity];
    return this._events.filter((e) => {
      const eventLevel = order[e.severity as SeverityLevel] ?? 0; // default unknown severity to info level
      return eventLevel >= threshold;
    });
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serializes the entire log to a compact JSON string.
   *
   * The returned string should be stored in a **dedicated audit-log field**
   * (e.g. a `workerAuditLog` column) rather than reusing
   * `ExecutionSession.resultSummary`, which is reserved for human-readable
   * text consumed by other services. Alternatively, pass the value as a
   * structured payload (e.g. via `validationOutput`) where appropriate.
   *
   * @returns Compact JSON string.
   *
   * @example
   * ```ts
   * const json = log.serialize();
   * // Store in a dedicated audit field, not resultSummary:
   * await prisma.executionSession.update({
   *   where: { id: sessionId },
   *   data: { workerAuditLog: json },
   * });
   * ```
   */
  serialize(): string {
    const envelope: AuditLogEnvelope = {
      version: 1,
      sessionId: this._sessionId,
      events: this._events,
    };
    return JSON.stringify(envelope);
  }

  /**
   * Reconstructs a `WorkerAuditLog` from a JSON string produced by `serialize()`.
   *
   * @param json - The serialized JSON string.
   * @returns Restored `WorkerAuditLog` instance with all original events.
   * @throws Error if `json` is not valid or does not contain a recognized envelope.
   *
   * @example
   * ```ts
   * const restored = WorkerAuditLog.deserialize(storedJson);
   * console.log(restored.getEvents().length);
   * ```
   */
  static deserialize(json: string): WorkerAuditLog {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (cause) {
      throw new Error(
        `WorkerAuditLog.deserialize: invalid JSON — ${(cause as Error).message}`
      );
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as AuditLogEnvelope).version !== 1
    ) {
      throw new Error(
        "WorkerAuditLog.deserialize: unrecognized envelope (expected version 1)"
      );
    }

    const envelope = parsed as AuditLogEnvelope;

    if (!envelope.sessionId || typeof envelope.sessionId !== "string") {
      throw new Error(
        "WorkerAuditLog.deserialize: envelope missing or invalid sessionId"
      );
    }

    if (!Array.isArray(envelope.events)) {
      throw new Error(
        "WorkerAuditLog.deserialize: envelope.events must be an array"
      );
    }

    const instance = new WorkerAuditLog(envelope.sessionId);
    for (const event of envelope.events) {
      // Guard against null or non-object entries in the events array
      if (event === null || typeof event !== "object") continue;
      // Enforce envelope sessionId to prevent mismatched events
      (event as unknown as Record<string, unknown>).sessionId = envelope.sessionId;
      // Push directly to bypass UUID generation — restore originals
      instance._events.push(event as AuditEvent);
    }

    return instance;
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  /**
   * Returns a concise human-readable summary of all events in the log.
   *
   * Format: `[<sessionId>] <n> events: <count>× <type>, …`
   *
   * Events with severity 'warn' or 'error' are highlighted in the summary.
   *
   * @returns Single-line summary string.
   *
   * @example
   * ```ts
   * log.getSummary();
   * // "[ses_abc] 3 events: 1× session_started, 1× file_written, 1× session_completed | 0 warnings, 0 errors"
   * ```
   */
  getSummary(): string {
    const total = this._events.length;

    if (total === 0) {
      return `[${this._sessionId}] 0 events`;
    }

    // Tally by type
    const typeCounts = new Map<AuditEventType, number>();
    for (const event of this._events) {
      typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);
    }

    const typeBreakdown = [...typeCounts.entries()]
      .map(([type, count]) => `${count}× ${type}`)
      .join(", ");

    const warnings = this._events.filter((e) => e.severity === "warn").length;
    const errors = this._events.filter((e) => e.severity === "error").length;
    const severitySuffix = ` | ${warnings} warning${warnings === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}`;

    return `[${this._sessionId}] ${total} event${total === 1 ? "" : "s"}: ${typeBreakdown}${severitySuffix}`;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a new empty `WorkerAuditLog` bound to the given session.
 *
 * Prefer this factory over `new WorkerAuditLog(sessionId)` in application
 * code for easier mocking in tests.
 *
 * @param sessionId - The ExecutionSession ID to scope events to.
 * @returns A new, empty `WorkerAuditLog`.
 *
 * @example
 * ```ts
 * const log = createWorkerAuditLog(session.id);
 * log.log("session_started", { agentType: "claude_code" });
 * ```
 */
export function createWorkerAuditLog(sessionId: string): WorkerAuditLog {
  return new WorkerAuditLog(sessionId);
}

// ─── Session Extraction Helper ────────────────────────────────────────────────

/**
 * Attempts to extract audit events from an ExecutionSession's `resultSummary`
 * field, where they may have been stored via `WorkerAuditLog.serialize()`.
 *
 * Returns an empty array when:
 * - `resultSummary` is null / undefined
 * - The field contains plain text rather than a serialized audit log envelope
 * - The JSON is present but malformed
 *
 * This helper is intentionally non-throwing so callers can safely use it
 * on sessions that may or may not carry an embedded audit log.
 *
 * @param session - Object with an optional `resultSummary` text field.
 * @returns Array of extracted `AuditEvent` records (may be empty).
 *
 * @example
 * ```ts
 * const session = await getExecutionSession(companyId, sessionId);
 * const events = parseAuditLogFromSession(session);
 * const blocked = events.filter(e => e.type === "command_blocked");
 * ```
 */
export function parseAuditLogFromSession(session: {
  resultSummary?: string | null;
}): AuditEvent[] {
  if (!session.resultSummary) return [];

  try {
    const log = WorkerAuditLog.deserialize(session.resultSummary);
    return log.getEvents();
  } catch {
    // resultSummary is plain text, not a serialized audit log
    return [];
  }
}

// ─── CEO-facing read view (MUS-215) ────────────────────────────────────────────

/**
 * Audit event types that represent a safety block — the agent was prevented from
 * doing something. These are surfaced distinctly in the CEO audit view.
 */
export const SAFETY_BLOCK_EVENT_TYPES: ReadonlySet<AuditEventType> = new Set([
  "command_blocked",
  "guardrail_triggered",
]);

/**
 * Returns true when an event type represents a safety block.
 *
 * @param type - Audit event type.
 */
export function isSafetyBlockEventType(type: string): boolean {
  return SAFETY_BLOCK_EVENT_TYPES.has(type as AuditEventType);
}

/** A single row in the CEO-facing audit trail. */
export interface AuditEventView {
  /** Machine-readable event type (e.g. `command_blocked`). */
  readonly type: string;
  /** Human-readable label for the event. */
  readonly label: string;
  /** Extra detail (offending path/command, file list, message), if any. */
  readonly detail: string | null;
  /** Severity of the event. */
  readonly severity: AuditSeverity;
  /** True when the event represents a safety block. */
  readonly isSafetyBlock: boolean;
  /** ISO timestamp when recorded, when available. */
  readonly timestamp: string | null;
}

/** The complete CEO-facing audit view for one execution session. */
export interface SessionAuditView {
  /** Chronological list of audit rows. */
  readonly events: readonly AuditEventView[];
  /** True when any safety block occurred. */
  readonly hasSafetyBlock: boolean;
  /** Number of safety-block events. */
  readonly blockedCount: number;
  /**
   * Where the trail came from:
   * - `audit_log`: a serialized WorkerAuditLog recorded by the worker.
   * - `derived`: reconstructed from the session's recorded facts (no silent gap).
   */
  readonly source: "audit_log" | "derived";
  /** Final session status, when known. */
  readonly outcomeStatus: string | null;
}

/** Subset of ExecutionSession fields needed to build the audit view. */
export interface AuditViewSessionInput {
  readonly status?: string | null;
  readonly filesChanged?: string | null;
  readonly validationOutput?: string | null;
  readonly resultSummary?: string | null;
  readonly errorMessage?: string | null;
  readonly commitSha?: string | null;
  readonly prUrl?: string | null;
  readonly prNumber?: number | null;
}

/** Human-readable labels for known audit event types. */
const EVENT_LABELS: Record<string, string> = {
  session_started: "Execution started",
  session_completed: "Execution completed",
  session_failed: "Execution failed",
  file_read: "File read",
  file_written: "File written",
  file_deleted: "File deleted",
  files_changed: "Files changed",
  command_executed: "Command run",
  command_blocked: "Command blocked",
  permission_check: "Permission check",
  guardrail_triggered: "Guardrail triggered",
  branch_created: "Branch created",
  pr_opened: "Pull request opened",
  validation_run: "Validation run",
};

/**
 * Extracts the recorded audit events from a session, checking the dedicated
 * fields where the worker may have serialized a {@link WorkerAuditLog}
 * (validationOutput first, then resultSummary).
 *
 * @param session - Session with possible serialized audit log.
 * @returns Parsed audit events, or an empty array when none are present.
 */
export function extractAuditEventsFromSession(
  session: AuditViewSessionInput
): AuditEvent[] {
  for (const candidate of [session.validationOutput, session.resultSummary]) {
    if (!candidate) continue;
    try {
      return WorkerAuditLog.deserialize(candidate).getEvents();
    } catch {
      // Not a serialized audit log — try the next field.
    }
  }
  return [];
}

/**
 * Builds the CEO-facing audit view for an execution session.
 *
 * When the worker serialized a {@link WorkerAuditLog} (e.g. on a guardrail
 * block), its events are surfaced verbatim. Otherwise the trail is derived from
 * the session's recorded facts (files changed, commit/push, PR, final status)
 * so there is no silent gap between what the worker did and what is shown.
 *
 * @param session - Execution session fields.
 * @returns The structured audit view.
 */
export function buildSessionAuditView(
  session: AuditViewSessionInput
): SessionAuditView {
  const recorded = extractAuditEventsFromSession(session);

  const events: AuditEventView[] =
    recorded.length > 0
      ? recorded.map(toEventView)
      : deriveEventsFromSession(session);

  const blockedCount = events.filter((e) => e.isSafetyBlock).length;

  return {
    events,
    hasSafetyBlock: blockedCount > 0,
    blockedCount,
    source: recorded.length > 0 ? "audit_log" : "derived",
    outcomeStatus: session.status ?? null,
  };
}

/** Maps a recorded AuditEvent to a view row. */
function toEventView(event: AuditEvent): AuditEventView {
  return {
    type: event.type,
    label: EVENT_LABELS[event.type] ?? event.type,
    detail: detailFromEvent(event),
    severity: event.severity,
    isSafetyBlock: isSafetyBlockEventType(event.type),
    timestamp: event.timestamp,
  };
}

/** Builds a detail string from an event's structured payload. */
function detailFromEvent(event: AuditEvent): string | null {
  const d = event.details;
  const parts: string[] = [];
  if (typeof d.command === "string") parts.push(d.command);
  if (typeof d.path === "string") parts.push(d.path);
  if (typeof d.branch === "string") parts.push(`branch ${d.branch}`);
  if (typeof d.message === "string") parts.push(d.message);
  return parts.length > 0 ? parts.join(" — ") : null;
}

/**
 * Reconstructs an ordered audit trail from a session's recorded facts when no
 * serialized log is present.
 */
function deriveEventsFromSession(
  session: AuditViewSessionInput
): AuditEventView[] {
  const events: AuditEventView[] = [];

  events.push({
    type: "session_started",
    label: EVENT_LABELS.session_started,
    detail: null,
    severity: "info",
    isSafetyBlock: false,
    timestamp: null,
  });

  const files = parseFiles(session.filesChanged);
  if (files.length > 0) {
    events.push({
      type: "files_changed",
      label: `${EVENT_LABELS.files_changed} (${files.length})`,
      detail: files.join(", "),
      severity: "info",
      isSafetyBlock: false,
      timestamp: null,
    });
  }

  if (session.commitSha) {
    events.push({
      type: "command_executed",
      label: "Committed & pushed",
      detail: session.commitSha.slice(0, 7),
      severity: "info",
      isSafetyBlock: false,
      timestamp: null,
    });
  }

  if (session.prUrl) {
    events.push({
      type: "pr_opened",
      label: EVENT_LABELS.pr_opened,
      detail: session.prNumber ? `PR #${session.prNumber}` : session.prUrl,
      severity: "info",
      isSafetyBlock: false,
      timestamp: null,
    });
  }

  const status = session.status ?? null;
  if (status === "completed") {
    events.push({
      type: "session_completed",
      label: EVENT_LABELS.session_completed,
      detail: null,
      severity: "info",
      isSafetyBlock: false,
      timestamp: null,
    });
  } else if (status === "failed") {
    events.push({
      type: "session_failed",
      label: EVENT_LABELS.session_failed,
      detail: session.errorMessage ?? null,
      severity: "error",
      isSafetyBlock: false,
      timestamp: null,
    });
  }

  return events;
}

/** Parses a filesChanged JSON string into an array of paths. */
function parseFiles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((f): f is string => typeof f === "string")
      : [];
  } catch {
    return [];
  }
}
