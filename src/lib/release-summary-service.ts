import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CeoReleaseSummaryTaskRecord {
  readonly taskId: string;
  readonly title: string;
  readonly status: string;
  readonly reviewStatus: string | null;
  readonly reviewNotes: string | null;
  readonly qaStatus: string | null;
  readonly qaPassedCount: number;
  readonly qaFailedCount: number;
  readonly qaCheckLabels: readonly string[];
  readonly branchName: string | null;
  readonly prUrl: string | null;
  readonly validationSummary: string | null;
  readonly openChangeRequests: readonly string[];
}

export interface CeoReleaseSummaryChecklistItem {
  readonly label: string;
  readonly checked: boolean;
}

export interface CeoReleaseSummaryInput {
  readonly version: string;
  readonly title: string | null;
  readonly status: string;
  readonly deploymentStatus: string;
  readonly outcomeId: string | null;
  readonly checklist: readonly CeoReleaseSummaryChecklistItem[];
  readonly tasks: readonly CeoReleaseSummaryTaskRecord[];
  readonly additionalRisks: readonly string[];
  readonly additionalFollowUps: readonly string[];
}

export interface CeoReleaseSummaryResult {
  readonly markdown: string;
  readonly hasData: boolean;
}

// ─── Pure builder ─────────────────────────────────────────────────────────────

/**
 * Builds a CEO-facing release summary from stored release, task, review, QA,
 * and session records. Does not invent data beyond the provided input.
 *
 * @param input - Structured release summary input assembled from database rows.
 * @returns Markdown summary suitable for copy/paste.
 */
export function buildCeoReleaseSummary(input: CeoReleaseSummaryInput): CeoReleaseSummaryResult {
  const lines: string[] = [];

  const heading = input.title
    ? `# Release Summary: ${input.version} — ${input.title}`
    : `# Release Summary: ${input.version}`;

  lines.push(heading, "");
  lines.push(`**Status:** ${input.status.replace(/_/g, " ")}`);
  lines.push(`**Deployment:** ${input.deploymentStatus.replace(/_/g, " ")}`);
  if (input.outcomeId) {
    lines.push(`**Outcome:** ${input.outcomeId}`);
  }
  lines.push("");

  if (input.tasks.length > 0) {
    lines.push("## Completed Work");
    for (const task of input.tasks) {
      const prSuffix = task.prUrl ? ` — [PR](${task.prUrl})` : "";
      lines.push(`- **${task.title}** (${task.status})${prSuffix}`);
      if (task.branchName) {
        lines.push(`  - Branch: \`${task.branchName}\``);
      }
      if (task.reviewStatus) {
        lines.push(`  - Review: ${task.reviewStatus.replace(/_/g, " ")}`);
      }
      if (task.qaStatus) {
        const total = task.qaPassedCount + task.qaFailedCount;
        const qaDetail =
          total > 0
            ? `${task.qaStatus} (${task.qaPassedCount}/${total} checks)`
            : task.qaStatus;
        lines.push(`  - QA: ${qaDetail}`);
      }
    }
    lines.push("");
  } else {
    lines.push("## Completed Work");
    lines.push("- No tasks linked to this release yet.");
    lines.push("");
  }

  lines.push("## Checks Performed");
  if (input.checklist.length > 0) {
    for (const item of input.checklist) {
      lines.push(`- [${item.checked ? "x" : " "}] ${item.label}`);
    }
  } else {
    lines.push("- No release readiness checklist recorded.");
  }

  const qaChecks = input.tasks.flatMap((t) =>
    t.qaCheckLabels.map((label) => `- QA check (${t.title}): ${label}`)
  );
  if (qaChecks.length > 0) {
    lines.push("");
    lines.push("### QA Checklist Items Verified");
    lines.push(...qaChecks);
  }

  const validationLines = input.tasks
    .filter((t) => t.validationSummary)
    .map((t) => `- ${t.title}: ${t.validationSummary}`);
  if (validationLines.length > 0) {
    lines.push("");
    lines.push("### Validation Evidence");
    lines.push(...validationLines);
  }
  lines.push("");

  const risks: string[] = [...input.additionalRisks];
  for (const task of input.tasks) {
    if (task.qaStatus === "failed") {
      risks.push(`Task "${task.title}" has a failed QA result.`);
    }
    if (task.reviewStatus && task.reviewStatus !== "approved") {
      risks.push(`Task "${task.title}" review status is ${task.reviewStatus}.`);
    }
    if (!task.prUrl && task.status === "done") {
      risks.push(`Task "${task.title}" has no PR URL on record.`);
    }
  }

  lines.push("## Risks");
  if (risks.length > 0) {
    for (const risk of [...new Set(risks)]) {
      lines.push(`- ${risk}`);
    }
  } else {
    lines.push("- No risks identified from stored records.");
  }
  lines.push("");

  const followUps: string[] = [...input.additionalFollowUps];
  for (const task of input.tasks) {
    for (const cr of task.openChangeRequests) {
      followUps.push(`[${task.title}] ${cr}`);
    }
    if (task.reviewNotes?.trim()) {
      followUps.push(`[${task.title}] Review note: ${task.reviewNotes.trim().slice(0, 200)}`);
    }
  }

  const unchecked = input.checklist.filter((c) => !c.checked).map((c) => c.label);
  for (const label of unchecked) {
    followUps.push(`Complete release checklist item: ${label}`);
  }

  lines.push("## Follow-up Items");
  if (followUps.length > 0) {
    for (const item of [...new Set(followUps)]) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("- No follow-up items identified from stored records.");
  }

  const markdown = lines.join("\n");
  const hasData =
    input.tasks.length > 0 ||
    input.checklist.some((c) => c.checked) ||
    risks.length > 0 ||
    followUps.length > 0;

  return { markdown, hasData };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses QA check labels from stored checks JSON.
 *
 * @param checksJson - Raw QAResult.checks value.
 * @returns Human-readable check labels that passed.
 */
function parsePassedQaCheckLabels(checksJson: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(checksJson ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { label: string; passed: boolean } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { label: string }).label === "string" &&
          (item as { passed: boolean }).passed === true
      )
      .map((item) => item.label);
  } catch {
    return [];
  }
}

/**
 * Builds a short validation summary from session output.
 *
 * @param validationOutput - Raw validation command output.
 * @returns Truncated summary or null.
 */
function summarizeValidation(validationOutput: string | null | undefined): string | null {
  const text = validationOutput?.trim();
  if (!text) return null;
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? text;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Loads release summary input from stored database records.
 *
 * @param companyId - Company scope for ownership validation.
 * @param releaseId - Release identifier.
 * @returns Summary input or null when release is not found.
 */
export async function loadCeoReleaseSummaryInput(
  companyId: string,
  releaseId: string
): Promise<CeoReleaseSummaryInput | null> {
  const release = await prisma.release.findFirst({
    where: { id: releaseId, companyId },
  });
  if (!release) return null;

  let taskIds: string[] = [];
  try {
    taskIds = JSON.parse(release.taskIds) as string[];
  } catch {
    taskIds = [];
  }

  let checklist: CeoReleaseSummaryChecklistItem[] = [];
  try {
    const parsed = JSON.parse(release.checklist) as Array<{
      label: string;
      checked: boolean;
    }>;
    checklist = parsed.map((item) => ({ label: item.label, checked: item.checked }));
  } catch {
    checklist = [];
  }

  const tasks: CeoReleaseSummaryTaskRecord[] = [];

  for (const taskId of taskIds) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      select: { id: true, title: true, status: true },
    });
    if (!task) continue;

    const review = await prisma.review.findFirst({
      where: { companyId, entityType: "task", entityId: taskId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        notes: true,
        changeRequests: {
          where: { resolved: false },
          select: { reason: true },
        },
      },
    });

    const qa = await prisma.qAResult.findFirst({
      where: { companyId, entityType: "task", entityId: taskId },
      orderBy: { updatedAt: "desc" },
      select: {
        status: true,
        passedCount: true,
        failedCount: true,
        checks: true,
      },
    });

    const session = await prisma.executionSession.findFirst({
      where: { companyId, taskId, status: { in: ["completed", "failed"] } },
      orderBy: { completedAt: "desc" },
      select: {
        branchName: true,
        prUrl: true,
        validationOutput: true,
        resultSummary: true,
      },
    });

    tasks.push({
      taskId: task.id,
      title: task.title,
      status: task.status,
      reviewStatus: review?.status ?? null,
      reviewNotes: review?.notes ?? null,
      qaStatus: qa?.status ?? null,
      qaPassedCount: qa?.passedCount ?? 0,
      qaFailedCount: qa?.failedCount ?? 0,
      qaCheckLabels: parsePassedQaCheckLabels(qa?.checks),
      branchName: session?.branchName ?? null,
      prUrl: session?.prUrl ?? null,
      validationSummary:
        summarizeValidation(session?.validationOutput) ??
        (session?.resultSummary?.trim() ? session.resultSummary.trim().slice(0, 160) : null),
      openChangeRequests: review?.changeRequests.map((cr) => cr.reason) ?? [],
    });
  }

  return {
    version: release.version,
    title: release.title,
    status: release.status,
    deploymentStatus: release.deploymentStatus,
    outcomeId: release.outcomeId,
    checklist,
    tasks,
    additionalRisks: [],
    additionalFollowUps: [],
  };
}

/**
 * Generates a CEO release summary for a release from stored records.
 *
 * @param companyId - Company scope.
 * @param releaseId - Release identifier.
 * @returns Markdown summary or null when release is not found.
 */
export async function getCeoReleaseSummary(
  companyId: string,
  releaseId: string
): Promise<CeoReleaseSummaryResult | null> {
  const input = await loadCeoReleaseSummaryInput(companyId, releaseId);
  if (!input) return null;
  return buildCeoReleaseSummary(input);
}
