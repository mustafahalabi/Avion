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
    const threshold = order[minSeverity];
    return this._events.filter((e) => order[e.severity] >= threshold);
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serializes the entire log to a JSON string suitable for storage in a
   * text field (e.g. `ExecutionSession.resultSummary`).
   *
   * @returns Compact JSON string.
   *
   * @example
   * ```ts
   * const json = log.serialize();
   * await prisma.executionSession.update({
   *   where: { id: sessionId },
   *   data: { resultSummary: json },
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
