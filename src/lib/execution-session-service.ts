import { prisma } from "@/lib/prisma";
import type { ExecutionSession } from "@/generated/prisma/client";
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
  /** Type of agent executing the session */
  agentType?: ExecutionSessionAgentType;
  /**
   * Implementation branch the agent will work on. If omitted and both taskId
   * and taskTitle are provided, a name is derived automatically.
   */
  branchName?: string | null;
  /** Task title used to auto-derive branchName when branchName is not supplied. */
  taskTitle?: string | null;
  /** Base branch to check out from (defaults to "master"). */
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
 * Creates a new ExecutionSession in the "queued" state for a given task.
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

  const baseBranch = input.baseBranch ?? "master";

  if (branchName && isProtectedBranch(branchName) && !input.isHotfix) {
    throw new Error(
      `Cannot create session with protected branch "${branchName}". ` +
        `Set isHotfix: true to override for explicit hotfix work.`
    );
  }

  return prisma.executionSession.create({
    data: {
      companyId: input.companyId,
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
      repositoryId: input.repositoryId ?? null,
      employeeId: input.employeeId ?? null,
      planningDraftId: input.planningDraftId ?? null,
      agentType: input.agentType ?? "claude_code",
      status: "queued",
      branchName,
      baseBranch,
    },
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

    const resultSession = await tx.executionSession.update({
      where: { id: current.id },
      data: {
        status: input.status,
        resultSummary: input.resultSummary ?? null,
        filesChanged: serializeFiles(parsedFiles),
        validationOutput: input.validationOutput ?? null,
        errorMessage: input.errorMessage ?? null,
        completedAt: new Date(),
      },
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
          input.resultSummary
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
 */
async function writeTimelineEventForTask(
  companyId: string,
  taskId: string,
  executionStatus: string,
  resultSummary: string | null
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

  const description = buildTimelineDescription(executionStatus, resultSummary);

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
 * @returns Short, consistent description string for the RuntimeEvent.
 */
function buildTimelineDescription(executionStatus: string, resultSummary: string | null): string {
  const summarySnippet =
    resultSummary && resultSummary.trim().length > 0
      ? `: ${resultSummary.trim().slice(0, 120)}`
      : "";

  switch (executionStatus) {
    case "completed":
      return `Implementation completed${summarySnippet}`;
    case "failed":
      return `Implementation failed${summarySnippet}`;
    case "needs_clarification":
      return `Implementation needs clarification${summarySnippet}`;
    default:
      return `Execution result recorded: ${executionStatus}${summarySnippet}`;
  }
}
