// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Task data needed to generate a review brief.
 */
export interface ReviewBriefTask {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  /** Acceptance criteria lines extracted from the planning draft or task description. */
  readonly acceptanceCriteria: readonly string[];
}

/**
 * Completed execution session data needed to generate a review brief.
 */
export interface ReviewBriefSession {
  readonly resultSummary: string | null;
  readonly filesChanged: readonly string[];
  readonly validationOutput: string | null;
  readonly branchName: string | null;
  readonly baseBranch: string | null;
  readonly commitSha: string | null;
  readonly prUrl: string | null;
  readonly prNumber: number | null;
  readonly prStatus: string | null;
}

/**
 * All input needed to generate a Codex review brief.
 */
export interface ReviewBriefInput {
  readonly task: ReviewBriefTask;
  readonly session: ReviewBriefSession;
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generates a copyable Codex review brief for a completed implementation session.
 *
 * The brief gives the reviewer everything they need to verify the implementation:
 * task scope, acceptance criteria, implementation summary, files changed,
 * validation results, a per-criterion review checklist, and an explicit
 * required review decision (approved or changes requested).
 *
 * The brief forbids approving unrelated refactors, fake behavior, or failing
 * validation — and requires blocker/non-blocker classification for findings.
 *
 * This function is pure — it performs no database access or I/O.
 *
 * @param input - Task and completed session data.
 * @returns Full Markdown brief ready to paste into Codex or another reviewer.
 *
 * @example
 * ```ts
 * const brief = generateReviewBrief({
 *   task: { id: "MUS-150", title: "Ingest agent result", ... },
 *   session: { resultSummary: "Implemented ...", filesChanged: [...], ... },
 * });
 * ```
 */
export function generateReviewBrief(input: ReviewBriefInput): string {
  const { task, session } = input;

  const sections: string[] = [
    buildHeader(task),
    buildTaskScopeSection(task),
    buildAcceptanceCriteriaSection(task),
    buildImplementationSummarySection(session),
    buildBranchPrSection(session),
    buildFilesChangedSection(session),
    buildValidationSection(session),
    buildReviewChecklistSection(task),
    buildReviewDecisionSection(),
    buildReviewerInstructionsSection(),
  ];

  return sections.join("\n\n");
}

// ─── Section Builders ─────────────────────────────────────────────────────────

function buildHeader(task: ReviewBriefTask): string {
  return [
    `# Codex Review Brief — ${task.title}`,
    "",
    `> This brief covers the implementation of **${task.id}**. ` +
      `Read it fully before starting your review.`,
  ].join("\n");
}

function buildTaskScopeSection(task: ReviewBriefTask): string {
  const lines = [
    "## Task Scope",
    "",
    `- **Task ID:** ${task.id}`,
    `- **Title:** ${task.title}`,
  ];

  if (task.description) {
    lines.push("", "**Description:**", "", task.description.trim());
  }

  return lines.join("\n");
}

function buildAcceptanceCriteriaSection(task: ReviewBriefTask): string {
  if (task.acceptanceCriteria.length === 0) {
    return [
      "## Acceptance Criteria",
      "",
      "> ⚠️  No acceptance criteria recorded. Review the task description for expected outcomes.",
    ].join("\n");
  }

  return [
    "## Acceptance Criteria",
    "",
    ...task.acceptanceCriteria.map((c) => `- ${c}`),
  ].join("\n");
}

function buildImplementationSummarySection(session: ReviewBriefSession): string {
  if (!session.resultSummary) {
    return [
      "## Implementation Summary",
      "",
      "> ⚠️  No implementation summary was recorded by the agent.",
    ].join("\n");
  }

  return [
    "## Implementation Summary",
    "",
    session.resultSummary.trim(),
  ].join("\n");
}

function buildBranchPrSection(session: ReviewBriefSession): string {
  const lines = ["## Branch & Pull Request", ""];

  if (session.branchName) {
    const base = session.baseBranch ?? "master";
    lines.push(`- **Branch:** \`${session.branchName}\` (from \`${base}\`)`);
  } else {
    lines.push("- **Branch:** _(not recorded)_");
  }

  if (session.commitSha) {
    lines.push(`- **Commit:** \`${session.commitSha}\``);
  }

  if (session.prUrl) {
    const prLabel = session.prNumber ? `PR #${session.prNumber}` : "Pull Request";
    const status = session.prStatus ? ` · ${session.prStatus}` : "";
    lines.push(`- **${prLabel}:** ${session.prUrl}${status}`);
  } else {
    lines.push("- **Pull Request:** _(not opened yet)_");
  }

  return lines.join("\n");
}

function buildFilesChangedSection(session: ReviewBriefSession): string {
  if (session.filesChanged.length === 0) {
    return [
      "## Files Changed",
      "",
      "> ⚠️  No files were recorded as changed. Confirm with the agent or inspect the branch.",
    ].join("\n");
  }

  return [
    "## Files Changed",
    "",
    ...session.filesChanged.map((f) => `- \`${f}\``),
  ].join("\n");
}

function buildValidationSection(session: ReviewBriefSession): string {
  if (!session.validationOutput) {
    return [
      "## Validation Results",
      "",
      "> ⚠️  No validation output was recorded. Confirm that all required checks passed.",
    ].join("\n");
  }

  return [
    "## Validation Results",
    "",
    "```",
    session.validationOutput.trim(),
    "```",
  ].join("\n");
}

function buildReviewChecklistSection(task: ReviewBriefTask): string {
  const lines = [
    "## Review Checklist",
    "",
    "Verify each item before recording your decision.",
    "",
    "**Acceptance criteria — check each is satisfied:**",
    "",
  ];

  if (task.acceptanceCriteria.length > 0) {
    task.acceptanceCriteria.forEach((c) => lines.push(`- [ ] ${c}`));
  } else {
    lines.push("- [ ] _(review task description for expected outcomes)_");
  }

  lines.push(
    "",
    "**Implementation quality — check all apply:**",
    "",
    "- [ ] No unrelated refactors or files changed outside the ticket scope",
    "- [ ] No placeholder, stub, or fake behavior introduced",
    "- [ ] No failing validation commands (tsc, lint, test, build)",
    "- [ ] Code follows existing architecture and coding conventions",
    "- [ ] Security invariants and company ownership boundaries preserved",
    "- [ ] No external AI API calls unless the ticket explicitly requires them"
  );

  return lines.join("\n");
}

function buildReviewDecisionSection(): string {
  return [
    "## Review Decision Required",
    "",
    "You **must** record one of the following decisions in Engineering OS after completing your review.",
    "",
    "---",
    "",
    "### ✅ Option A — Approved",
    "",
    "Use this when all acceptance criteria are met and no blockers exist.",
    "",
    "```",
    "Decision: APPROVED",
    "Notes: <optional summary of what you verified>",
    "```",
    "",
    "---",
    "",
    "### 🔄 Option B — Changes Requested",
    "",
    "Use this when one or more blockers must be resolved before approval.",
    "Classify every finding as BLOCKER or NON-BLOCKER.",
    "",
    "```",
    "Decision: CHANGES_REQUESTED",
    "",
    "Findings:",
    "- BLOCKER: <description> — must be fixed before approval",
    "- NON-BLOCKER: <description> — note for future improvement",
    "```",
  ].join("\n");
}

function buildReviewerInstructionsSection(): string {
  return [
    "## Reviewer Instructions",
    "",
    "- **Do NOT** approve automatically — read the code and verify each criterion.",
    "- **Do NOT** approve changes that modify files outside this ticket's scope.",
    "- **Do NOT** approve changes with failing validation output.",
    "- **Do NOT** approve changes containing placeholder or fake behavior.",
    "- **Do NOT** request changes for style issues unrelated to correctness.",
    "- Your decision will be recorded in Engineering OS and must be truthful.",
    "- Record your decision using the **Record Review Result** form on the task page.",
  ].join("\n");
}
