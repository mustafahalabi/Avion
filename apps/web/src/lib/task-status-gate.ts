/**
 * Task status boundary gate.
 *
 * The core product invariant — "no task reaches `done` without a recorded
 * approved review AND a passing QA result" — is enforced by the automated loop
 * (`recordReviewResult` / `recordQaResult`), but the UI's raw status dropdown
 * wrote any string straight to the database, bypassing it. Server actions call
 * this gate so the invariant holds at every mutation entry point.
 */

import { prisma } from "@/lib/prisma";

/** Every status a task may hold. Anything else is rejected at the boundary. */
export const TASK_STATUSES = [
  "todo",
  "in-progress",
  "in-review",
  "done",
  "blocked",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Checks whether a raw string is a known task status.
 *
 * @param status - Raw status string from a client.
 * @returns True when the status is one of {@link TASK_STATUSES}.
 */
export function isValidTaskStatus(status: string): status is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(status);
}

/** Result of evaluating a status change against the acceptance gates. */
export interface TaskStatusGateResult {
  /** True when the transition may be written. */
  readonly allowed: boolean;
  /** Human-readable reason when the transition is rejected. */
  readonly reason: string | null;
}

/**
 * Evaluates whether a task's status may be changed to `nextStatus`.
 *
 * Non-`done` statuses are workflow moves and pass freely (after enum
 * validation). Moving to `done` requires the same evidence the automated loop
 * requires: an approved review and a passed QA result for the task.
 *
 * @param companyId - Company that owns the task (ownership guard).
 * @param taskId - Task being updated.
 * @param nextStatus - Requested status.
 * @returns Whether the write may proceed, with a truthful reason when not.
 *
 * @example
 * ```ts
 * const gate = await evaluateTaskStatusChange("cmp_1", "task_1", "done");
 * if (!gate.allowed) return { error: gate.reason };
 * ```
 */
export async function evaluateTaskStatusChange(
  companyId: string,
  taskId: string,
  nextStatus: string
): Promise<TaskStatusGateResult> {
  if (!isValidTaskStatus(nextStatus)) {
    return {
      allowed: false,
      reason: `"${nextStatus}" is not a valid task status.`,
    };
  }

  if (nextStatus !== "done") {
    return { allowed: true, reason: null };
  }

  const [approvedReview, passedQa] = await Promise.all([
    prisma.review.findFirst({
      where: { companyId, entityType: "task", entityId: taskId, status: "approved" },
      select: { id: true },
    }),
    prisma.qAResult.findFirst({
      where: { companyId, entityType: "task", entityId: taskId, status: "passed" },
      select: { id: true },
    }),
  ]);

  if (!approvedReview && !passedQa) {
    return {
      allowed: false,
      reason:
        "A task cannot be marked done without an approved review and a passing QA result. Run the review and QA gates first.",
    };
  }
  if (!approvedReview) {
    return {
      allowed: false,
      reason: "A task cannot be marked done without an approved review.",
    };
  }
  if (!passedQa) {
    return {
      allowed: false,
      reason: "A task cannot be marked done without a passing QA result.",
    };
  }

  return { allowed: true, reason: null };
}
