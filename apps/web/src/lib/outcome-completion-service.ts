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
const TERMINAL_OUTCOME_STATUSES = new Set([
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

  const allSettled = tasks.every(
    (t) => t.status === "done" || t.status === "cancelled"
  );
  const anyDone = tasks.some((t) => t.status === "done");
  if (!allSettled || !anyDone) {
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
