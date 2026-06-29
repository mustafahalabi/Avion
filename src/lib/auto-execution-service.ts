/**
 * Auto-Execution Service
 *
 * Bridges "approved plan with todo tasks" → "prepared execution session" with no
 * UI interaction. Extracts the session-preparation steps the manual
 * `generateTaskBrief` server action performs into a reusable, non-UI function,
 * and adds the autonomous entry point the scheduler (MUS-205) will call on a
 * loop.
 *
 * Idempotency: never creates a second session for a task that already has a live
 * (queued / prepared / running) session.
 *
 * Autonomy: only auto-creates when the company's autonomy level permits
 * `create_session` without an approval checkpoint (see `autonomy-policy`). Below
 * that threshold the function recommends rather than acts.
 */

import { authorizeAutonomyAction } from "@/lib/autonomy-policy";
import {
  createExecutionSession,
  findLiveSessionForTask,
  prepareExecutionSession,
} from "@/lib/execution-session-service";
import { generateClaudeImplementationBrief } from "@/lib/implementation-brief";
import { prisma } from "@/lib/prisma";
import { selectNextExecutableTaskForCompany } from "@/lib/task-selection-service";
import {
  resolveTaskRepository,
  toBriefRepositoryContext,
} from "@/lib/task-repository-context";

// ─── Shared session preparation (manual + automated) ─────────────────────────

/** Successful result of preparing an execution session for a task. */
export interface PrepareTaskExecutionResult {
  readonly sessionId: string;
  readonly brief: string;
  readonly branchName: string;
}

/**
 * Prepares an execution session for a specific task: resolves the repository,
 * generates the Claude implementation brief, then creates and prepares the
 * `ExecutionSession`. This is the non-UI core shared by the manual server
 * action and the autonomous driver — both paths produce identical sessions.
 *
 * @param companyId - Company ID (ownership guard).
 * @param taskId - Task to prepare a session for.
 * @returns The prepared session id + brief, or an `{ error }` describing why not.
 */
export async function prepareExecutionSessionForTask(
  companyId: string,
  taskId: string
): Promise<PrepareTaskExecutionResult | { readonly error: string }> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    include: {
      planningDraft: { select: { id: true, generatedTasks: true } },
      project: {
        include: {
          workspace: {
            include: {
              repositories: { take: 1, orderBy: { updatedAt: "desc" } },
            },
          },
        },
      },
    },
  });

  if (!task) return { error: "Task not found." };

  const repoRow = resolveTaskRepository(task.project?.workspace?.repositories);
  const repo = repoRow ? toBriefRepositoryContext(repoRow) : null;

  const { brief, branchName } = generateClaudeImplementationBrief({
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description ?? null,
    priority: task.priority,
    planningDraftId: task.planningDraftId ?? null,
    planItemId: task.planItemId ?? null,
    generatedTasksJson: task.planningDraft?.generatedTasks ?? null,
    repository: repo,
    branchName: null,
    baseBranch: "master",
    linearTicketUrl: null,
  });

  const session = await createExecutionSession({
    companyId,
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.projectId ?? null,
    repositoryId: repoRow?.id ?? null,
    planningDraftId: task.planningDraftId ?? null,
    agentType: "claude_code",
    branchName,
    baseBranch: "master",
  });

  const prepared = await prepareExecutionSession(companyId, session.id, brief);
  if (!prepared) return { error: "Failed to prepare execution session." };

  return { sessionId: session.id, brief, branchName };
}

// ─── Autonomous entry point ──────────────────────────────────────────────────

/** Disposition of a single `autoPrepareNextExecutionSession` run. */
export type AutoPrepareStatus =
  | "prepared"
  | "skipped_existing_session"
  | "nothing_to_do"
  | "autonomy_below_threshold"
  | "error";

/** Result of an `autoPrepareNextExecutionSession` run, suitable for logging. */
export interface AutoPrepareResult {
  readonly status: AutoPrepareStatus;
  /** Human-readable explanation of what happened. */
  readonly reason: string;
  /** Prepared (or existing live) session id, when applicable. */
  readonly sessionId?: string | null;
  /** Task the run acted on, when applicable. */
  readonly taskId?: string | null;
}

/**
 * Selects the next executable task for a company and prepares an execution
 * session for it, with no UI interaction. This is the unit the scheduler
 * (MUS-205) calls on a loop.
 *
 * Behavior:
 * - Honors autonomy: when the company's autonomy level does not permit
 *   `create_session` without approval (e.g. `manual`), it does not auto-create
 *   and returns `autonomy_below_threshold`.
 * - Idempotent: if the selected task already has a live session, returns
 *   `skipped_existing_session` without creating another.
 * - Returns `nothing_to_do` when no executable task is available.
 *
 * @param companyId - Company to drive.
 * @returns What the run did, including any session/task ids.
 */
export async function autoPrepareNextExecutionSession(
  companyId: string
): Promise<AutoPrepareResult> {
  // Autonomy gate (MUS-214 policy): auto-creation requires that create_session
  // proceeds without an approval checkpoint at the company's level.
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { autonomyLevel: true },
  });
  const decision = authorizeAutonomyAction(
    settings?.autonomyLevel,
    "create_session"
  );
  if (!decision.allowed) {
    return {
      status: "autonomy_below_threshold",
      reason: `Autonomy "${decision.level}" does not permit auto-creating sessions (${decision.disposition}). Recommend only.`,
    };
  }

  // Select the next executable task from approved/applied plans.
  const selection = await selectNextExecutableTaskForCompany(companyId);
  if (!selection.task) {
    return { status: "nothing_to_do", reason: selection.reason };
  }

  const taskId = selection.task.id;

  // Idempotency: do not create a second session for an in-flight task.
  const live = await findLiveSessionForTask(companyId, taskId);
  if (live) {
    return {
      status: "skipped_existing_session",
      reason: `Task ${taskId} already has a live session (${live.status}).`,
      sessionId: live.id,
      taskId,
    };
  }

  const prepared = await prepareExecutionSessionForTask(companyId, taskId);
  if ("error" in prepared) {
    return { status: "error", reason: prepared.error, taskId };
  }

  return {
    status: "prepared",
    reason: `Prepared session ${prepared.sessionId} for task "${selection.task.title}".`,
    sessionId: prepared.sessionId,
    taskId,
  };
}
