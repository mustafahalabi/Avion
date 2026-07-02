import { prisma } from "@/lib/prisma";
import type { ExecutionSession } from "@/generated/prisma/client";
import { EXECUTION_ADAPTER_AGENT_TYPES } from "@/lib/adapters/execution-adapter";
import { deriveBranchName, isProtectedBranch } from "@/lib/implementation-brief";

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXECUTION_SESSION_STATUSES = [
  "queued",
  "prepared",
  "running",
  "completed",
  "failed",
  "canceled",
  "needs_clarification",
] as const;

export const EXECUTION_SESSION_AGENT_TYPES = [
  "claude_code",
  "codex",
  "human",
] as const;

export const PR_STATUSES = ["open", "draft", "merged", "closed"] as const;
export const MERGE_STATUSES = ["pending", "merged", "conflicts"] as const;

export type ExecutionSessionStatus = (typeof EXECUTION_SESSION_STATUSES)[number];
export type ExecutionSessionAgentType = (typeof EXECUTION_SESSION_AGENT_TYPES)[number];
export type PrStatus = (typeof PR_STATUSES)[number];
export type MergeStatus = (typeof MERGE_STATUSES)[number];

// ─── Branch Helpers ───────────────────────────────────────────────────────────

/**
 * Generates a deterministic branch name from a task ID and title.
 * Delegates to the canonical derivation in implementation-brief.
 */
export { deriveBranchName as generateBranchName, isProtectedBranch };

// ─── Input / Output Interfaces ────────────────────────────────────────────────

/**
 * Input for creating a new ExecutionSession.
 */
export interface CreateExecutionSessionInput {
  companyId: string;
  /** Task being implemented (optional — session may exist before task assignment) */
  taskId?: string | null;
  /** Project containing the task */
  projectId?: string | null;
  /** Repository the agent will work in */
  repositoryId?: string | null;
  /** Assigned employee or recommended role */
  employeeId?: string | null;
  /** Originating planning draft */
  planningDraftId?: string | null;
  /**
   * Type of agent executing the session. When omitted, the company's
   * configured default applies (CompanySettings.defaultAgentType,
   * null → "claude_code").
   */
  agentType?: ExecutionSessionAgentType;
  /**
   * Implementation branch the agent will work on. If omitted and both taskId
   * and taskTitle are provided, a name is derived automatically.
   */
  branchName?: string | null;
  /** Task title used to auto-derive branchName when branchName is not supplied. */
  taskTitle?: string | null;
  /**
   * Base branch for the PR. When omitted/null, the worker lets GitHub resolve
   * the repo's real default branch (main vs master) — do NOT default it to a
   * literal here (MUS-282).
   */
  baseBranch?: string | null;
  /**
   * When true, the branch protection guard is bypassed. Use only for
   * explicit hotfix sessions targeting a release branch.
   */
  isHotfix?: boolean;
}

/**
 * Input for recording branch and PR metadata on an existing session.
 */
export interface RecordBranchInfoInput {
  /** Commit SHA reported by the agent. */
  commitSha?: string | null;
  /** Pull Request URL. */
  prUrl?: string | null;
  /** Pull Request number. */
  prNumber?: number | null;
  /** PR status: open | draft | merged | closed */
  prStatus?: PrStatus | null;
  /** Merge status: pending | merged | conflicts */
  mergeStatus?: MergeStatus | null;
}

/**
 * Input for recording a completed (or failed) agent result.
 */
export interface RecordExecutionResultInput {
  /** Final status after execution */
  status: Extract<ExecutionSessionStatus, "completed" | "failed" | "needs_clarification">;
  resultSummary?: string | null;
  /** Relative file paths that the agent changed */
  filesChanged?: string[];
  validationOutput?: string | null;
  errorMessage?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Serializes filesChanged array into JSON for storage.
 *
 * @param files - Array of file path strings
 * @returns JSON string
 */
function serializeFiles(files: string[]): string {
  return JSON.stringify(files);
}

/**
 * Deserializes filesChanged JSON from storage.
 *
 * @param raw - Raw JSON string from database
 * @returns Array of file path strings
 */
function deserializeFiles(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Resolves the default agent type for a company's execution sessions.
 *
 * Reads `CompanySettings.defaultAgentType` (MUS-264). Only agent types with a
 * registered execution adapter are honored — null, "human", or any
 * unrecognized value falls back to "claude_code" so a bad setting can never
 * strand sessions on an unrunnable agent.
 *
 * @param companyId - Company whose default agent type to resolve
 * @returns A runnable agent type, defaulting to "claude_code"
 */
export async function getCompanyDefaultAgentType(
  companyId: string
): Promise<ExecutionSessionAgentType> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { defaultAgentType: true },
  });
  const stored = settings?.defaultAgentType;
  return stored &&
    (EXECUTION_ADAPTER_AGENT_TYPES as readonly string[]).includes(stored)
    ? (stored as ExecutionSessionAgentType)
    : "claude_code";
}

/**
 * Thrown by {@link createExecutionSession} when a concurrent creator already
 * has a live (queued / prepared / running) session for the task. Callers treat
 * it as "already prepared" — the same outcome as the pre-create idempotency
 * check, just enforced atomically at insert time (MUS-294).
 */
export class LiveSessionExistsError extends Error {
  readonly existingSessionId: string;
  readonly taskId: string;

  constructor(taskId: string, existingSessionId: string, existingStatus: string) {
    super(
      `Task ${taskId} already has a live session (${existingStatus}); refusing to create a second.`
    );
    this.name = "LiveSessionExistsError";
    this.taskId = taskId;
    this.existingSessionId = existingSessionId;
  }
}

/**
 * Creates a new ExecutionSession in the "queued" state for a given task.
 *
 * For task sessions this is atomic: it locks the task row, re-checks for a live
 * session, and inserts in one transaction, so at most one live session can exist
 * per task even under concurrent preparers (throws {@link LiveSessionExistsError}
 * to the loser).
 *
 * @param input - Session creation parameters
 * @returns The newly created ExecutionSession
 *
 * @example
 * const session = await createExecutionSession({
 *   companyId: "cmp_123",
 *   taskId: "task_456",
 *   projectId: "proj_789",
 *   agentType: "claude_code",
 * });
 */
export async function createExecutionSession(
  input: CreateExecutionSessionInput
): Promise<ExecutionSession> {
  const branchName =
    input.branchName ??
    (input.taskId && input.taskTitle
      ? deriveBranchName(input.taskId, input.taskTitle)
      : null);

  // Null when unknown: the worker then OMITS the PR base so GitHub's real
  // default branch is resolved (main vs master). Defaulting to "master" here
  // opened PRs against a non-existent branch on any main-default repo (MUS-282).
  const baseBranch = input.baseBranch ?? null;

  if (branchName && isProtectedBranch(branchName) && !input.isHotfix) {
    throw new Error(
      `Cannot create session with protected branch "${branchName}". ` +
        `Set isHotfix: true to override for explicit hotfix work.`
    );
  }

  const data = {
    companyId: input.companyId,
    taskId: input.taskId ?? null,
    projectId: input.projectId ?? null,
    repositoryId: input.repositoryId ?? null,
    employeeId: input.employeeId ?? null,
    planningDraftId: input.planningDraftId ?? null,
    // Explicit input wins; otherwise the company's configured default
    // (CompanySettings.defaultAgentType, null → "claude_code") applies.
    agentType:
      input.agentType ?? (await getCompanyDefaultAgentType(input.companyId)),
    status: "queued",
    branchName,
    baseBranch,
  };

  // Non-task sessions have nothing to serialize on — insert directly.
  const taskId = input.taskId;
  if (!taskId) {
    return prisma.executionSession.create({ data });
  }

  // Atomic idempotency (MUS-294): the old find-then-create was non-atomic, so a
  // manual "Prepare execution" racing a driver tick (or two driver instances)
  // could both pass the "no live session" check and create a session for the
  // same task → two branches, two PRs. Lock the task row, re-check for a live
  // session, and insert — all in one transaction — so at most one live session
  // per task can ever exist. The rare loser throws LiveSessionExistsError, which
  // callers treat as "already prepared".
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent creators on the task row (a no-op if the task is
    // missing — the create's FK would then fail anyway).
    await tx.$queryRaw`SELECT id FROM "Task" WHERE "companyId" = ${input.companyId} AND "id" = ${taskId} FOR UPDATE`;
    const live = await tx.executionSession.findFirst({
      where: {
        companyId: input.companyId,
        taskId,
        status: { in: [...LIVE_EXECUTION_SESSION_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
    if (live) {
      throw new LiveSessionExistsError(taskId, live.id, live.status);
    }
    return tx.executionSession.create({ data });
  });
}

/**
 * Retrieves an ExecutionSession by ID, guarded by company ownership.
 *
 * @param companyId - Company ID (ownership guard)
 * @param sessionId - ExecutionSession ID
 * @returns The ExecutionSession, or null if not found / not owned by company
 *
 * @example
 * const session = await getExecutionSession("cmp_123", "ses_456");
 */
export async function getExecutionSession(
  companyId: string,
  sessionId: string
): Promise<ExecutionSession | null> {
  return prisma.executionSession.findFirst({
    where: { id: sessionId, companyId },
  });
}

/**
 * Lists all ExecutionSessions for a company, optionally filtered by status.
 *
 * @param companyId - Company ID
 * @param status - Optional status filter
 * @returns Array of ExecutionSessions ordered by most recent first
 *
 * @example
 * const runningSessions = await listExecutionSessions("cmp_123", "running");
 */
export async function listExecutionSessions(
  companyId: string,
  status?: ExecutionSessionStatus
): Promise<ExecutionSession[]> {
  return prisma.executionSession.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Lists all ExecutionSessions for a specific task.
 *
 * @param companyId - Company ID (ownership guard)
 * @param taskId - Task ID
 * @returns Array of ExecutionSessions for the task, most recent first
 *
 * @example
 * const sessions = await listExecutionSessionsForTask("cmp_123", "task_456");
 */
export async function listExecutionSessionsForTask(
  companyId: string,
  taskId: string
): Promise<ExecutionSession[]> {
  return prisma.executionSession.findMany({
    where: { companyId, taskId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Attaches the generated task brief to a session and transitions it to
 * the "prepared" state.
 *
 * @param companyId - Company ID (ownership guard)
 * @param sessionId - ExecutionSession ID
 * @param taskBrief - Generated agent-safe task brief markdown
 * @returns Updated session, or null if not found / not owned
 *
 * @throws Error if session is not in "queued" status
 *
 * @example
 * const prepared = await prepareExecutionSession("cmp_123", "ses_456", "# Task Brief\n…");
 */
export async function prepareExecutionSession(
  companyId: string,
  sessionId: string,
  taskBrief: string
): Promise<ExecutionSession | null> {
  const existing = await prisma.executionSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!existing) return null;
  if (existing.status !== "queued") {
    throw new Error(
      `Cannot prepare session ${sessionId}: expected status "queued", got "${existing.status}"`
    );
  }

  return prisma.executionSession.update({
    where: { id: sessionId },
    data: { status: "prepared", taskBrief },
  });
}

/**
 * Session statuses that represent in-flight work that is not yet terminal.
 * A task with a session in any of these states already has work underway.
 */
export const LIVE_EXECUTION_SESSION_STATUSES = [
  "queued",
  "prepared",
  "running",
] as const;

/**
 * Returns the most recent live (queued / prepared / running) execution session
 * for a task, or null when none exists.
 *
 * Used to keep automated session creation idempotent: callers should not create
 * a second session for a task that already has work underway.
 *
 * @param companyId - Company ID (ownership guard).
 * @param taskId - Task to check for a live session.
 * @returns The live session, or null.
 */
export async function findLiveSessionForTask(
  companyId: string,
  taskId: string
): Promise<ExecutionSession | null> {
  return prisma.executionSession.findFirst({
    where: {
      companyId,
      taskId,
      status: { in: [...LIVE_EXECUTION_SESSION_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Default agent phase timeout (mirrors the worker's WORKER_SESSION_TIMEOUT_SECONDS). */
const DEFAULT_SESSION_PHASE_TIMEOUT_SECONDS = 1800;
/** Default dependency-install timeout (mirrors WORKER_INSTALL_TIMEOUT_SECONDS). */
const DEFAULT_INSTALL_TIMEOUT_SECONDS = 600;
/** Margin over the worst-case runtime for clone/commit/PR overhead. */
const STALE_SESSION_SAFETY_MARGIN_SECONDS = 300;

/** Reads a non-negative seconds value from the environment, or a fallback. */
function envSeconds(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Resolves the stale-session grace period: the **full worst-case worker runtime**,
 * not just the agent phase. A healthy run spends agent (`WORKER_SESSION_TIMEOUT_SECONDS`)
 * + dependency install (`WORKER_INSTALL_TIMEOUT_SECONDS`) + validation (the session
 * timeout again) + clone/commit/PR overhead. The reaper must only reclaim sessions
 * from a **crashed** worker, so its grace covers that whole budget plus a margin —
 * reaping at just the agent timeout killed healthy long sessions mid-run (MUS-285).
 */
function staleSessionTimeoutSeconds(): number {
  const sessionPhase = envSeconds(
    "WORKER_SESSION_TIMEOUT_SECONDS",
    DEFAULT_SESSION_PHASE_TIMEOUT_SECONDS
  );
  const installPhase = envSeconds(
    "WORKER_INSTALL_TIMEOUT_SECONDS",
    DEFAULT_INSTALL_TIMEOUT_SECONDS
  );
  // agent + validation both bounded by the session-phase timeout, plus install.
  return sessionPhase * 2 + installPhase + STALE_SESSION_SAFETY_MARGIN_SECONDS;
}

/**
 * Releases execution sessions stuck in `running` past the session timeout — the
 * signature of a worker that died mid-run (MUS-280). Because `running` is a LIVE
 * status, an orphaned session makes {@link findLiveSessionForTask} return it and
 * consumes a driver concurrency slot, so the task can never be re-enqueued. Reaping
 * it to `failed` (crash-recovery semantics) hands control back to the bounded-retry
 * policy, which owns whether/when the task retries.
 *
 * Idempotent, and never touches a session still within its timeout window (a
 * legitimate in-flight run). Optionally scoped to one company.
 *
 * @param options.companyId - Restrict to a single company (default: all).
 * @param options.now - Current time (injectable for tests).
 * @param options.timeoutSeconds - Grace period; a running session whose `startedAt`
 *   is older than this is treated as abandoned. Defaults to the env/worker timeout.
 * @returns The number of sessions reaped.
 */
export async function reapStaleRunningSessions(options?: {
  companyId?: string;
  now?: Date;
  timeoutSeconds?: number;
}): Promise<number> {
  const now = options?.now ?? new Date();
  const timeoutSeconds = options?.timeoutSeconds ?? staleSessionTimeoutSeconds();
  const cutoff = new Date(now.getTime() - timeoutSeconds * 1000);

  const result = await prisma.executionSession.updateMany({
    where: {
      status: "running",
      startedAt: { lt: cutoff },
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    },
    data: {
      status: "failed",
      errorMessage:
        "Worker did not finish within the session timeout; released as failed (crash recovery). The bounded-retry policy owns what happens next.",
      completedAt: now,
      updatedAt: now,
    },
  });

  return result.count;
}

/**
 * Marks a session as running and records the start timestamp.
 *
 * @param companyId - Company ID (ownership guard)
 * @param sessionId - ExecutionSession ID
 * @returns Updated session, or null if not found / not owned
 *
 * @throws Error if session is not in "prepared" status
 *
 * @example
 * const running = await startExecutionSession("cmp_123", "ses_456");
 */
export async function startExecutionSession(
  companyId: string,
  sessionId: string
): Promise<ExecutionSession | null> {
  const existing = await prisma.executionSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!existing) return null;
  if (existing.status !== "prepared") {
    throw new Error(
      `Cannot start session ${sessionId}: expected status "prepared", got "${existing.status}"`
    );
  }

  return prisma.executionSession.update({
    where: { id: sessionId },
    data: { status: "running", startedAt: new Date() },
  });
}

/**
 * Records the result of an execution attempt and closes the session.
 * Transitions status to "completed", "failed", or "needs_clarification".
 *
 * No code execution is performed here — this records what an external agent
 * reported after completing its work.
 *
 * @param companyId - Company ID (ownership guard)
 * @param sessionId - ExecutionSession ID
 * @param result - Execution result payload
 * @returns Updated session, or null if not found / not owned
 *
 * @throws Error if session is not in "running" status
 *
 * @example
 * const closed = await recordExecutionResult("cmp_123", "ses_456", {
 *   status: "completed",
 *   resultSummary: "Implemented the feature. All tests pass.",
 *   filesChanged: ["src/lib/foo.ts", "src/lib/foo.test.ts"],
 *   validationOutput: "✅ tsc, lint, test all pass",
 * });
 */
export async function recordExecutionResult(
  companyId: string,
  sessionId: string,
  result: RecordExecutionResultInput
): Promise<ExecutionSession | null> {
  const existing = await prisma.executionSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!existing) return null;
  if (existing.status !== "running") {
    throw new Error(
      `Cannot record result for session ${sessionId}: expected status "running", got "${existing.status}"`
    );
  }

  return prisma.executionSession.update({
    where: { id: sessionId },
    data: {
      status: result.status,
      resultSummary: result.resultSummary ?? null,
      filesChanged: serializeFiles(result.filesChanged ?? []),
      validationOutput: result.validationOutput ?? null,
      errorMessage: result.errorMessage ?? null,
      completedAt: new Date(),
    },
  });
}

/**
 * Cancels an ExecutionSession that has not yet completed.
 *
 * @param companyId - Company ID (ownership guard)
 * @param sessionId - ExecutionSession ID
 * @returns Updated session, or null if not found / not owned
 *
 * @throws Error if session is already in a terminal state
 *
 * @example
 * await cancelExecutionSession("cmp_123", "ses_456");
 */
export async function cancelExecutionSession(
  companyId: string,
  sessionId: string
): Promise<ExecutionSession | null> {
  const existing = await prisma.executionSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!existing) return null;

  const terminalStatuses: ExecutionSessionStatus[] = [
    "completed",
    "failed",
    "canceled",
  ];
  if (terminalStatuses.includes(existing.status as ExecutionSessionStatus)) {
    throw new Error(
      `Cannot cancel session ${sessionId}: already in terminal status "${existing.status}"`
    );
  }

  return prisma.executionSession.update({
    where: { id: sessionId },
    data: { status: "canceled", completedAt: new Date() },
  });
}

/**
 * Records branch and PR metadata on an existing session.
 *
 * Can be called at any point in the session lifecycle (e.g. after the agent
 * opens a PR or after a merge). Only non-null fields in the input are applied.
 *
 * @param companyId - Company ID (ownership guard)
 * @param sessionId - ExecutionSession ID
 * @param info - Branch / PR metadata to record
 * @returns Updated session, or null if not found / not owned
 *
 * @example
 * await recordBranchInfo("cmp_123", "ses_456", {
 *   commitSha: "abc1234",
 *   prUrl: "https://github.com/org/repo/pull/42",
 *   prNumber: 42,
 *   prStatus: "open",
 *   mergeStatus: "pending",
 * });
 */
export async function recordBranchInfo(
  companyId: string,
  sessionId: string,
  info: RecordBranchInfoInput
): Promise<ExecutionSession | null> {
  const existing = await prisma.executionSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (info.commitSha !== undefined) data.commitSha = info.commitSha;
  if (info.prUrl !== undefined) data.prUrl = info.prUrl;
  if (info.prNumber !== undefined) data.prNumber = info.prNumber;
  if (info.prStatus !== undefined) data.prStatus = info.prStatus;
  if (info.mergeStatus !== undefined) data.mergeStatus = info.mergeStatus;

  if (Object.keys(data).length === 0) return existing;

  return prisma.executionSession.update({
    where: { id: sessionId },
    data,
  });
}

/**
 * Returns the files changed in a session as a string array.
 *
 * @param session - ExecutionSession record
 * @returns Array of relative file paths
 *
 * @example
 * const files = getSessionFilesChanged(session);
 * logger.info({ files }, "Files changed in session");
 */
export function getSessionFilesChanged(session: ExecutionSession): string[] {
  return deserializeFiles(session.filesChanged);
}

/**
 * Returns true when the session has reached a terminal state.
 *
 * @param session - ExecutionSession record
 * @returns True if status is completed, failed, or canceled
 *
 * @example
 * if (isSessionTerminal(session)) {
 *   triggerReviewFlow(session);
 * }
 */
export function isSessionTerminal(session: ExecutionSession): boolean {
  const terminalStatuses: ExecutionSessionStatus[] = [
    "completed",
    "failed",
    "canceled",
  ];
  return terminalStatuses.includes(session.status as ExecutionSessionStatus);
}

// ─── Run outcome classification ───────────────────────────────────────────────

/** Classified outcome of an agent run, for truthful ingestion. */
export interface AgentRunClassification {
  /** Session status to ingest. */
  readonly status: "completed" | "failed";
  /** True when the agent claimed success but produced no commit (a no-op run). */
  readonly noOp: boolean;
  /** Error message to record for a no-op run, null otherwise. */
  readonly noOpReason: string | null;
}

/**
 * Classifies an agent run for ingestion. An agent that reports success but
 * produced **no commit** (zero changes) is a failed attempt, not a completion —
 * otherwise the task would advance to review/done with no code and no PR
 * ("shipped work that doesn't exist"). Likewise, a run that committed but whose
 * **pull request could not be opened** is a failed attempt: without a PR the
 * work can't be reviewed or merged, so the task must not advance to review/done
 * with an orphaned branch (MUS-282).
 *
 * @param input.agentSuccess - Whether the agent itself reported success.
 * @param input.commitSha - HEAD commit after commit/push, or null when no changes existed.
 * @param input.prOpenFailed - True when a commit was pushed but opening the PR failed.
 * @returns The truthful ingestion status plus no-op metadata.
 *
 * @example
 * ```ts
 * classifyAgentRunForIngestion({ agentSuccess: true, commitSha: null });
 * // → { status: "failed", noOp: true, noOpReason: "Agent reported success but…" }
 * ```
 */
export function classifyAgentRunForIngestion(input: {
  agentSuccess: boolean;
  commitSha: string | null;
  prOpenFailed?: boolean;
}): AgentRunClassification {
  if (!input.agentSuccess) {
    return { status: "failed", noOp: false, noOpReason: null };
  }
  if (!input.commitSha) {
    return {
      status: "failed",
      noOp: true,
      noOpReason:
        "Agent reported success but produced no changes (no commit, no PR). Treated as a failed attempt so the task does not advance without real work.",
    };
  }
  if (input.prOpenFailed) {
    // Committed but no PR — the branch is orphaned. Fail so the task returns to
    // the queue (bounded retries own it) instead of reaching done with no PR.
    return { status: "failed", noOp: false, noOpReason: null };
  }
  return { status: "completed", noOp: false, noOpReason: null };
}

// ─── Ingestion Result ─────────────────────────────────────────────────────────

/**
 * Input for the high-level agent result ingestion path.
 */
export interface IngestAgentExecutionResultInput {
  /** Company ID (ownership guard). */
  readonly companyId: string;
  /** ExecutionSession ID to receive the result. */
  readonly sessionId: string;
  /** Final execution status reported by the agent. */
  readonly status: Extract<ExecutionSessionStatus, "completed" | "failed" | "needs_clarification">;
  /** Free-text summary of what the agent did. */
  readonly resultSummary: string | null;
  /**
   * Relative file paths changed by the agent.
   * Newline-separated string from a textarea, or a pre-split array.
   */
  readonly filesChanged: string | readonly string[];
  /** Raw validation command output (tsc, lint, test, etc.) */
  readonly validationOutput: string | null;
  /** Error message when status is "failed" or "needs_clarification". */
  readonly errorMessage: string | null;
  /** Commit SHA from the agent run. */
  readonly commitSha?: string | null;
  /** Pull request URL opened for this implementation. */
  readonly prUrl?: string | null;
  /** Pull request number. */
  readonly prNumber?: number | null;
  /** PR status: open | draft | merged | closed */
  readonly prStatus?: PrStatus | null;
  /** Merge status: pending | merged | conflicts */
  readonly mergeStatus?: MergeStatus | null;
}

/**
 * Result of the agent execution result ingestion.
 */
export interface IngestAgentExecutionResultOutcome {
  readonly session: ExecutionSession;
  /** New task status after ingestion, or null when no task is linked. */
  readonly newTaskStatus: string | null;
  /** Whether a task status transition occurred. */
  readonly taskStatusChanged: boolean;
}

/**
 * Ingests the result of an external agent execution attempt.
 *
 * Handles the full state transition: if the session is in "prepared" status it
 * is automatically started before the result is recorded, so the caller does
 * not need to call `startExecutionSession` separately.
 *
 * After recording the result the linked task's status is updated truthfully:
 * - "completed" → task moves to "in-review" (signals work is ready for review).
 * - "failed" or "needs_clarification" → task remains actionable ("todo") so
 *   it can be retried. The task is NOT automatically moved to done, in-review,
 *   or any review/QA state.
 *
 * A runtime timeline event is written on the originating RuntimeRequest when
 * the task → outcome → runtimeRequest chain is resolvable.
 *
 * @param input - Ingestion payload including session ID and agent result.
 * @returns Updated session, new task status, and whether the task changed.
 * @throws Error if the session is not found, not owned, or is already terminal.
 *
 * @example
 * ```ts
 * const outcome = await ingestAgentExecutionResult({
 *   companyId: "cmp_123",
 *   sessionId: "ses_456",
 *   status: "completed",
 *   resultSummary: "Implemented feature. All tests pass.",
 *   filesChanged: "src/lib/foo.ts\nsrc/lib/foo.test.ts",
 *   validationOutput: "✅ tsc, lint, test all pass",
 *   errorMessage: null,
 * });
 * ```
 */
export async function ingestAgentExecutionResult(
  input: IngestAgentExecutionResultInput
): Promise<IngestAgentExecutionResultOutcome> {
  const session = await prisma.executionSession.findFirst({
    where: { id: input.sessionId, companyId: input.companyId },
  });

  if (!session) {
    throw new Error(`ExecutionSession ${input.sessionId} not found or not owned by company ${input.companyId}`);
  }

  if (isSessionTerminal(session)) {
    throw new Error(
      `Cannot ingest result for session ${input.sessionId}: already in terminal status "${session.status}"`
    );
  }

  const parsedFiles = parseFilesInput(input.filesChanged);

  const updated = await prisma.$transaction(async (tx) => {
    let current = session;

    if (current.status === "prepared") {
      current = await tx.executionSession.update({
        where: { id: current.id },
        data: { status: "running", startedAt: new Date() },
      });
    }

    if (current.status !== "running") {
      throw new Error(
        `Cannot record result for session ${input.sessionId}: expected "running" or "prepared", got "${current.status}"`
      );
    }

    const branchData: Record<string, unknown> = {};
    if (input.commitSha) branchData.commitSha = input.commitSha;
    if (input.prUrl) branchData.prUrl = input.prUrl;
    if (input.prNumber != null) branchData.prNumber = input.prNumber;
    if (input.prStatus) branchData.prStatus = input.prStatus;
    if (input.mergeStatus) branchData.mergeStatus = input.mergeStatus;

    // Conditional on the row still being "running": if a stale-session reaper
    // flipped it to "failed" between our read above and here (TOCTOU), this
    // matches zero rows and we abort rather than resurrect the session
    // `failed → completed` and advance the task on discarded work (MUS-285).
    const writeResult = await tx.executionSession.updateMany({
      where: { id: current.id, status: "running" },
      data: {
        status: input.status,
        resultSummary: input.resultSummary ?? null,
        filesChanged: serializeFiles(parsedFiles),
        validationOutput: input.validationOutput ?? null,
        errorMessage: input.errorMessage ?? null,
        completedAt: new Date(),
        ...branchData,
      },
    });
    if (writeResult.count === 0) {
      throw new Error(
        `Cannot record result for session ${input.sessionId}: it is no longer "running" (reaped or changed concurrently).`
      );
    }

    const resultSession = await tx.executionSession.findFirstOrThrow({
      where: { id: current.id },
    });

    return resultSession;
  });

  let newTaskStatus: string | null = null;
  let taskStatusChanged = false;

  if (updated.taskId) {
    const targetTaskStatus = input.status === "completed" ? "in-review" : "todo";

    const updateResult = await prisma.task.updateMany({
      where: {
        id: updated.taskId,
        companyId: input.companyId,
        status: { notIn: ["done", "cancelled", "in-review"] },
      },
      data: { status: targetTaskStatus },
    });

    taskStatusChanged = updateResult.count > 0;
    newTaskStatus = targetTaskStatus;

    if (taskStatusChanged) {
      try {
        await writeTimelineEventForTask(
          input.companyId,
          updated.taskId,
          input.status,
          input.resultSummary,
          input.prUrl ?? null
        );
      } catch {
        // Timeline event creation is best-effort; do not fail the main ingestion flow.
      }
    }
  }

  return { session: updated, newTaskStatus, taskStatusChanged };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Parses filesChanged input which may be a newline-separated string or array.
 *
 * @param files - Newline-separated string from a textarea, or an array.
 * @returns Cleaned array of relative file paths.
 */
function parseFilesInput(files: string | readonly string[]): string[] {
  if (Array.isArray(files)) {
    return (files as string[]).filter((f) => f.trim().length > 0);
  }
  return (files as string)
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

/**
 * Writes a runtime timeline event on the RuntimeRequest linked to a task's
 * outcome, when the full chain is resolvable.
 *
 * @param companyId - Company ID for ownership scoping.
 * @param taskId - Task to trace to its RuntimeRequest.
 * @param executionStatus - Final execution status.
 * @param resultSummary - Optional result summary for the event description.
 * @param prUrl - Pull request URL to reference in the event, when available.
 */
async function writeTimelineEventForTask(
  companyId: string,
  taskId: string,
  executionStatus: string,
  resultSummary: string | null,
  prUrl: string | null = null
): Promise<void> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: {
      id: true,
      outcome: { select: { runtimeRequestId: true } },
    },
  });

  const runtimeRequestId = task?.outcome?.runtimeRequestId;
  if (!runtimeRequestId) return;

  const requestExists = await prisma.runtimeRequest.findFirst({
    where: { id: runtimeRequestId, companyId },
    select: { id: true },
  });
  if (!requestExists) return;

  const description = buildTimelineDescription(executionStatus, resultSummary, prUrl);

  await prisma.runtimeEvent.create({
    data: {
      requestId: runtimeRequestId,
      type: `execution_${executionStatus}`,
      description,
      actor: "Agent",
    },
  });
}

/**
 * Builds a human-readable timeline event description for execution results.
 *
 * @param executionStatus - Final execution status.
 * @param resultSummary - Optional agent-provided summary.
 * @param prUrl - Pull request URL appended to the description when present.
 * @returns Short, consistent description string for the RuntimeEvent.
 */
export function buildTimelineDescription(
  executionStatus: string,
  resultSummary: string | null,
  prUrl: string | null = null
): string {
  const summarySnippet =
    resultSummary && resultSummary.trim().length > 0
      ? `: ${resultSummary.trim().slice(0, 120)}`
      : "";

  const prSnippet = prUrl && prUrl.trim().length > 0 ? ` (PR: ${prUrl.trim()})` : "";

  switch (executionStatus) {
    case "completed":
      return `Implementation completed${summarySnippet}${prSnippet}`;
    case "failed":
      return `Implementation failed${summarySnippet}${prSnippet}`;
    case "needs_clarification":
      return `Implementation needs clarification${summarySnippet}${prSnippet}`;
    default:
      return `Execution result recorded: ${executionStatus}${summarySnippet}${prSnippet}`;
  }
}
