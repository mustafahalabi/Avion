import { evaluateOutcomeCompletionForTask } from "@/lib/outcome-completion-service";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QaVerdict = "passed" | "failed" | "blocked" | "needs_clarification";

export interface QaFinding {
  readonly severity: "blocker" | "non_blocker";
  readonly description: string;
  readonly actionable: boolean;
}

export interface RecordQaResultInput {
  readonly companyId: string;
  readonly qaResultId: string;
  readonly verdict: QaVerdict;
  readonly notes: string | null;
  readonly findings?: readonly QaFinding[];
}

export interface RecordQaResultOutput {
  readonly qaResultId: string;
  readonly verdict: QaVerdict;
  readonly taskId: string | null;
  /** Created ChangeRequest IDs when verdict is failed with actionable findings. */
  readonly changeRequestIds: readonly string[];
  readonly timelineEntryId: string;
  /** True when passed was requested but required checks did not all pass. */
  readonly completionBlocked: boolean;
}

interface StoredCheck {
  label: string;
  passed: boolean;
  category?: string;
  actionable?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const QA_VERDICTS: readonly QaVerdict[] = [
  "passed",
  "failed",
  "blocked",
  "needs_clarification",
];

const TERMINAL_QA_STATUSES = new Set(["passed", "failed", "blocked"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses stored checks JSON into a normalized checklist array.
 *
 * @param checksJson - Raw checks column value from QAResult.
 * @returns Parsed checklist items; empty array when JSON is invalid.
 */
function parseStoredChecks(checksJson: string): StoredCheck[] {
  try {
    const parsed = JSON.parse(checksJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredCheck =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as StoredCheck).label === "string" &&
        typeof (item as StoredCheck).passed === "boolean"
    );
  } catch {
    return [];
  }
}

/**
 * Counts passed and failed checklist items.
 *
 * @param checks - Parsed checklist items.
 * @returns Passed and failed counts.
 */
function countChecks(checks: readonly StoredCheck[]): { passed: number; failed: number } {
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  return { passed, failed };
}

/**
 * Merges explicit QA findings into the checklist as failed actionable items.
 *
 * @param checksJson - Existing checks JSON from QAResult.
 * @param findings - Structured findings submitted with the verdict.
 * @returns Updated checks JSON including finding rows.
 */
function mergeFindingsIntoChecks(
  checksJson: string,
  findings: readonly QaFinding[]
): string {
  const checks = parseStoredChecks(checksJson);
  for (const finding of findings) {
    checks.push({
      label: finding.description,
      passed: false,
      category: "finding",
      actionable: finding.actionable,
    });
  }
  return JSON.stringify(checks);
}

/**
 * Returns whether all required checklist items passed.
 *
 * @param checksJson - Raw checks column value from QAResult.
 * @returns True when every stored check has passed.
 */
export function requiredChecksPassed(checksJson: string): boolean {
  const checks = parseStoredChecks(checksJson);
  if (checks.length === 0) return true;
  return checks.every((c) => c.passed);
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Records a QA verdict and routes work to the next state.
 *
 * Side effects by verdict:
 * - passed: requires approved review and all checks passed; marks task done; emits timeline event.
 * - failed: stores actionable findings, creates ChangeRequests, returns task to in-progress.
 * - blocked: moves task to blocked; emits timeline event.
 * - needs_clarification: leaves task unchanged; emits timeline event.
 *
 * @throws When QA result is not found or does not belong to companyId.
 * @throws When QA result is already in a terminal state.
 * @throws When passed is requested but required checks failed or review gate is unmet.
 */
export async function recordQaResult(
  input: RecordQaResultInput
): Promise<RecordQaResultOutput> {
  const { companyId, qaResultId, verdict, notes, findings = [] } = input;

  const qa = await prisma.qAResult.findFirst({
    where: { id: qaResultId, companyId },
  });
  if (!qa) {
    throw new Error(`QA result "${qaResultId}" not found or inaccessible.`);
  }
  if (TERMINAL_QA_STATUSES.has(qa.status)) {
    throw new Error(
      `QA result "${qaResultId}" is already ${qa.status} and cannot be updated.`
    );
  }

  const taskId = qa.entityType === "task" ? qa.entityId : null;
  const changeRequestIds: string[] = [];
  let timelineEntryId: string;
  let completionBlocked = false;

  if (verdict === "passed") {
    if (taskId) {
      const approvedReview = await prisma.review.findFirst({
        where: {
          companyId,
          entityType: "task",
          entityId: taskId,
          status: "approved",
        },
        select: { id: true },
      });
      if (!approvedReview) {
        throw new Error(
          "QA cannot pass without an approved review for this task."
        );
      }
    }

    if (!requiredChecksPassed(qa.checks)) {
      completionBlocked = true;
      throw new Error(
        "Completion blocked: one or more required QA checks have not passed."
      );
    }

    const { passed, failed } = countChecks(parseStoredChecks(qa.checks));

    await prisma.qAResult.update({
      where: { id: qaResultId },
      data: {
        status: "passed",
        notes: notes ?? undefined,
        passedCount: passed,
        failedCount: failed,
        updatedAt: new Date(),
      },
    });

    if (taskId) {
      await prisma.task.updateMany({
        where: {
          id: taskId,
          companyId,
          status: { notIn: ["done", "cancelled"] },
        },
        data: { status: "done", updatedAt: new Date() },
      });

      // A passing QA closes the rework loop: any change requests that were
      // still open for this task (e.g. from a prior QA failure whose fix was
      // just re-validated) are now addressed.
      await prisma.changeRequest.updateMany({
        where: {
          resolved: false,
          review: { companyId, entityType: "task", entityId: taskId },
        },
        data: {
          resolved: true,
          resolution: `Addressed by a subsequent implementation; QA ${qaResultId} passed.`,
          updatedAt: new Date(),
        },
      });

      // Outcome lifecycle (MUS-259): the task that just reached `done` may have
      // been the outcome's last open work. Best-effort — completion bookkeeping
      // never breaks the QA gate itself.
      try {
        await evaluateOutcomeCompletionForTask(companyId, taskId);
      } catch {
        // Outcome completion is best-effort.
      }
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: qa.entityType,
        entityId: qa.entityId,
        eventType: "qa_passed",
        summary: notes
          ? `QA passed: ${notes.slice(0, 120)}`
          : "QA passed — task ready for completion.",
        metadata: JSON.stringify({ qaResultId, verdict }),
      },
    });
    timelineEntryId = entry.id;
  } else if (verdict === "failed") {
    const checksJson = mergeFindingsIntoChecks(qa.checks, findings);
    const { passed, failed } = countChecks(parseStoredChecks(checksJson));

    await prisma.qAResult.update({
      where: { id: qaResultId },
      data: {
        status: "failed",
        notes: notes ?? undefined,
        checks: checksJson,
        passedCount: passed,
        failedCount: failed,
        updatedAt: new Date(),
      },
    });

    if (taskId) {
      const approvedReview = await prisma.review.findFirst({
        where: {
          companyId,
          entityType: "task",
          entityId: taskId,
          status: "approved",
        },
        select: { id: true },
      });

      const actionableFindings = findings.filter((f) => f.actionable);
      const blockers = actionableFindings.filter((f) => f.severity === "blocker");

      if (approvedReview) {
        if (blockers.length > 0) {
          for (const blocker of blockers) {
            const cr = await prisma.changeRequest.create({
              data: {
                reviewId: approvedReview.id,
                reason: `[QA] ${blocker.description}`,
                requestedBy: "QA",
              },
            });
            changeRequestIds.push(cr.id);
          }
        } else if (actionableFindings.length > 0) {
          for (const finding of actionableFindings) {
            const cr = await prisma.changeRequest.create({
              data: {
                reviewId: approvedReview.id,
                reason: `[QA] ${finding.description}`,
                requestedBy: "QA",
              },
            });
            changeRequestIds.push(cr.id);
          }
        } else if (notes) {
          const cr = await prisma.changeRequest.create({
            data: {
              reviewId: approvedReview.id,
              reason: `[QA] ${notes}`,
              requestedBy: "QA",
            },
          });
          changeRequestIds.push(cr.id);
        } else {
          const failedChecks = parseStoredChecks(checksJson).filter((c) => !c.passed);
          for (const check of failedChecks.slice(0, 5)) {
            const cr = await prisma.changeRequest.create({
              data: {
                reviewId: approvedReview.id,
                reason: `[QA] ${check.label}`,
                requestedBy: "QA",
              },
            });
            changeRequestIds.push(cr.id);
          }
        }
      }

      await prisma.task.updateMany({
        where: { id: taskId, companyId },
        data: { status: "in-progress", updatedAt: new Date() },
      });
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: qa.entityType,
        entityId: qa.entityId,
        eventType: "qa_failed",
        summary: notes
          ? `QA failed: ${notes.slice(0, 120)}`
          : `QA failed (${findings.length} finding${findings.length !== 1 ? "s" : ""}).`,
        metadata: JSON.stringify({
          qaResultId,
          verdict,
          findingCount: findings.length,
          changeRequestCount: changeRequestIds.length,
        }),
      },
    });
    timelineEntryId = entry.id;
  } else if (verdict === "blocked") {
    await prisma.qAResult.update({
      where: { id: qaResultId },
      data: {
        status: "blocked",
        notes: notes ?? undefined,
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
        entityType: qa.entityType,
        entityId: qa.entityId,
        eventType: "qa_blocked",
        summary: notes ? `QA blocked: ${notes.slice(0, 120)}` : "QA blocked.",
        metadata: JSON.stringify({ qaResultId, verdict }),
      },
    });
    timelineEntryId = entry.id;
  } else {
    await prisma.qAResult.update({
      where: { id: qaResultId },
      data: {
        status: "needs_clarification",
        notes: notes ?? undefined,
        updatedAt: new Date(),
      },
    });

    const entry = await prisma.timelineEntry.create({
      data: {
        entityType: qa.entityType,
        entityId: qa.entityId,
        eventType: "qa_needs_clarification",
        summary: notes
          ? `QA needs clarification: ${notes.slice(0, 120)}`
          : "QA needs clarification.",
        metadata: JSON.stringify({ qaResultId, verdict }),
      },
    });
    timelineEntryId = entry.id;
  }

  return {
    qaResultId,
    verdict,
    taskId,
    changeRequestIds,
    timelineEntryId,
    completionBlocked,
  };
}
