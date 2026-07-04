/**
 * Mid-flight chat steering (Goal 5b).
 *
 * A CEO follow-up on an outcome that is still being *planned* already regenerates
 * the pending plan (chat-followup-service). But once the plan is APPLIED and work
 * is executing, an appended constraint only reaches a rework brief *if* a rework
 * happens to occur. This module closes that gap: it routes a course-correction
 * into the running loop by opening a **steering change request** on the outcome's
 * active work, which makes the driver re-select that task as rework — and the
 * rework brief already carries the CEO's note (the follow-up appended it to the
 * outcome's brief + constraints).
 *
 * It deliberately targets only NON-terminal tasks (never `done`/`cancelled`), so
 * it respects the done-resurrection guard (MUS-287): steering redirects work in
 * flight, it does not reopen shipped work.
 */

import { prisma } from "@/lib/prisma";
import { recordReviewResult } from "@/lib/review-service";
import { selectSteerableTask } from "@/lib/mid-flight-steering-select";

// The pure selection logic + types live in a Prisma-free module so they stay
// unit-testable in isolation; re-export for existing importers.
export {
  selectSteerableTask,
  STEERABLE_TASK_STATUSES,
  type SteerableTaskInput,
} from "@/lib/mid-flight-steering-select";

/** Title prefix marking a steering review, used for dedup. */
export const STEERING_REVIEW_TITLE_PREFIX = "CEO steer:";

/** Outcome of a steering attempt. */
export interface SteeringResult {
  readonly steered: boolean;
  readonly taskId: string | null;
  readonly taskTitle: string | null;
}

const NOT_STEERED: SteeringResult = { steered: false, taskId: null, taskTitle: null };

/**
 * Routes a CEO course-correction into an in-flight outcome by opening a steering
 * change request on its active task, so the driver reworks it with the note.
 *
 * Deduplicated: if the target task already has an unresolved steering change
 * request, no new one is opened — the follow-up already appended the note to the
 * outcome constraints, so the pending rework will absorb it.
 *
 * @param input - Company, outcome, the CEO's message, and the acting user.
 * @returns Whether a steer was routed, and to which task.
 */
export async function routeSteeringToInFlightWork(input: {
  companyId: string;
  outcomeId: string;
  content: string;
  actorId: string;
}): Promise<SteeringResult> {
  const tasks = await prisma.task.findMany({
    where: {
      companyId: input.companyId,
      OR: [
        { outcomeId: input.outcomeId },
        { planningDraft: { outcomeId: input.outcomeId } },
      ],
    },
    select: { id: true, title: true, status: true, updatedAt: true },
  });

  const target = selectSteerableTask(tasks);
  if (!target) return NOT_STEERED;

  // Dedup: one open steering change request at a time — the outcome constraints
  // accumulate every steer, so the pending rework absorbs them together.
  const existing = await prisma.review.findFirst({
    where: {
      companyId: input.companyId,
      entityType: "task",
      entityId: target.id,
      title: { startsWith: STEERING_REVIEW_TITLE_PREFIX },
      changeRequests: { some: { resolved: false } },
    },
    select: { id: true },
  });
  if (existing) {
    return { steered: true, taskId: target.id, taskTitle: target.title };
  }

  const note = `CEO steer via chat: ${input.content.trim()}`.slice(0, 1000);
  const review = await prisma.review.create({
    data: {
      companyId: input.companyId,
      entityType: "task",
      entityId: target.id,
      title: `${STEERING_REVIEW_TITLE_PREFIX} ${target.title}`,
      status: "pending",
      reviewerId: input.actorId,
    },
  });
  await recordReviewResult({
    companyId: input.companyId,
    reviewId: review.id,
    verdict: "changes_requested",
    notes: note,
    findings: [{ severity: "blocker", description: note, actionable: true }],
  });

  return { steered: true, taskId: target.id, taskTitle: target.title };
}
