import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewVerdict =
  | "approved"
  | "changes_requested"
  | "blocked"
  | "needs_clarification";

export interface ReviewFinding {
  readonly severity: "blocker" | "non_blocker";
  readonly description: string;
  readonly actionable: boolean;
}

export interface RecordReviewResultInput {
  readonly companyId: string;
  readonly reviewId: string;
  readonly verdict: ReviewVerdict;
  readonly notes: string | null;
  readonly findings?: readonly ReviewFinding[];
}

export interface RecordReviewResultOutput {
  readonly reviewId: string;
  readonly verdict: ReviewVerdict;
  readonly taskId: string | null;
  /** Created QAResult ID when verdict is approved and the linked entity is a task. */
  readonly qaResultId: string | null;
  /** Created ChangeRequest IDs when verdict is changes_requested. */
  readonly changeRequestIds: readonly string[];
  readonly timelineEntryId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const REVIEW_VERDICTS: readonly ReviewVerdict[] = [
  "approved",
  "changes_requested",
  "blocked",
  "needs_clarification",
];

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Records a review verdict and routes work to the next state.
 *
 * Side effects by verdict:
 * - approved: creates pending QAResult, keeps task at in-review, emits timeline event.
 * - changes_requested: creates ChangeRequests from blocker findings, moves task to
 *   in-progress, emits timeline event.
 * - blocked: moves task to blocked, emits timeline event.
 * - needs_clarification: leaves task unchanged, emits timeline event.
 *
 * @throws When review is not found or does not belong to companyId.
 * @throws When review is already in a terminal state (approved).
 */
export async function recordReviewResult(
  input: RecordReviewResultInput
): Promise<RecordReviewResultOutput> {
  const { companyId, reviewId, verdict, notes, findings = [] } = input;

  const review = await prisma.review.findFirst({
    where: { id: reviewId, companyId },
  });
  if (!review) {
    throw new Error(`Review "${reviewId}" not found or inaccessible.`);
  }
  if (review.status === "approved") {
    throw new Error(
      `Review "${reviewId}" is already approved and cannot be updated.`
    );
  }

  const findingsJson = JSON.stringify(findings);
  const taskId = review.entityType === "task" ? review.entityId : null;

  let qaResultId: string | null = null;
  const changeRequestIds: string[] = [];
  let timelineEntryId: string;

  if (verdict === "approved") {
    // Update review
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "approved",
        verdict: "approved",
        notes: notes ?? undefined,
        findings: findingsJson,
        updatedAt: new Date(),
      },
    });

    // Move task to in-review (approved; QA step follows)
    if (taskId) {
      await prisma.task.updateMany({
        where: {
          id: taskId,
          companyId,
          status: { notIn: ["done", "cancelled"] },
        },
        data: { status: "in-review", updatedAt: new Date() },
      });

      // Create pending QA result so the QA step can begin
      const qa = await prisma.qAResult.create({
        data: {
          companyId,
          entityType: "task",
          entityId: taskId,
          status: "pending",
        },
      });
      qaResultId = qa.id;
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: review.entityType,
        entityId: review.entityId,
        eventType: "review_approved",
        summary: notes ? `Review approved: ${notes.slice(0, 120)}` : "Review approved.",
        metadata: JSON.stringify({ reviewId, verdict }),
      },
    });
    timelineEntryId = entry.id;
  } else if (verdict === "changes_requested") {
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "changes_requested",
        verdict: "changes_requested",
        notes: notes ?? undefined,
        changeRequestNotes: notes ?? undefined,
        findings: findingsJson,
        updatedAt: new Date(),
      },
    });

    // Create a ChangeRequest for each blocker finding, or one from notes
    const blockers = findings.filter((f) => f.severity === "blocker");
    if (blockers.length > 0) {
      for (const blocker of blockers) {
        const cr = await prisma.changeRequest.create({
          data: {
            reviewId,
            reason: blocker.description,
            requestedBy: "Reviewer",
          },
        });
        changeRequestIds.push(cr.id);
      }
    } else if (notes) {
      const cr = await prisma.changeRequest.create({
        data: {
          reviewId,
          reason: notes,
          requestedBy: "Reviewer",
        },
      });
      changeRequestIds.push(cr.id);
    }

    // Return task to implementation
    if (taskId) {
      await prisma.task.updateMany({
        where: { id: taskId, companyId },
        data: { status: "in-progress", updatedAt: new Date() },
      });
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: review.entityType,
        entityId: review.entityId,
        eventType: "review_changes_requested",
        summary: notes
          ? `Changes requested: ${notes.slice(0, 120)}`
          : `Changes requested (${blockers.length} blocker${blockers.length !== 1 ? "s" : ""}).`,
        metadata: JSON.stringify({ reviewId, verdict, blockerCount: blockers.length }),
      },
    });
    timelineEntryId = entry.id;
  } else if (verdict === "blocked") {
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "blocked",
        verdict: "blocked",
        notes: notes ?? undefined,
        findings: findingsJson,
        updatedAt: new Date(),
      },
    });

    if (taskId) {
      await prisma.task.updateMany({
        where: { id: taskId, companyId },
        data: { status: "blocked", updatedAt: new Date() },
      });
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: review.entityType,
        entityId: review.entityId,
        eventType: "review_blocked",
        summary: notes ? `Review blocked: ${notes.slice(0, 120)}` : "Review blocked.",
        metadata: JSON.stringify({ reviewId, verdict }),
      },
    });
    timelineEntryId = entry.id;
  } else {
    // needs_clarification
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "needs_clarification",
        verdict: "needs_clarification",
        notes: notes ?? undefined,
        findings: findingsJson,
        updatedAt: new Date(),
      },
    });

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: review.entityType,
        entityId: review.entityId,
        eventType: "review_needs_clarification",
        summary: notes
          ? `Needs clarification: ${notes.slice(0, 120)}`
          : "Review needs clarification.",
        metadata: JSON.stringify({ reviewId, verdict }),
      },
    });
    timelineEntryId = entry.id;
  }

  return {
    reviewId,
    verdict,
    taskId,
    qaResultId,
    changeRequestIds,
    timelineEntryId,
  };
}
