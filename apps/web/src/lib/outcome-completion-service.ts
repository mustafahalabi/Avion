/**
 * Outcome Completion Service (MUS-259)
 *
 * Outcomes previously never terminated: nothing wrote a status past
 * `in_delivery`, and `Outcome.completedAt` was never set — a fully shipped
 * outcome looked forever in-flight to the CEO. This service closes the
 * lifecycle:
 *
 * - When the last of an outcome's tasks reaches `done` (the rest may be
 *   cancelled), the outcome becomes `completed` with `completedAt` set, its
 *   runtime request becomes `complete`, and a timeline entry is written.
 * - When a release linked to an outcome is marked released, the outcome
 *   becomes `released` (see `markReleased`).
 *
 * Both callers invoke this best-effort: completion bookkeeping must never
 * break the gate that triggered it.
 */

import { prisma } from "@/lib/prisma";

/** Outcome statuses that are already terminal — never overwritten here. */
export const TERMINAL_OUTCOME_STATUSES: ReadonlySet<string> = new Set([
  "released",
  "completed",
  "archived",
  "cancelled",
  "rejected",
  "failed",
  "superseded",
]);

/** Result of an outcome-completion evaluation, for logging/tests. */
export interface OutcomeCompletionResult {
  /** Outcome the task traced to, or null when the task has none. */
  readonly outcomeId: string | null;
  /** True when this call transitioned the outcome to `completed`. */
  readonly completed: boolean;
  /** Why the outcome was (or wasn't) completed. */
  readonly reason: string;
}

/**
 * Evaluates whether a task's outcome is now fully delivered and, if so, marks
 * it `completed` (+ `completedAt`), completes its runtime request, and writes
 * a timeline entry.
 *
 * An outcome is complete when it has at least one task, every task is `done`
 * or `cancelled`, and at least one is `done`.
 *
 * @param companyId - Company that owns the task (ownership guard).
 * @param taskId - Task whose completion may have finished the outcome.
 * @returns What happened, for logging.
 */
export async function evaluateOutcomeCompletionForTask(
  companyId: string,
  taskId: string
): Promise<OutcomeCompletionResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: {
      outcomeId: true,
      planningDraft: { select: { outcomeId: true } },
    },
  });

  const outcomeId = task?.outcomeId ?? task?.planningDraft?.outcomeId ?? null;
  if (!outcomeId) {
    return { outcomeId: null, completed: false, reason: "Task has no outcome." };
  }

  const outcome = await prisma.outcome.findFirst({
    where: { id: outcomeId, companyId },
    select: { id: true, status: true, title: true, runtimeRequestId: true },
  });
  if (!outcome) {
    return { outcomeId, completed: false, reason: "Outcome not found." };
  }
  if (TERMINAL_OUTCOME_STATUSES.has(outcome.status)) {
    return {
      outcomeId,
      completed: false,
      reason: `Outcome is already terminal ("${outcome.status}").`,
    };
  }

  // Every task belonging to the outcome — directly or via its planning drafts.
  const tasks = await prisma.task.findMany({
    where: {
      companyId,
      OR: [
        { outcomeId },
        { planningDraft: { outcomeId } },
      ],
    },
    select: { status: true },
  });

  if (tasks.length === 0) {
    return { outcomeId, completed: false, reason: "Outcome has no tasks yet." };
  }

  // Best-effort: advance the parent feature when its own tasks have all settled
  // (part (b)) — never let a feature-completion hiccup block outcome bookkeeping.
  await evaluateFeatureCompletionForTask(companyId, taskId).catch(() => {});

  const allSettled = tasks.every(
    (t) => t.status === "done" || t.status === "cancelled"
  );
  const anyDone = tasks.some((t) => t.status === "done");
  if (!allSettled || !anyDone) {
    // Not completable. If no task is still in flight but a permanently-blocked
    // one prevents completion, escalate the outcome to `blocked` so it doesn't
    // sit at `in_delivery` forever; `blocked` is non-terminal, so the CEO
    // unblocking the task lets the outcome complete later (MUS-297).
    const anyBlocked = tasks.some((t) => t.status === "blocked");
    const allSettledOrBlocked = tasks.every(
      (t) =>
        t.status === "done" || t.status === "cancelled" || t.status === "blocked"
    );
    if (allSettledOrBlocked && anyBlocked && outcome.status !== "blocked") {
      const blockedCount = tasks.filter((t) => t.status === "blocked").length;
      await prisma.$transaction(async (tx) => {
        await tx.outcome.updateMany({
          where: { id: outcomeId, companyId },
          data: {
            status: "blocked",
            failureReason: `${blockedCount} task(s) permanently blocked (retries exhausted); delivery can't complete without your input.`,
            updatedAt: new Date(),
          },
        });
        await tx.timelineEntry.create({
          data: {
            entityType: "outcome",
            entityId: outcomeId,
            eventType: "outcome_blocked",
            summary: `Outcome "${outcome.title}" blocked — ${blockedCount} task(s) are permanently blocked.`,
            metadata: JSON.stringify({ blockedCount, triggeredByTaskId: taskId }),
          },
        });
      });
      return {
        outcomeId,
        completed: false,
        reason: `Outcome escalated to blocked: ${blockedCount} task(s) permanently blocked.`,
      };
    }

    const open = tasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled"
    ).length;
    return {
      outcomeId,
      completed: false,
      reason: `Outcome still has ${open} unfinished task(s).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.outcome.updateMany({
      where: { id: outcomeId, companyId },
      data: {
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (outcome.runtimeRequestId) {
      await tx.runtimeRequest.updateMany({
        where: { id: outcome.runtimeRequestId, companyId },
        data: { status: "complete", updatedAt: new Date() },
      });
      await tx.runtimeEvent.create({
        data: {
          requestId: outcome.runtimeRequestId,
          type: "complete",
          description: `All delivery work for "${outcome.title}" is done (review + QA passed).`,
          actor: "System",
        },
      });
    }

    await tx.timelineEntry.create({
      data: {
        entityType: "outcome",
        entityId: outcomeId,
        eventType: "outcome_completed",
        summary: `Outcome "${outcome.title}" completed — all delivery tasks are done.`,
        metadata: JSON.stringify({ taskCount: tasks.length, triggeredByTaskId: taskId }),
      },
    });
  });

  return { outcomeId, completed: true, reason: "All outcome tasks are done." };
}

/** Feature statuses that are already terminal — never overwritten here. */
const TERMINAL_FEATURE_STATUSES: ReadonlySet<string> = new Set([
  "done",
  "shipped",
  "cancelled",
]);

/** Result of a feature-completion evaluation, for logging/tests. */
export interface FeatureCompletionResult {
  readonly featureId: string | null;
  readonly advanced: boolean;
  readonly reason: string;
}

/**
 * Advances a task's parent feature to `done` when all of the feature's tasks are
 * settled (every one `done`/`cancelled`, at least one `done`). Features were
 * created `planned` and never advanced — every task under one could be `done`
 * while the feature read `planned` forever (MUS-297). No-op when the task has no
 * feature, the feature is already terminal, or work remains.
 *
 * @param companyId - Company that owns the task (ownership guard).
 * @param taskId - Task whose completion may have finished its feature.
 * @returns What happened, for logging.
 */
export async function evaluateFeatureCompletionForTask(
  companyId: string,
  taskId: string
): Promise<FeatureCompletionResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: { featureId: true },
  });
  const featureId = task?.featureId ?? null;
  if (!featureId) {
    return { featureId: null, advanced: false, reason: "Task has no feature." };
  }

  const feature = await prisma.feature.findFirst({
    where: { id: featureId, companyId },
    select: { status: true, title: true },
  });
  if (!feature) {
    return { featureId, advanced: false, reason: "Feature not found." };
  }
  if (TERMINAL_FEATURE_STATUSES.has(feature.status)) {
    return {
      featureId,
      advanced: false,
      reason: `Feature is already terminal ("${feature.status}").`,
    };
  }

  const tasks = await prisma.task.findMany({
    where: { companyId, featureId },
    select: { status: true },
  });
  if (tasks.length === 0) {
    return { featureId, advanced: false, reason: "Feature has no tasks." };
  }

  const allSettled = tasks.every(
    (t) => t.status === "done" || t.status === "cancelled"
  );
  const anyDone = tasks.some((t) => t.status === "done");
  if (!allSettled || !anyDone) {
    return { featureId, advanced: false, reason: "Feature still has open tasks." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.feature.updateMany({
      where: { id: featureId, companyId },
      data: { status: "done", updatedAt: new Date() },
    });
    await tx.timelineEntry.create({
      data: {
        entityType: "feature",
        entityId: featureId,
        eventType: "feature_completed",
        summary: `Feature "${feature.title}" completed — all its tasks are done.`,
        metadata: JSON.stringify({ taskCount: tasks.length, triggeredByTaskId: taskId }),
      },
    });
  });

  return { featureId, advanced: true, reason: "All feature tasks are done." };
}

/**
 * Marks an outcome `released` when a linked release ships. Sets `completedAt`
 * when not already set, and writes a timeline entry. No-op for outcomes that
 * are already released/archived/cancelled.
 *
 * @param companyId - Company that owns the release (ownership guard).
 * @param outcomeId - Outcome linked to the released release.
 * @param releaseId - The release that shipped (for the timeline entry).
 */
export async function markOutcomeReleased(
  companyId: string,
  outcomeId: string,
  releaseId: string
): Promise<void> {
  const outcome = await prisma.outcome.findFirst({
    where: { id: outcomeId, companyId },
    select: { id: true, status: true, title: true, completedAt: true },
  });
  if (!outcome) return;
  if (["released", "archived", "cancelled"].includes(outcome.status)) return;

  await prisma.$transaction(async (tx) => {
    await tx.outcome.updateMany({
      where: { id: outcomeId, companyId },
      data: {
        status: "released",
        completedAt: outcome.completedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });
    await tx.timelineEntry.create({
      data: {
        entityType: "outcome",
        entityId: outcomeId,
        eventType: "outcome_released",
        summary: `Outcome "${outcome.title}" released.`,
        metadata: JSON.stringify({ releaseId }),
      },
    });
  });
}
