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
  LiveSessionExistsError,
  findLiveSessionForTask,
  prepareExecutionSession,
} from "@/lib/execution-session-service";
import { assessExecutionReadiness } from "@/lib/repository-readiness-gate";
import {
  generateClaudeImplementationBrief,
  type BriefMemoryItem,
  type BriefRepositoryContext,
  type ReworkContext,
} from "@/lib/implementation-brief";
import { getRelevantCompanyMemory } from "@/lib/memory/memory-retrieval-service";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { selectNextExecutableTaskForCompany } from "@/lib/task-selection-service";
import {
  pickTaskRepository,
  toBriefRepositoryContext,
} from "@/lib/task-repository-context";

// ─── Shared session preparation (manual + automated) ─────────────────────────

/** Successful result of preparing an execution session for a task. */
export interface PrepareTaskExecutionResult {
  readonly sessionId: string;
  readonly brief: string;
  readonly branchName: string;
}

/** Inputs for {@link buildTaskImplementationBrief}. */
export interface BuildTaskBriefInput {
  readonly companyId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly taskDescription: string | null;
  readonly priority: string;
  readonly planningDraftId: string | null;
  readonly planItemId: string | null;
  readonly generatedTasksJson: string | null;
  readonly repository: BriefRepositoryContext | null;
  readonly branchName: string | null;
  readonly baseBranch: string | null;
  readonly linearTicketUrl: string | null;
  readonly reworkContext?: ReworkContext | null;
}

/**
 * Assembles a Claude implementation brief for a task, injecting the company's
 * durable memory (promoted standards + lessons) as the "Company Standards &
 * Lessons" section (MUS-258).
 *
 * This is the single brief builder shared by the production prepare path
 * ({@link prepareExecutionSessionForTask}) and the live/e2e dogfood scripts, so
 * a dogfood run exercises the SAME memory-carrying brief production uses rather
 * than a hand-rolled brief that silently omits memory (MUS-273).
 *
 * Memory retrieval is best-effort: a failure yields an empty memory section and
 * never blocks the brief.
 *
 * @param input - Task, repository, branch, and rework context for the brief.
 * @returns The assembled brief markdown and the resolved branch name.
 */
export async function buildTaskImplementationBrief(
  input: BuildTaskBriefInput
): Promise<{ readonly brief: string; readonly branchName: string }> {
  // Durable company memory (promoted standards + lessons) flows into the
  // implementation brief so the coding agent applies what the company already
  // learned. Best-effort: a memory failure never blocks execution.
  let companyMemory: BriefMemoryItem[] = [];
  try {
    const memory = await getRelevantCompanyMemory({
      companyId: input.companyId,
      limit: 8,
    });
    companyMemory = memory.map((item) => ({
      category: item.category,
      content: item.content,
    }));
  } catch {
    companyMemory = [];
  }

  // Company culture (CompanySettings.cultureProfile) biases the implementation
  // (MUS-288). Best-effort, like memory: a failure or unset culture just omits
  // the culture section.
  let cultureProfile: string | null = null;
  try {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId: input.companyId },
      select: { cultureProfile: true },
    });
    cultureProfile = settings?.cultureProfile ?? null;
  } catch {
    cultureProfile = null;
  }

  return generateClaudeImplementationBrief({
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    priority: input.priority,
    planningDraftId: input.planningDraftId,
    planItemId: input.planItemId,
    generatedTasksJson: input.generatedTasksJson,
    repository: input.repository,
    branchName: input.branchName,
    baseBranch: input.baseBranch,
    linearTicketUrl: input.linearTicketUrl,
    reworkContext: input.reworkContext ?? null,
    companyMemory,
    cultureProfile,
  });
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
): Promise<
  | PrepareTaskExecutionResult
  | { readonly error: string }
  | { readonly skippedExistingSessionId: string }
> {
  // `repository` is the explicit Project→Repository link (the chosen repo); the
  // `workspace.repositories` include is the legacy "first repo in the workspace"
  // fallback for pre-link projects.
  const repoInclude = {
    repository: true,
    workspace: {
      include: {
        repositories: { take: 1, orderBy: { updatedAt: "desc" as const } },
      },
    },
  };
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    include: {
      planningDraft: { select: { id: true, generatedTasks: true } },
      project: { include: repoInclude },
      // AI-planned tasks are attached to a feature (no direct project), so resolve the
      // repository via the feature's project as a fallback — without this, applied-plan
      // tasks could never find a repo to run against.
      feature: { include: { project: { include: repoInclude } } },
    },
  });

  if (!task) return { error: "Task not found." };

  const repoRow = pickTaskRepository({
    projectRepository: task.project?.repository,
    featureProjectRepository: task.feature?.project?.repository,
    projectWorkspaceRepositories: task.project?.workspace?.repositories,
    featureProjectWorkspaceRepositories:
      task.feature?.project?.workspace?.repositories,
  });
  const resolvedProjectId = task.projectId ?? task.feature?.projectId ?? null;
  const repo = repoRow ? toBriefRepositoryContext(repoRow) : null;

  // Rework support: unresolved change requests (review / QA / PR feedback)
  // enter the brief as a "Rework Required" section, and the prior session's
  // branch is reused so the fixes land on the same pull request.
  const openChangeRequests = await prisma.changeRequest.findMany({
    where: {
      resolved: false,
      review: { companyId, entityType: "task", entityId: taskId },
    },
    orderBy: { createdAt: "asc" },
    select: { reason: true, requestedBy: true },
  });
  const priorSession =
    openChangeRequests.length > 0
      ? await prisma.executionSession.findFirst({
          where: { companyId, taskId, branchName: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { branchName: true, prUrl: true, baseBranch: true },
        })
      : null;
  const reworkContext: ReworkContext | null =
    openChangeRequests.length > 0
      ? {
          changeRequests: openChangeRequests,
          priorPrUrl: priorSession?.prUrl ?? null,
        }
      : null;

  const { brief, branchName } = await buildTaskImplementationBrief({
    companyId,
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description ?? null,
    priority: task.priority,
    planningDraftId: task.planningDraftId ?? null,
    planItemId: task.planItemId ?? null,
    generatedTasksJson: task.planningDraft?.generatedTasks ?? null,
    repository: repo,
    branchName: priorSession?.branchName ?? null,
    // Null on a first run → the worker resolves the repo's real default branch
    // (main vs master); a rework reuses the prior session's base (MUS-282).
    baseBranch: priorSession?.baseBranch ?? null,
    linearTicketUrl: null,
    reworkContext,
  });

  let session;
  try {
    session = await createExecutionSession({
      companyId,
      taskId: task.id,
      taskTitle: task.title,
      projectId: resolvedProjectId,
      repositoryId: repoRow?.id ?? null,
      planningDraftId: task.planningDraftId ?? null,
      // agentType intentionally omitted: the company's configured default
      // (CompanySettings.defaultAgentType, null → "claude_code") applies.
      branchName,
      baseBranch: priorSession?.baseBranch ?? null,
    });
  } catch (err) {
    // Lost an atomic idempotency race with a concurrent preparer — a live
    // session already exists for this task. Treat it as "already prepared"
    // (MUS-294), not an error: nothing was double-created.
    if (err instanceof LiveSessionExistsError) {
      return { skippedExistingSessionId: err.existingSessionId };
    }
    throw err;
  }

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
  | "blocked_repository"
  | "retries_exhausted"
  | "retry_backoff"
  | "error";

// ─── Retry policy ────────────────────────────────────────────────────────────

/**
 * Number of retries permitted after a task's first failed session (i.e. a task
 * gets `1 + WORKER_MAX_RETRIES` consecutive failed attempts before it is
 * blocked and surfaced to the CEO). Counted since the last completed session,
 * so a rework cycle starts with a fresh budget.
 */
function maxRetriesAfterFirstFailure(): number {
  const parsed = Number(process.env.WORKER_MAX_RETRIES ?? 1);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

/** Base backoff between failed attempts; doubles per failure, capped at 15 min. */
function retryBackoffBaseSeconds(): number {
  const parsed = Number(process.env.WORKER_RETRY_BACKOFF_BASE_SECONDS ?? 60);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
}

const RETRY_BACKOFF_CAP_SECONDS = 900;

/** Consecutive-failure state for a task's retry decision. */
export interface TaskRetryState {
  /**
   * Failed delivery cycles since the last passed QA (or ever, when none): failed
   * execution sessions (no-op/error) plus failed QA gates (committed-but-QA-failed).
   */
  readonly consecutiveFailures: number;
  /** True when the failure budget is exhausted and the task must be blocked. */
  readonly exhausted: boolean;
  /** True when a retry is allowed but its backoff window has not elapsed. */
  readonly inBackoff: boolean;
  /** Seconds remaining in the backoff window (0 when not in backoff). */
  readonly backoffRemainingSeconds: number;
}

/**
 * Assesses whether a task may receive another execution attempt.
 *
 * A "failed attempt" is any delivery cycle that did NOT clear the gates, counted
 * since the last **passed QA** (the real "this delivery succeeded" signal):
 * - a **failed execution session** (a no-op run, or an error), and
 * - a **failed QA result** — a session that committed and reached QA but then
 *   failed it.
 *
 * Anchoring on the last passed QA (rather than the last *completed session*) is the
 * MUS-279 fix: a committing rework that fails QA ingests as a `completed` session,
 * which previously reset the budget — so only no-op reworks were bounded and a
 * rework that kept committing wrong-but-non-empty fixes could loop forever without
 * escalating. Counting failed QA gates makes both kinds of rework bounded.
 *
 * Backoff doubles per consecutive failure (base `WORKER_RETRY_BACKOFF_BASE_SECONDS`,
 * default 60s, capped at 15 minutes), timed from the most recent failure signal.
 *
 * @param companyId - Company that owns the task.
 * @param taskId - Task being considered for a new session.
 * @param now - Current time (injectable for tests).
 * @returns The retry state used to gate session preparation.
 */
export async function assessTaskRetryState(
  companyId: string,
  taskId: string,
  now: Date = new Date()
): Promise<TaskRetryState> {
  const lastPassedQa = await prisma.qAResult.findFirst({
    where: { companyId, entityType: "task", entityId: taskId, status: "passed" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = lastPassedQa?.createdAt ?? null;

  const failedSessionWhere = {
    companyId,
    taskId,
    status: "failed",
    ...(since ? { completedAt: { gt: since } } : {}),
  };
  const failedQaWhere = {
    companyId,
    entityType: "task",
    entityId: taskId,
    status: "failed",
    ...(since ? { createdAt: { gt: since } } : {}),
  };

  const [failedSessions, failedQa, latestFailedSession, latestFailedQa] =
    await Promise.all([
      prisma.executionSession.count({ where: failedSessionWhere }),
      prisma.qAResult.count({ where: failedQaWhere }),
      prisma.executionSession.findFirst({
        where: failedSessionWhere,
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
      prisma.qAResult.findFirst({
        where: failedQaWhere,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  const consecutiveFailures = failedSessions + failedQa;
  const exhausted = consecutiveFailures > maxRetriesAfterFirstFailure();

  // Backoff runs from whichever failure signal is most recent.
  const latestFailureAt =
    [latestFailedSession?.completedAt, latestFailedQa?.createdAt]
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  if (exhausted || consecutiveFailures === 0 || !latestFailureAt) {
    return {
      consecutiveFailures,
      exhausted,
      inBackoff: false,
      backoffRemainingSeconds: 0,
    };
  }

  const backoffSeconds = Math.min(
    retryBackoffBaseSeconds() * 2 ** (consecutiveFailures - 1),
    RETRY_BACKOFF_CAP_SECONDS
  );
  const elapsedSeconds = (now.getTime() - latestFailureAt.getTime()) / 1000;
  const remaining = Math.ceil(backoffSeconds - elapsedSeconds);

  return {
    consecutiveFailures,
    exhausted: false,
    inBackoff: remaining > 0,
    backoffRemainingSeconds: Math.max(remaining, 0),
  };
}

/**
 * Blocks a task whose retry budget is exhausted and notifies the CEO.
 * Best-effort on the notification/timeline — the block itself always applies.
 *
 * @param companyId - Company that owns the task.
 * @param taskId - Task to block.
 * @param consecutiveFailures - Failure count that exhausted the budget.
 */
async function blockTaskAfterExhaustedRetries(
  companyId: string,
  taskId: string,
  consecutiveFailures: number
): Promise<void> {
  await prisma.task.updateMany({
    where: { id: taskId, companyId, status: { notIn: ["done", "cancelled"] } },
    data: { status: "blocked", updatedAt: new Date() },
  });

  try {
    await prisma.timelineEntry.create({
      data: {
        entityType: "task",
        entityId: taskId,
        eventType: "execution_retries_exhausted",
        summary: `Blocked after ${consecutiveFailures} consecutive failed execution attempts.`,
        metadata: JSON.stringify({ consecutiveFailures }),
      },
    });
  } catch {
    // Timeline writes are best-effort.
  }

  try {
    const [company, task] = await Promise.all([
      prisma.company.findFirst({
        where: { id: companyId },
        select: { ownerId: true },
      }),
      prisma.task.findFirst({
        where: { id: taskId, companyId },
        select: { title: true },
      }),
    ]);
    if (!company) return;
    await notify({
      userId: company.ownerId,
      companyId,
      title: "Task blocked: retries exhausted",
      body: `"${task?.title ?? taskId}" failed ${consecutiveFailures} execution attempts in a row and needs your attention.`,
      type: "blocker",
      priority: "urgent",
      entityType: "task",
      entityId: taskId,
      actionUrl: `/work/tasks/${taskId}`,
    });
  } catch {
    // Notifications are best-effort.
  }
}

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

  // Bounded retries (MUS-252): a task whose consecutive failures exhausted the
  // budget is blocked and surfaced to the CEO instead of burning agent runs
  // forever; a permitted retry still waits out its backoff window.
  const retry = await assessTaskRetryState(companyId, taskId);
  if (retry.exhausted) {
    await blockTaskAfterExhaustedRetries(
      companyId,
      taskId,
      retry.consecutiveFailures
    );
    return {
      status: "retries_exhausted",
      reason: `Task ${taskId} failed ${retry.consecutiveFailures} consecutive execution attempts; blocked and escalated to the CEO.`,
      taskId,
    };
  }
  if (retry.inBackoff) {
    return {
      status: "retry_backoff",
      reason: `Task ${taskId} is in retry backoff for another ${retry.backoffRemainingSeconds}s (failure ${retry.consecutiveFailures}).`,
      taskId,
    };
  }

  // Fail-fast on bad environments (close-the-loop): don't launch an autonomous run
  // against a repository we can't validate. Only a "blocked" readiness halts here;
  // "partial"/"unknown" still proceed.
  const workspaceRepoSelect = {
    workspace: {
      select: {
        repositories: {
          take: 1,
          orderBy: { updatedAt: "desc" as const },
          select: { id: true },
        },
      },
    },
  };
  const taskRepo = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: {
      // Explicit Project→Repository link first, with the workspace-first-repo
      // fallback (matching prepareExecutionSessionForTask's precedence).
      project: {
        select: { repositoryId: true, ...workspaceRepoSelect },
      },
      feature: {
        select: {
          project: {
            select: { repositoryId: true, ...workspaceRepoSelect },
          },
        },
      },
    },
  });
  const repositoryId =
    taskRepo?.project?.repositoryId ??
    taskRepo?.feature?.project?.repositoryId ??
    taskRepo?.project?.workspace?.repositories?.[0]?.id ??
    taskRepo?.feature?.project?.workspace?.repositories?.[0]?.id ??
    null;
  const readiness = await assessExecutionReadiness({ companyId, repositoryId });
  if (!readiness.ready) {
    return {
      status: "blocked_repository",
      reason: `Repository not ready for execution (${readiness.readiness}): ${
        readiness.reasons.join("; ") || "blocked"
      }`,
      taskId,
    };
  }

  const prepared = await prepareExecutionSessionForTask(companyId, taskId);
  if ("skippedExistingSessionId" in prepared) {
    return {
      status: "skipped_existing_session",
      reason: `Task ${taskId} already has a live session (created concurrently); skipped.`,
      sessionId: prepared.skippedExistingSessionId,
      taskId,
    };
  }
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
