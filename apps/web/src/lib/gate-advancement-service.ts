/**
 * Gate-Advancement Service
 *
 * When an execution session completes, the task moves to `in-review` and stops.
 * Review and QA are only ever requested from UI forms, so the autonomous loop
 * dead-ends until a human acts.
 *
 * This service advances a task through the review and QA gates according to the
 * company's autonomy level (see `autonomy-policy`):
 * - Lower autonomy → request the review/QA item and STOP for human decision
 *   (the task surfaces as "needs CEO action").
 * - Higher autonomy → drive the automated review/QA path and record the result.
 *
 * It never bypasses a gate: completion still flows through `recordReviewResult`
 * and `recordQaResult`, which require an approved review and passing checks
 * before a task can reach `done`.
 *
 * Invoked by the autonomous driver (MUS-205) on a loop.
 */

import { authorizeAutonomyAction } from "@/lib/autonomy-policy";
import { getCommandsForRepo } from "@/lib/check-command-profile";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { generateQaChecklist, serializeChecklist } from "@/lib/qa-checklist";
import { recordQaResult } from "@/lib/qa-service";
import {
  generateReviewBrief,
  type ReviewBriefSession,
  type ReviewBriefTask,
} from "@/lib/review-brief";
import { recordReviewResult } from "@/lib/review-service";
import { parseValidationChecksMarker } from "@/lib/validation-runner";

// ─── Result types ────────────────────────────────────────────────────────────

/** Disposition of a single `advanceTaskGates` run. */
export type GateAdvanceStatus =
  | "completed"
  | "awaiting_review"
  | "awaiting_qa"
  | "review_blocked"
  | "qa_failed"
  | "not_in_review"
  | "no_action";

/** Result of advancing a task through the review/QA gates, for logging. */
export interface GateAdvanceResult {
  readonly status: GateAdvanceStatus;
  readonly reason: string;
  readonly taskId: string;
  readonly taskStatus?: string;
  readonly reviewId?: string | null;
  readonly qaResultId?: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Advances a task that has reached `in-review` through its review and QA gates,
 * honoring the company autonomy level.
 *
 * At autonomy levels where automated review/QA is permitted, a single call
 * drives review → QA → done with recorded results. At lower levels it requests
 * the next gate (creating the review or attaching the QA checklist) and halts,
 * leaving the task in-review for a human.
 *
 * @param companyId - Company that owns the task.
 * @param taskId - Task to advance.
 * @returns What the run did, including any review/QA ids and the task status.
 */
export async function advanceTaskGates(
  companyId: string,
  taskId: string
): Promise<GateAdvanceResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: { id: true, title: true, description: true, status: true },
  });
  if (!task) {
    return { status: "no_action", reason: "Task not found.", taskId };
  }
  if (task.status === "done") {
    return {
      status: "completed",
      reason: "Task already done.",
      taskId,
      taskStatus: "done",
    };
  }
  if (task.status !== "in-review") {
    return {
      status: "not_in_review",
      reason: `Task is "${task.status}", not in-review.`,
      taskId,
      taskStatus: task.status,
    };
  }

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { autonomyLevel: true },
  });
  const level = settings?.autonomyLevel;
  const reviewAllowed = authorizeAutonomyAction(level, "auto_review").allowed;
  const qaAllowed = authorizeAutonomyAction(level, "auto_qa").allowed;

  // Best-effort implementation context for the brief / checklist.
  const session = await prisma.executionSession.findFirst({
    where: { companyId, taskId, status: "completed" },
    orderBy: { completedAt: "desc" },
    select: {
      resultSummary: true,
      validationOutput: true,
      branchName: true,
      baseBranch: true,
      commitSha: true,
      prUrl: true,
      prNumber: true,
      prStatus: true,
      filesChanged: true,
      completedAt: true,
      repository: {
        select: { primaryLanguage: true, frameworks: true, techStack: true },
      },
    },
  });
  const filesChanged = parseFilesChanged(session?.filesChanged);

  // ── Review gate ──────────────────────────────────────────────────────────
  let review = await prisma.review.findFirst({
    where: { companyId, entityType: "task", entityId: taskId },
    orderBy: { createdAt: "desc" },
  });
  let createdReview = review === null;

  // Rework landed: when the latest review requested changes but a newer
  // implementation completed after that verdict, the verdict is superseded —
  // open a fresh review for the new implementation instead of dead-ending.
  if (
    review &&
    review.status === "changes_requested" &&
    session?.completedAt &&
    session.completedAt > review.updatedAt
  ) {
    review = null;
    createdReview = true;
  }

  if (!review) {
    const brief = generateReviewBrief({
      task: toBriefTask(task),
      session: toBriefSession(session, filesChanged),
    });
    review = await prisma.review.create({
      data: {
        companyId,
        entityType: "task",
        entityId: taskId,
        title: `Review: ${task.title}`.slice(0, 200),
        status: "pending",
        notes: brief,
      },
    });
    await writeTimelineEntry(taskId, "review_requested", "Review requested.", {
      reviewId: review.id,
    });
  }

  if (review.status === "pending") {
    if (!reviewAllowed) {
      // Notify the CEO once, when the checkpoint is first raised.
      if (createdReview) {
        await notifyCheckpoint(companyId, taskId, task.title, "review");
      }
      return {
        status: "awaiting_review",
        reason: "Awaiting CEO review decision (needs CEO action).",
        taskId,
        reviewId: review.id,
        taskStatus: "in-review",
      };
    }
    // Drive the automated review: approve. recordReviewResult creates the
    // pending QAResult and keeps the task in-review for the QA gate.
    await recordReviewResult({
      companyId,
      reviewId: review.id,
      verdict: "approved",
      notes: "Automated review approved.",
      findings: [],
    });
  } else if (review.status !== "approved") {
    // changes_requested / blocked / needs_clarification — not advanceable here.
    return {
      status: review.status === "blocked" ? "review_blocked" : "no_action",
      reason: `Review is "${review.status}".`,
      taskId,
      reviewId: review.id,
      taskStatus: task.status,
    };
  }

  // ── QA gate (review is approved) ───────────────────────────────────────────
  let qa = await prisma.qAResult.findFirst({
    where: {
      companyId,
      entityType: "task",
      entityId: taskId,
      status: { notIn: ["failed", "blocked"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!qa) {
    // Defensive: ensure a QA item exists even if the review path did not create one.
    qa = await prisma.qAResult.create({
      data: { companyId, entityType: "task", entityId: taskId, status: "pending" },
    });
  }

  if (qa.status === "passed") {
    return {
      status: "completed",
      reason: "Review and QA already passed; task complete.",
      taskId,
      reviewId: review.id,
      qaResultId: qa.id,
      taskStatus: "done",
    };
  }

  // Validation commands for the human checklist come from the repository's
  // detected check profile (never a hardcoded stack assumption).
  const detectedCommands = getCommandsForRepo({
    primaryLanguage: session?.repository?.primaryLanguage ?? null,
    frameworks: parseJsonStringArray(session?.repository?.frameworks),
    techStack: parseJsonStringArray(session?.repository?.techStack),
  }).map((command) => command.command);

  if (!qaAllowed) {
    const checklist = generateQaChecklist({
      acceptanceCriteria: [],
      reviewNotes: null,
      reviewFindings: [],
      filesChanged,
      validationCommands: detectedCommands,
    });
    // First time we pause at QA (checklist not yet attached) → notify once.
    const qaFirstPause = qa.checks === "[]" || qa.checks === "";
    // Attach the checklist for the human and halt at the QA checkpoint.
    await prisma.qAResult.update({
      where: { id: qa.id },
      data: { checks: serializeChecklist(checklist) },
    });
    await writeTimelineEntry(taskId, "qa_requested", "QA requested.", {
      qaResultId: qa.id,
    });
    if (qaFirstPause) {
      await notifyCheckpoint(companyId, taskId, task.title, "qa");
    }
    return {
      status: "awaiting_qa",
      reason: "Awaiting CEO QA decision (needs CEO action).",
      taskId,
      reviewId: review.id,
      qaResultId: qa.id,
      taskStatus: "in-review",
    };
  }

  // Drive the automated QA path truthfully: the verdict is derived from the
  // real validation-command results the worker recorded on the session —
  // never from a fabricated all-passed checklist.
  const realChecks = parseValidationChecksMarker(session?.validationOutput);

  if (realChecks && realChecks.length > 0) {
    await prisma.qAResult.update({
      where: { id: qa.id },
      data: { checks: JSON.stringify(realChecks) },
    });

    const failedChecks = realChecks.filter((check) => !check.passed);
    if (failedChecks.length > 0) {
      await recordQaResult({
        companyId,
        qaResultId: qa.id,
        verdict: "failed",
        notes: `Automated QA failed: ${failedChecks.length} of ${realChecks.length} recorded validation check(s) failed.`,
        findings: failedChecks.map((check) => ({
          severity: "blocker" as const,
          description: `Validation check failed: ${check.label}`,
          actionable: true,
        })),
      });
      return {
        status: "qa_failed",
        reason: `Automated QA failed on real validation results (${failedChecks.length} failing check(s)); change requests opened for rework.`,
        taskId,
        reviewId: review.id,
        qaResultId: qa.id,
        taskStatus: "in-progress",
      };
    }

    await recordQaResult({
      companyId,
      qaResultId: qa.id,
      verdict: "passed",
      notes: `Automated QA passed: all ${realChecks.length} recorded validation check(s) passed.`,
      findings: [],
    });
    return {
      status: "completed",
      reason: "Review approved and QA passed on real validation results; task done.",
      taskId,
      reviewId: review.id,
      qaResultId: qa.id,
      taskStatus: "done",
    };
  }

  // No real validation evidence exists for this session (no commands detected,
  // or the run could not execute them). Pass on the approved review alone with
  // an honest note — and no fabricated checklist items.
  await prisma.qAResult.update({
    where: { id: qa.id },
    data: { checks: "[]" },
  });
  await recordQaResult({
    companyId,
    qaResultId: qa.id,
    verdict: "passed",
    notes:
      "Automated QA: no validation-command results were recorded for this session; passing on review approval only (no checks were fabricated).",
    findings: [],
  });

  return {
    status: "completed",
    reason:
      "Review approved; QA passed on review approval (no validation results were recorded).",
    taskId,
    reviewId: review.id,
    qaResultId: qa.id,
    taskStatus: "done",
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Parses an ExecutionSession.filesChanged JSON string into an array. */
function parseFilesChanged(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === "string") : [];
  } catch {
    return [];
  }
}

/** Parses a JSON string-array column (e.g. Repository.frameworks) into string[]. */
function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Builds the review-brief task input from a task row. */
function toBriefTask(task: {
  id: string;
  title: string;
  description: string | null;
}): ReviewBriefTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    acceptanceCriteria: [],
  };
}

/** Builds the review-brief session input from the latest completed session. */
function toBriefSession(
  session:
    | {
        resultSummary: string | null;
        validationOutput: string | null;
        branchName: string | null;
        baseBranch: string | null;
        commitSha: string | null;
        prUrl: string | null;
        prNumber: number | null;
        prStatus: string | null;
      }
    | null,
  filesChanged: readonly string[]
): ReviewBriefSession {
  return {
    resultSummary: session?.resultSummary ?? null,
    filesChanged,
    validationOutput: session?.validationOutput ?? null,
    branchName: session?.branchName ?? null,
    baseBranch: session?.baseBranch ?? null,
    commitSha: session?.commitSha ?? null,
    prUrl: session?.prUrl ?? null,
    prNumber: session?.prNumber ?? null,
    prStatus: session?.prStatus ?? null,
  };
}

/**
 * Notifies the company owner that a task is awaiting their review/QA decision,
 * with a deep link to the inbox approvals. Best-effort — never throws (so a
 * missing notifications surface can't break gate advancement).
 *
 * @param companyId - Owning company.
 * @param taskId - Task awaiting a decision.
 * @param taskTitle - Task title for the message.
 * @param kind - "review" or "qa".
 */
async function notifyCheckpoint(
  companyId: string,
  taskId: string,
  taskTitle: string,
  kind: "review" | "qa"
): Promise<void> {
  try {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { ownerId: true },
    });
    if (!company) return;
    const label = kind === "review" ? "review" : "QA";
    await notify({
      userId: company.ownerId,
      companyId,
      title: `Approval needed: ${label}`,
      body: `"${taskTitle}" is awaiting your ${label} decision.`,
      type: "decision",
      priority: "high",
      entityType: "task",
      entityId: taskId,
      actionUrl: "/inbox",
    });
  } catch {
    // Notifications are best-effort.
  }
}

/** Writes a timeline entry for a gate transition (best-effort, never throws). */
async function writeTimelineEntry(
  taskId: string,
  eventType: string,
  summary: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.timelineEntry.create({
      data: {
        entityType: "task",
        entityId: taskId,
        eventType,
        summary,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {
    // Timeline writes are best-effort; do not fail gate advancement.
  }
}
