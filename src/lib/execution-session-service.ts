import { prisma } from "@/lib/prisma";
import type { ExecutionSession } from "@/generated/prisma/client";

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

export type ExecutionSessionStatus = (typeof EXECUTION_SESSION_STATUSES)[number];
export type ExecutionSessionAgentType = (typeof EXECUTION_SESSION_AGENT_TYPES)[number];

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
