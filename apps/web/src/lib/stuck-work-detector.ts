import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StuckWorkCategory =
  | "task_stuck_in_review"
  | "task_stuck_in_qa"
  | "task_stuck_in_execution"
  | "plan_awaiting_approval"
  | "failed_execution_loop"
  | "failed_validation_loop";

export type StuckWorkSeverity = "high" | "medium" | "low";

export interface StuckWorkItem {
  readonly category: StuckWorkCategory;
  readonly severity: StuckWorkSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly linkPath: string;
  readonly entityId: string;
  readonly entityType: "task" | "planning_draft" | "execution_session";
  readonly stuckSinceMs: number;
}

export interface DetectStuckWorkInput {
  readonly companyId: string;
  /** Hours a task must be in a stuck status before flagging. Default: 24 */
  readonly reviewThresholdHours?: number;
  readonly executionThresholdHours?: number;
}

export interface DetectStuckWorkOutput {
  readonly items: readonly StuckWorkItem[];
  readonly checkedAt: Date;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const DEFAULT_REVIEW_THRESHOLD_HOURS = 24;
const DEFAULT_EXECUTION_THRESHOLD_HOURS = 48;

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * Scans company work records for stuck tasks, stale approvals, and failed loops.
 * Returns a prioritized list of actionable intelligence items.
 * This function is read-only — it never mutates any records.
 */
export async function detectStuckWork(
  input: DetectStuckWorkInput
): Promise<DetectStuckWorkOutput> {
  const reviewThresholdMs =
    (input.reviewThresholdHours ?? DEFAULT_REVIEW_THRESHOLD_HOURS) * 60 * 60 * 1000;
  const executionThresholdMs =
    (input.executionThresholdHours ?? DEFAULT_EXECUTION_THRESHOLD_HOURS) * 60 * 60 * 1000;

  const now = new Date();

  const [
    inReviewTasks,
    blockedTasks,
    inProgressTasks,
    pendingDrafts,
    failedSessions,
  ] = await Promise.all([
    // Tasks stuck in review
    prisma.task.findMany({
      where: {
        companyId: input.companyId,
        status: "in-review",
        updatedAt: { lte: new Date(now.getTime() - reviewThresholdMs) },
      },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    }),

    // Tasks blocked (long-blocked)
    prisma.task.findMany({
      where: {
        companyId: input.companyId,
        status: "blocked",
        updatedAt: { lte: new Date(now.getTime() - reviewThresholdMs) },
      },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    }),

    // Tasks in-progress with an active execution session that may be stuck
    prisma.executionSession.findMany({
      where: {
        companyId: input.companyId,
        status: { in: ["queued", "running"] },
        createdAt: { lte: new Date(now.getTime() - executionThresholdMs) },
      },
      select: { id: true, taskId: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),

    // Planning drafts awaiting approval (draft or reviewing status, not recently updated)
    prisma.planningDraft.findMany({
      where: {
        companyId: input.companyId,
        status: { in: ["draft", "reviewing"] },
        updatedAt: { lte: new Date(now.getTime() - reviewThresholdMs) },
      },
      select: { id: true, title: true, updatedAt: true, outcomeId: true },
      orderBy: { updatedAt: "asc" },
    }),

    // Sessions that failed or completed with errors
    prisma.executionSession.findMany({
      where: {
        companyId: input.companyId,
        status: "failed",
        completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }, // last 7 days
      },
      select: {
        id: true,
        taskId: true,
        errorMessage: true,
        completedAt: true,
        validationOutput: true,
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
  ]);

  const items: StuckWorkItem[] = [];

  // ── Tasks stuck in review ───────────────────────────────────────────────────
  for (const task of inReviewTasks) {
    const stuckSinceMs = now.getTime() - task.updatedAt.getTime();
    items.push({
      category: "task_stuck_in_review",
      severity: stuckSinceMs > reviewThresholdMs * 3 ? "high" : "medium",
      title: `Task stuck in review: "${task.title}"`,
      description: `This task has been waiting for review for ${formatDuration(stuckSinceMs)} without progress.`,
      recommendation: "Assign a reviewer or move the task back to in-progress if review is not imminent.",
      linkPath: `/work/tasks/${task.id}`,
      entityId: task.id,
      entityType: "task",
      stuckSinceMs,
    });
  }

  // ── Tasks stuck blocked ─────────────────────────────────────────────────────
  for (const task of blockedTasks) {
    const stuckSinceMs = now.getTime() - task.updatedAt.getTime();
    items.push({
      category: "task_stuck_in_review",
      severity: "high",
      title: `Task blocked: "${task.title}"`,
      description: `This task has been blocked for ${formatDuration(stuckSinceMs)}. The blocker may need CEO or team attention.`,
      recommendation: "Investigate the blocker and either resolve it or cancel the task.",
      linkPath: `/work/tasks/${task.id}`,
      entityId: task.id,
      entityType: "task",
      stuckSinceMs,
    });
  }

  // ── Execution sessions stuck running ────────────────────────────────────────
  for (const session of inProgressTasks) {
    const stuckSinceMs = now.getTime() - session.createdAt.getTime();
    items.push({
      category: "task_stuck_in_execution",
      severity: stuckSinceMs > executionThresholdMs * 2 ? "high" : "medium",
      title: `Execution session stuck: ${session.status}`,
      description: `An execution session has been ${session.status} for ${formatDuration(stuckSinceMs)} without completing.`,
      recommendation: "Check if the agent is still running. If the session is orphaned, record it as failed.",
      linkPath: session.taskId ? `/work/tasks/${session.taskId}` : `/work`,
      entityId: session.id,
      entityType: "execution_session",
      stuckSinceMs,
    });
  }

  // ── Plans awaiting CEO approval ─────────────────────────────────────────────
  for (const draft of pendingDrafts) {
    const stuckSinceMs = now.getTime() - draft.updatedAt.getTime();
    items.push({
      category: "plan_awaiting_approval",
      severity: stuckSinceMs > reviewThresholdMs * 3 ? "high" : "medium",
      title: `Plan awaiting approval: "${draft.title}"`,
      description: `This planning draft has been waiting for CEO approval for ${formatDuration(stuckSinceMs)}.`,
      recommendation: "Review and approve the plan to unblock implementation, or reject it with clear feedback.",
      linkPath: `/inbox`,
      entityId: draft.id,
      entityType: "planning_draft",
      stuckSinceMs,
    });
  }

  // ── Failed execution loops ───────────────────────────────────────────────────
  for (const session of failedSessions) {
    const isValidationFailure =
      session.validationOutput !== null &&
      (session.validationOutput.includes("error") ||
        session.validationOutput.includes("failed") ||
        session.validationOutput.includes("FAIL"));

    const completedMs = session.completedAt
      ? now.getTime() - session.completedAt.getTime()
      : 0;

    items.push({
      category: isValidationFailure ? "failed_validation_loop" : "failed_execution_loop",
      severity: "high",
      title: isValidationFailure
        ? "Validation failure in execution session"
        : "Execution session failed",
      description: isValidationFailure
        ? `An execution session failed validation checks. ${session.errorMessage ? `Error: ${session.errorMessage.slice(0, 120)}` : ""}`
        : `An execution session failed. ${session.errorMessage ? `Error: ${session.errorMessage.slice(0, 120)}` : ""}`,
      recommendation: isValidationFailure
        ? "Review the validation output and fix the root cause before re-attempting."
        : "Investigate the failure, fix the underlying issue, and re-run the execution session.",
      linkPath: session.taskId ? `/work/tasks/${session.taskId}` : `/work`,
      entityId: session.id,
      entityType: "execution_session",
      stuckSinceMs: completedMs,
    });
  }

  // Sort by severity (high → medium → low), then by stuckSinceMs (longest first)
  const severityOrder: Record<StuckWorkSeverity, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.stuckSinceMs - a.stuckSinceMs;
  });

  return { items, checkedAt: now };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}
