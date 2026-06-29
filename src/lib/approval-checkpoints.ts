/**
 * Approval Checkpoints
 *
 * At sub-threshold autonomy the gate-advancement service halts a task at a
 * review or QA checkpoint instead of auto-advancing (see `gate-advancement-
 * service` and `autonomy-policy`). The pause is *persisted* as a pending
 * `Review` / `QAResult` row — this module reads those rows as the CEO's
 * "needs your decision" queue and resumes the flow when the CEO approves
 * (or sends it back on reject), always through the real review/QA services so
 * no gate is bypassed.
 */

import { prisma } from "@/lib/prisma";
import { recordQaResult, type RecordQaResultOutput } from "@/lib/qa-service";
import {
  recordReviewResult,
  type RecordReviewResultOutput,
} from "@/lib/review-service";

/** A task paused at a review or QA gate, awaiting a CEO decision. */
export interface PendingCheckpoint {
  readonly kind: "review" | "qa";
  /** Review ID or QAResult ID. */
  readonly id: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly createdAt: Date;
}

/**
 * Lists the tasks currently paused at a review or QA checkpoint for a company.
 *
 * A checkpoint is a pending `Review` or pending `QAResult` whose task is still
 * `in-review` (i.e. genuinely waiting on a human, not already advanced).
 *
 * @param companyId - Company to scope to.
 * @returns Pending checkpoints, newest first (reviews before QA).
 */
export async function listPendingCheckpoints(
  companyId: string
): Promise<PendingCheckpoint[]> {
  const [reviews, qas] = await Promise.all([
    prisma.review.findMany({
      where: { companyId, entityType: "task", status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true, entityId: true, createdAt: true },
    }),
    prisma.qAResult.findMany({
      where: { companyId, entityType: "task", status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true, entityId: true, createdAt: true },
    }),
  ]);

  const taskIds = [
    ...new Set([
      ...reviews.map((r) => r.entityId),
      ...qas.map((q) => q.entityId),
    ]),
  ];
  if (taskIds.length === 0) return [];

  const tasks = await prisma.task.findMany({
    where: { companyId, id: { in: taskIds } },
    select: { id: true, title: true, status: true },
  });
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  const inReview = new Set(
    tasks.filter((t) => t.status === "in-review").map((t) => t.id)
  );

  const out: PendingCheckpoint[] = [];
  for (const r of reviews) {
    if (!inReview.has(r.entityId)) continue;
    out.push({
      kind: "review",
      id: r.id,
      taskId: r.entityId,
      taskTitle: titleOf.get(r.entityId) ?? r.entityId,
      createdAt: r.createdAt,
    });
  }
  for (const q of qas) {
    if (!inReview.has(q.entityId)) continue;
    out.push({
      kind: "qa",
      id: q.id,
      taskId: q.entityId,
      taskTitle: titleOf.get(q.entityId) ?? q.entityId,
      createdAt: q.createdAt,
    });
  }
  return out;
}

/** Number of pending checkpoints (for badges). */
export async function countPendingCheckpoints(companyId: string): Promise<number> {
  return (await listPendingCheckpoints(companyId)).length;
}

/**
 * Approves a pending review checkpoint — records an `approved` verdict, which
 * resumes the flow (creates the pending QA step).
 *
 * @param companyId - Owning company.
 * @param reviewId - Review to approve.
 */
export async function approveReviewCheckpoint(
  companyId: string,
  reviewId: string
): Promise<RecordReviewResultOutput> {
  return recordReviewResult({
    companyId,
    reviewId,
    verdict: "approved",
    notes: "Approved by CEO.",
    findings: [],
  });
}

/**
 * Rejects a pending review checkpoint — records `changes_requested`, sending the
 * task back to implementation.
 *
 * @param companyId - Owning company.
 * @param reviewId - Review to reject.
 * @param notes - Optional reason.
 */
export async function rejectReviewCheckpoint(
  companyId: string,
  reviewId: string,
  notes = "Changes requested by CEO."
): Promise<RecordReviewResultOutput> {
  return recordReviewResult({
    companyId,
    reviewId,
    verdict: "changes_requested",
    notes,
    findings: [],
  });
}

/**
 * Approves a pending QA checkpoint — marks the stored checklist items passed and
 * records a `passed` verdict (still gated by `recordQaResult`, which requires an
 * approved review), completing the task.
 *
 * @param companyId - Owning company.
 * @param qaResultId - QAResult to pass.
 */
export async function approveQaCheckpoint(
  companyId: string,
  qaResultId: string
): Promise<RecordQaResultOutput> {
  const qa = await prisma.qAResult.findFirst({
    where: { id: qaResultId, companyId },
    select: { checks: true },
  });
  if (!qa) {
    throw new Error(`QA result "${qaResultId}" not found or inaccessible.`);
  }

  await prisma.qAResult.update({
    where: { id: qaResultId },
    data: { checks: markAllChecksPassed(qa.checks) },
  });

  return recordQaResult({
    companyId,
    qaResultId,
    verdict: "passed",
    notes: "Approved by CEO.",
    findings: [],
  });
}

/** Returns the checks JSON with every item marked `passed: true`. */
function markAllChecksPassed(checksJson: string): string {
  try {
    const parsed = JSON.parse(checksJson) as unknown;
    if (!Array.isArray(parsed)) return checksJson;
    const passed = parsed.map((item) =>
      item && typeof item === "object"
        ? { ...(item as Record<string, unknown>), passed: true }
        : item
    );
    return JSON.stringify(passed);
  } catch {
    return checksJson;
  }
}
