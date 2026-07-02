import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskEligibilityResult {
  readonly taskId: string;
  readonly eligible: boolean;
  readonly reason: string | null;
}

export interface ReleaseCandidateTaskEntry {
  readonly taskId: string;
  readonly title: string;
  readonly projectId: string | null;
  readonly outcomeId: string | null;
  readonly reviewId: string;
  readonly qaResultId: string;
  readonly branchName: string | null;
  readonly baseBranch: string | null;
  readonly prUrl: string | null;
  readonly prNumber: number | null;
  readonly prStatus: string | null;
  readonly commitSha: string | null;
  readonly validationSummary: string | null;
  readonly filesChangedCount: number;
}

export interface ReleaseCandidateMetadata {
  readonly kind: "release_candidate_v1";
  readonly tasks: readonly ReleaseCandidateTaskEntry[];
  readonly risks: readonly string[];
  readonly openIssues: readonly string[];
  readonly validationEvidence: readonly string[];
  readonly rejectedTasks: readonly { taskId: string; reason: string }[];
}

export interface CreateReleaseCandidateInput {
  readonly companyId: string;
  readonly version: string;
  readonly title?: string | null;
  readonly taskIds: readonly string[];
  readonly outcomeId?: string | null;
}

export interface CreateReleaseCandidateOutput {
  readonly releaseId: string;
  readonly includedTaskIds: readonly string[];
  readonly rejectedTasks: readonly { taskId: string; reason: string }[];
  readonly timelineEntryId: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  outcomeId: string | null;
}

// ─── Eligibility ───────────────────────────────────────────────────────────────

/**
 * Determines whether a task is eligible for a release candidate.
 *
 * A task must be done, have an approved review, and have passed QA.
 *
 * @param companyId - Company scope for ownership validation.
 * @param taskId - Task identifier to assess.
 * @returns Eligibility result with a human-readable rejection reason when ineligible.
 */
export async function assessTaskReleaseEligibility(
  companyId: string,
  taskId: string
): Promise<TaskEligibilityResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: { id: true, status: true },
  });

  if (!task) {
    return { taskId, eligible: false, reason: "Task not found or not accessible." };
  }

  if (task.status !== "done") {
    return {
      taskId,
      eligible: false,
      reason: `Task status is "${task.status}" — only completed (done) tasks are eligible.`,
    };
  }

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
    return {
      taskId,
      eligible: false,
      reason: "No approved review found for this task.",
    };
  }

  const passedQa = await prisma.qAResult.findFirst({
    where: {
      companyId,
      entityType: "task",
      entityId: taskId,
      status: "passed",
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!passedQa) {
    return {
      taskId,
      eligible: false,
      reason: "No passed QA result found for this task.",
    };
  }

  return { taskId, eligible: true, reason: null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses files changed JSON from an execution session.
 *
 * @param filesChangedJson - Raw filesChanged column value.
 * @returns Count of changed files.
 */
function countFilesChanged(filesChangedJson: string | null | undefined): number {
  try {
    const parsed = JSON.parse(filesChangedJson ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Builds a short validation summary from session output.
 *
 * @param validationOutput - Raw validation command output.
 * @returns Truncated summary or null when empty.
 */
function summarizeValidation(validationOutput: string | null | undefined): string | null {
  const text = validationOutput?.trim();
  if (!text) return null;
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? text;
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}…` : firstLine;
}

/**
 * Collects risks and open issues for an eligible task.
 *
 * @param companyId - Company scope.
 * @param taskId - Task identifier.
 * @param reviewId - Approved review identifier.
 * @returns Risks and open issue strings derived from stored records.
 */
async function collectTaskRisksAndIssues(
  companyId: string,
  taskId: string,
  reviewId: string
): Promise<{ risks: string[]; openIssues: string[]; validationEvidence: string[] }> {
  const risks: string[] = [];
  const openIssues: string[] = [];
  const validationEvidence: string[] = [];

  const openChangeRequests = await prisma.changeRequest.findMany({
    where: { reviewId, resolved: false },
    select: { reason: true },
  });

  for (const cr of openChangeRequests) {
    openIssues.push(cr.reason);
    risks.push(`Open change request: ${cr.reason}`);
  }

  const session = await prisma.executionSession.findFirst({
    where: {
      companyId,
      taskId,
      status: { in: ["completed", "failed"] },
    },
    orderBy: { completedAt: "desc" },
    select: {
      branchName: true,
      prUrl: true,
      prStatus: true,
      validationOutput: true,
      status: true,
      resultSummary: true,
    },
  });

  if (session) {
    if (session.validationOutput?.trim()) {
      validationEvidence.push(
        `Task ${taskId}: ${summarizeValidation(session.validationOutput) ?? "Validation output recorded."}`
      );
    } else if (session.resultSummary?.trim()) {
      validationEvidence.push(`Task ${taskId}: ${session.resultSummary.slice(0, 200)}`);
    }

    if (!session.prUrl && session.status === "completed") {
      risks.push(`Task "${taskId}" has no PR URL recorded on the latest execution session.`);
    }

    if (session.status === "failed") {
      risks.push(`Latest execution session for task "${taskId}" failed.`);
    }
  } else {
    risks.push(`No execution session recorded for task "${taskId}".`);
  }

  const failedChecks = await prisma.qAResult.findFirst({
    where: {
      companyId,
      entityType: "task",
      entityId: taskId,
      failedCount: { gt: 0 },
    },
    select: { notes: true, failedCount: true },
    orderBy: { updatedAt: "desc" },
  });

  if (failedChecks?.notes) {
    openIssues.push(failedChecks.notes);
  }

  return { risks, openIssues, validationEvidence };
}

/**
 * Builds a task entry with PR/branch metadata from the latest session.
 *
 * @param companyId - Company scope.
 * @param task - Task row with identifiers.
 * @param reviewId - Approved review identifier.
 * @param qaResultId - Passed QA result identifier.
 * @returns Enriched release candidate task entry.
 */
async function buildTaskEntry(
  companyId: string,
  task: TaskRow,
  reviewId: string,
  qaResultId: string
): Promise<ReleaseCandidateTaskEntry> {
  const session = await prisma.executionSession.findFirst({
    where: {
      companyId,
      taskId: task.id,
      status: { in: ["completed", "failed"] },
    },
    orderBy: { completedAt: "desc" },
    select: {
      branchName: true,
      baseBranch: true,
      prUrl: true,
      prNumber: true,
      prStatus: true,
      commitSha: true,
      validationOutput: true,
      filesChanged: true,
    },
  });

  return {
    taskId: task.id,
    title: task.title,
    projectId: task.projectId,
    outcomeId: task.outcomeId,
    reviewId,
    qaResultId,
    branchName: session?.branchName ?? null,
    baseBranch: session?.baseBranch ?? null,
    prUrl: session?.prUrl ?? null,
    prNumber: session?.prNumber ?? null,
    prStatus: session?.prStatus ?? null,
    commitSha: session?.commitSha ?? null,
    validationSummary: summarizeValidation(session?.validationOutput),
    filesChangedCount: countFilesChanged(session?.filesChanged),
  };
}

/**
 * Parses stored release candidate metadata from a release description.
 *
 * @param description - Raw release description column.
 * @returns Parsed metadata or null when not a candidate payload.
 */
export function parseReleaseCandidateMetadata(
  description: string | null | undefined
): ReleaseCandidateMetadata | null {
  if (!description?.trim()) return null;
  try {
    const parsed = JSON.parse(description) as ReleaseCandidateMetadata;
    if (parsed?.kind === "release_candidate_v1") return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates human-readable release notes from candidate metadata.
 *
 * @param metadata - Structured release candidate payload.
 * @param version - Release version string.
 * @returns Markdown release notes text.
 */
export function generateReleaseNotesFromCandidate(
  metadata: ReleaseCandidateMetadata,
  version: string
): string {
  const lines: string[] = [`# Release ${version}`, ""];

  lines.push("## Completed Work");
  for (const task of metadata.tasks) {
    const pr = task.prUrl ? ` (${task.prUrl})` : "";
    lines.push(`- ${task.title}${pr}`);
  }

  if (metadata.validationEvidence.length > 0) {
    lines.push("", "## Validation Evidence");
    for (const evidence of metadata.validationEvidence) {
      lines.push(`- ${evidence}`);
    }
  }

  if (metadata.risks.length > 0) {
    lines.push("", "## Risks");
    for (const risk of metadata.risks) {
      lines.push(`- ${risk}`);
    }
  }

  if (metadata.openIssues.length > 0) {
    lines.push("", "## Open Issues");
    for (const issue of metadata.openIssues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join("\n");
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Creates a release candidate from completed tasks that passed review and QA.
 *
 * Ineligible tasks are rejected with clear reasons. At least one eligible task
 * is required. The release is company-scoped and traceable to project/outcome.
 *
 * @throws When no task IDs are provided.
 * @throws When every requested task is ineligible.
 */
export async function createReleaseCandidate(
  input: CreateReleaseCandidateInput
): Promise<CreateReleaseCandidateOutput> {
  const { companyId, version, title, taskIds, outcomeId } = input;

  if (taskIds.length === 0) {
    throw new Error("At least one task ID is required to create a release candidate.");
  }

  const rejectedTasks: { taskId: string; reason: string }[] = [];
  const includedEntries: ReleaseCandidateTaskEntry[] = [];
  const allRisks: string[] = [];
  const allOpenIssues: string[] = [];
  const allValidationEvidence: string[] = [];

  for (const taskId of taskIds) {
    const eligibility = await assessTaskReleaseEligibility(companyId, taskId);
    if (!eligibility.eligible) {
      rejectedTasks.push({ taskId, reason: eligibility.reason ?? "Ineligible." });
      continue;
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        outcomeId: true,
      },
    });
    if (!task) continue;

    const approvedReview = await prisma.review.findFirst({
      where: {
        companyId,
        entityType: "task",
        entityId: taskId,
        status: "approved",
      },
      select: { id: true },
    });

    const passedQa = await prisma.qAResult.findFirst({
      where: {
        companyId,
        entityType: "task",
        entityId: taskId,
        status: "passed",
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!approvedReview || !passedQa) continue;

    const entry = await buildTaskEntry(companyId, task, approvedReview.id, passedQa.id);
    includedEntries.push(entry);

    const { risks, openIssues, validationEvidence } = await collectTaskRisksAndIssues(
      companyId,
      taskId,
      approvedReview.id
    );
    allRisks.push(...risks);
    allOpenIssues.push(...openIssues);
    allValidationEvidence.push(...validationEvidence);
  }

  if (includedEntries.length === 0) {
    const reasons = rejectedTasks.map((r) => `${r.taskId}: ${r.reason}`).join("; ");
    throw new Error(`No eligible tasks for release candidate. ${reasons}`);
  }

  const resolvedOutcomeId =
    outcomeId ?? includedEntries.find((e) => e.outcomeId)?.outcomeId ?? null;

  const metadata: ReleaseCandidateMetadata = {
    kind: "release_candidate_v1",
    tasks: includedEntries,
    risks: [...new Set(allRisks)],
    openIssues: [...new Set(allOpenIssues)],
    validationEvidence: [...new Set(allValidationEvidence)],
    rejectedTasks,
  };

  const releaseNotes = generateReleaseNotesFromCandidate(metadata, version);

  const checklist = [
    { id: "tests", label: "All tests passing", checked: allValidationEvidence.length > 0 },
    { id: "review", label: "Code review approved", checked: true },
    { id: "qa", label: "QA validation passed", checked: true },
    { id: "docs", label: "Release notes written", checked: true },
    { id: "rollback", label: "Rollback plan documented", checked: false },
    { id: "deploy", label: "Deployment environment verified", checked: false },
  ];

  const allChecked = checklist.every((c) => c.checked);
  const includedTaskIds = includedEntries.map((e) => e.taskId);

  const release = await prisma.release.create({
    data: {
      companyId,
      outcomeId: resolvedOutcomeId,
      version,
      title: title ?? `Release candidate ${version}`,
      description: JSON.stringify(metadata),
      releaseNotes,
      status: allChecked ? "ready" : "draft",
      deploymentStatus: "not_started",
      checklist: JSON.stringify(checklist),
      taskIds: JSON.stringify(includedTaskIds),
    },
  });

  const primaryEntityId = resolvedOutcomeId ?? includedTaskIds[0] ?? release.id;
  const primaryEntityType = resolvedOutcomeId ? "outcome" : "task";

  const entry = await prisma.timelineEntry.create({
    data: {
      entityType: primaryEntityType,
      entityId: primaryEntityId,
      eventType: "release_candidate_created",
      summary: `Release candidate ${version} created with ${includedTaskIds.length} task${includedTaskIds.length !== 1 ? "s" : ""}.`,
      metadata: JSON.stringify({
        releaseId: release.id,
        taskCount: includedTaskIds.length,
        rejectedCount: rejectedTasks.length,
      }),
    },
  });

  return {
    releaseId: release.id,
    includedTaskIds,
    rejectedTasks,
    timelineEntryId: entry.id,
  };
}

/**
 * Lists task IDs eligible for release candidate inclusion.
 *
 * @param companyId - Company scope.
 * @returns Eligible task summaries for UI selection.
 */
export async function listEligibleReleaseTasks(
  companyId: string
): Promise<
  readonly {
    id: string;
    title: string;
    projectId: string | null;
    outcomeId: string | null;
  }[]
> {
  const doneTasks = await prisma.task.findMany({
    where: { companyId, status: "done" },
    select: { id: true, title: true, projectId: true, outcomeId: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const eligible: {
    id: string;
    title: string;
    projectId: string | null;
    outcomeId: string | null;
  }[] = [];

  for (const task of doneTasks) {
    const result = await assessTaskReleaseEligibility(companyId, task.id);
    if (result.eligible) {
      eligible.push(task);
    }
  }

  return eligible;
}
