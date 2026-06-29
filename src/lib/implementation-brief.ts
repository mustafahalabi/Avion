import type { GeneratedPlanningTask } from "@/lib/planning-generator";
import {
  formatRepositoryTaskContext,
  generateRepositoryTaskContext,
  type RepositoryInput,
} from "@/lib/repository-task-context";

/** Review/QA handoff requirements injected into every brief. */
const REVIEW_QA_HANDOFF = [
  "After implementation is complete, do NOT mark review or QA as passed automatically.",
  "Post a summary comment on the Linear ticket with: branch name, commit SHA, PR URL, files changed, and validation results.",
  "Move the Linear ticket to In Review only after a Pull Request has been opened.",
  "An independent reviewer must approve the PR before QA begins.",
  "QA must validate all acceptance criteria before the ticket can be closed.",
] as const;

/** Constraints injected into every brief to prevent scope creep and fake updates. */
const IMPLEMENTATION_CONSTRAINTS = [
  "Implement only this ticket. Do not begin other tickets or expand scope.",
  "Do not refactor unrelated code or rename unrelated files.",
  "Do not introduce placeholder, stub, or fake behavior — all implementations must be real.",
  "Do not call external AI APIs unless this ticket explicitly requires them.",
  "Do not fake passing tests, validation output, or status updates.",
  "Preserve company ownership boundaries and security invariants.",
  "Follow existing architecture, patterns, and coding conventions.",
  "Do not modify protected release branches (release/v1, main, master) unless this is an explicit hotfix.",
] as const;

// ─── Interfaces ────────────────────────────────────────────────────────────────

/**
 * Repository context included in the brief when available.
 */
export interface BriefRepositoryContext {
  readonly name: string;
  readonly url: string | null;
  readonly primaryLanguage: string | null;
  readonly frameworks: readonly string[];
  readonly techStack: readonly string[];
  readonly importantFiles: readonly string[];
  readonly analysisStatus: string;
}

/**
 * All input required to generate a Claude implementation brief for one task.
 */
export interface ImplementationBriefInput {
  /** Linear ticket identifier or internal task ID */
  readonly taskId: string;
  /** Human-readable ticket title */
  readonly taskTitle: string;
  /** Task description provided by the user */
  readonly taskDescription: string | null;
  /** Task priority level */
  readonly priority: string;
  /** Identifier of the planning draft that generated this task */
  readonly planningDraftId: string | null;
  /** Deterministic plan item ID within the planning draft */
  readonly planItemId: string | null;
  /**
   * JSON string of GeneratedPlanningTask array from PlanningDraft.generatedTasks.
   * Used to extract acceptance criteria, required context, and review requirements.
   */
  readonly generatedTasksJson: string | null;
  /** Repository the implementation agent will work in */
  readonly repository: BriefRepositoryContext | null;
  /**
   * Target branch name for this implementation.
   * Defaults to a deterministic slug derived from task title when omitted.
   */
  readonly branchName: string | null;
  /**
   * Base branch to branch from (e.g. "master").
   */
  readonly baseBranch: string | null;
  /** Optional Linear or external tracking ticket URL */
  readonly linearTicketUrl: string | null;
}

/**
 * The generated brief with both a raw markdown string and structured sections.
 */
export interface GeneratedImplementationBrief {
  /** Full markdown string ready to be copied into Claude Code. */
  readonly brief: string;
  /** Computed target branch name used in the brief. */
  readonly branchName: string;
}

// ─── Branch Name ───────────────────────────────────────────────────────────────

/**
 * Derives a deterministic Git branch name from a task title.
 *
 * @param taskId - Task identifier for the prefix.
 * @param taskTitle - Human-readable task title.
 * @returns A lowercase slugified branch name including the task ID prefix.
 * @example
 * ```ts
 * deriveBranchName("MUS-149", "Generate Claude implementation brief");
 * // → "feature/MUS-149-generate-claude-implementation-brief"
 * ```
 */
export function deriveBranchName(taskId: string, taskTitle: string): string {
  const slug = taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `feature/${taskId}-${slug}`;
}

/**
 * Returns true when the given branch name matches a protected pattern.
 *
 * Protected branches cannot be used as an implementation branch without an
 * explicit hotfix override.
 *
 * Protected patterns: main, master, release/*, v<digit>*
 *
 * @example
 * isProtectedBranch("main") // true
 * isProtectedBranch("release/v1") // true
 * isProtectedBranch("feature/MUS-152-foo") // false
 */
export function isProtectedBranch(name: string): boolean {
  if (name === "main" || name === "master") return true;
  if (/^release\//.test(name)) return true;
  if (/^v\d/.test(name)) return true;
  return false;
}

// ─── Planning Task Lookup ──────────────────────────────────────────────────────

/**
 * Extracts the generated planning task payload for a specific plan item ID.
 *
 * @param generatedTasksJson - JSON from PlanningDraft.generatedTasks.
 * @param planItemId - Deterministic plan item ID to look up.
 * @returns The full task payload, or null when not found.
 */
export function extractPlanningTaskPayload(
  generatedTasksJson: string | null,
  planItemId: string | null
): GeneratedPlanningTask | null {
  if (!generatedTasksJson || !planItemId) return null;

  try {
    const parsed = JSON.parse(generatedTasksJson) as unknown;
    if (!Array.isArray(parsed)) return null;

    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).planItemId === planItemId
      ) {
        return item as GeneratedPlanningTask;
      }
    }
  } catch {
    return null;
  }

  return null;
}

// ─── Section Builders ──────────────────────────────────────────────────────────

/**
 * Formats a list of items as a markdown bullet list.
 *
 * @param items - Lines to render as bullets.
 * @returns Markdown bullet list string, or an empty string when the list is empty.
 */
function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "_(none specified)_";
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Formats a list of commands as a markdown code block.
 *
 * @param commands - Shell commands to render.
 * @returns Markdown fenced shell code block.
 */
/**
 * Maps brief repository metadata to repository task context input.
 *
 * @param repo - Repository metadata from the task workspace.
 * @returns Repository input for `generateRepositoryTaskContext`.
 */
function toRepositoryInput(repo: BriefRepositoryContext): RepositoryInput {
  return {
    name: repo.name,
    url: repo.url,
    primaryLanguage: repo.primaryLanguage,
    frameworks: repo.frameworks,
    techStack: repo.techStack,
    importantFiles: repo.importantFiles,
    analysisStatus: repo.analysisStatus,
  };
}

/**
 * Builds the repository-safe context section via the canonical task context service.
 *
 * @param input - Full brief input including task and repository metadata.
 * @param branchName - Resolved implementation branch name.
 * @param baseBranch - Base branch to branch from.
 * @returns Markdown section for repository context, branches, and validation commands.
 */
function buildRepositoryContextSection(
  input: ImplementationBriefInput,
  branchName: string,
  baseBranch: string
): string {
  const ctx = generateRepositoryTaskContext({
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    branchName,
    baseBranch,
    repository: input.repository ? toRepositoryInput(input.repository) : null,
  });

  return formatRepositoryTaskContext(ctx);
}

/**
 * Builds the acceptance criteria section from the planning draft payload.
 *
 * @param taskPayload - Resolved planning task when available.
 * @param taskDescription - Fallback task description when no payload exists.
 * @returns Markdown section for acceptance criteria.
 */
function buildAcceptanceCriteriaSection(
  taskPayload: GeneratedPlanningTask | null,
  taskDescription: string | null
): string {
  const criteria =
    taskPayload?.acceptanceCriteria ??
    (taskDescription ? [taskDescription] : []);

  const definitionOfDone = taskPayload?.definitionOfDone ?? [];

  const lines: string[] = ["## Acceptance Criteria", "", bulletList(criteria)];

  if (definitionOfDone.length > 0) {
    lines.push("", "**Definition of done:**", "", bulletList(definitionOfDone));
  }

  return lines.join("\n");
}

/**
 * Builds the files to inspect section from planning context.
 *
 * @param taskPayload - Resolved planning task when available.
 * @param repo - Repository context when available.
 * @returns Markdown section for files to inspect.
 */
function buildFilesToInspectSection(
  taskPayload: GeneratedPlanningTask | null,
  repo: BriefRepositoryContext | null
): string {
  const requiredContext = taskPayload?.requiredContext ?? [];
  const importantFiles = repo?.importantFiles.filter(Boolean) ?? [];

  const lines: string[] = [
    "## Files and Context to Inspect",
    "",
    "Before writing any code, read and understand the following:",
    "",
  ];

  if (requiredContext.length > 0) {
    lines.push("**Required context:**", "", bulletList(requiredContext), "");
  }

  if (importantFiles.length > 0) {
    lines.push("**Repository key files:**", "");
    importantFiles.slice(0, 12).forEach((f) => lines.push(`- \`${f}\``));
    lines.push("");
  }

  lines.push(
    "**Always read before changing:**",
    "",
    "- `prisma/schema.prisma` — data model and ownership constraints",
    "- `src/lib/` — existing service layer patterns",
    "- `src/app/actions/` — server action patterns",
    "- `docs/architecture/` and `specification/` — engineering constraints"
  );

  return lines.join("\n");
}

/**
 * Builds the review/QA handoff section.
 *
 * @param reviewRequirements - Task-specific review requirements from planning draft.
 * @returns Markdown section for review and QA handoff.
 */
function buildReviewQaHandoffSection(reviewRequirements: readonly string[]): string {
  const lines: string[] = [
    "## Review and QA Handoff",
    "",
    "**After implementation:**",
    "",
    bulletList(REVIEW_QA_HANDOFF),
  ];

  if (reviewRequirements.length > 0) {
    lines.push(
      "",
      "**Task-specific review requirements:**",
      "",
      bulletList(reviewRequirements)
    );
  }

  return lines.join("\n");
}

// ─── Main Generator ────────────────────────────────────────────────────────────

/**
 * Generates a copyable, agent-safe Claude Code implementation brief for one task.
 *
 * The brief is fully deterministic — it never calls external AI APIs and produces
 * stable output for the same input. It includes the task objective, repository
 * context, branch name, implementation constraints, files to inspect, acceptance
 * criteria, validation commands, Linear update instructions, and review/QA handoff
 * requirements.
 *
 * @param input - All context needed to generate the brief for this task.
 * @returns The generated brief with the markdown string and computed branch name.
 * @example
 * ```ts
 * const result = generateClaudeImplementationBrief({
 *   taskId: "task_abc123",
 *   taskTitle: "Detect package manager and dependency graph",
 *   taskDescription: "Analyze repository manifests...",
 *   priority: "urgent",
 *   planningDraftId: "plan_xyz",
 *   planItemId: "task:detect-package-manager",
 *   generatedTasksJson: JSON.stringify([...]),
 *   repository: { name: "engineering-os", url: "...", ... },
 *   branchName: null,
 *   baseBranch: "master",
 *   linearTicketUrl: "https://linear.app/...",
 * });
 * console.log(result.brief);
 * ```
 */
export function generateClaudeImplementationBrief(
  input: ImplementationBriefInput
): GeneratedImplementationBrief {
  const branchName =
    input.branchName ?? deriveBranchName(input.taskId, input.taskTitle);
  const baseBranch = input.baseBranch ?? "master";

  const taskPayload = extractPlanningTaskPayload(
    input.generatedTasksJson,
    input.planItemId
  );

  const reviewRequirements = taskPayload?.reviewRequirements ?? [];

  const sections: string[] = [
    buildHeader(input, branchName, baseBranch),
    buildRepositoryContextSection(input, branchName, baseBranch),
    buildConstraintsSection(),
    buildFilesToInspectSection(taskPayload, input.repository),
    buildAcceptanceCriteriaSection(taskPayload, input.taskDescription),
    buildLinearUpdateSection(input.taskId, input.linearTicketUrl, branchName),
    buildReviewQaHandoffSection(reviewRequirements),
  ];

  const brief = sections.join("\n\n---\n\n");

  return { brief, branchName };
}

// ─── Section Helpers ───────────────────────────────────────────────────────────

function buildHeader(
  input: ImplementationBriefInput,
  branchName: string,
  baseBranch: string
): string {
  const roleHint = extractRoleHint(input.generatedTasksJson, input.planItemId);
  const priorityBadge = input.priority.toUpperCase();

  return [
    "# Claude Code Implementation Brief",
    "",
    `> **Task:** ${input.taskTitle}`,
    `> **Priority:** ${priorityBadge}`,
    `> **Branch:** \`${branchName}\` (from \`${baseBranch}\`)`,
    roleHint ? `> **Recommended Role:** ${roleHint}` : null,
    input.linearTicketUrl ? `> **Ticket:** ${input.linearTicketUrl}` : null,
    "",
    "You are the implementation engineer for this task.",
    "Read the full brief before writing a single line of code.",
    "Work only on this ticket. Stop and ask if anything is unclear.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function extractRoleHint(
  generatedTasksJson: string | null,
  planItemId: string | null
): string | null {
  if (!generatedTasksJson || !planItemId) return null;

  try {
    const parsed = JSON.parse(generatedTasksJson) as unknown;
    if (!Array.isArray(parsed)) return null;

    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).planItemId === planItemId
      ) {
        const role = (item as Record<string, unknown>).recommendedRole;
        return typeof role === "string" ? role : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildConstraintsSection(): string {
  return [
    "## Implementation Constraints",
    "",
    "The following rules are **non-negotiable**:",
    "",
    bulletList(IMPLEMENTATION_CONSTRAINTS),
  ].join("\n");
}

function buildLinearUpdateSection(
  taskId: string,
  ticketUrl: string | null,
  branchName: string
): string {
  const lines: string[] = [
    "## Linear Ticket Update Instructions",
    "",
    "After a successful Pull Request is open, post a comment on the Linear ticket with:",
    "",
    "```",
    `Branch:`,
    `${branchName}`,
    "",
    `Commit:`,
    `<commit SHA>`,
    "",
    `Pull Request:`,
    `<PR URL>`,
    "",
    `## Implementation Summary`,
    `- What changed: <describe>`,
    `- Files changed: <list>`,
    `- Tests added: <describe or "none">`,
    `- Validation: All commands passed`,
    `- Remaining risks: <describe or "none">`,
    `- Ready for review: Yes`,
    "```",
    "",
    "Then move the ticket to **In Review** on Linear.",
    "Do NOT move it to Done — that requires review and QA approval.",
  ];

  if (ticketUrl) {
    lines.splice(2, 0, "", `**Ticket:** ${ticketUrl}`);
  }

  if (taskId) {
    lines.splice(ticketUrl ? 4 : 2, 0, "", `**Ticket ID:** ${taskId}`);
  }

  return lines.join("\n");
}

// ─── Metadata Helpers ──────────────────────────────────────────────────────────

/**
 * Returns metadata keyed by plan item ID from a planning draft's generatedTasks JSON.
 *
 * @param generatedTasksJson - JSON array from PlanningDraft.generatedTasks.
 * @returns Read-only map from plan item ID to task metadata.
 * @example
 * ```ts
 * const metadata = parseGeneratedTaskMetadata(planningDraft.generatedTasks);
 * const task = metadata.get("task:detect-package-manager");
 * ```
 */
export function parseGeneratedTaskMetadata(
  generatedTasksJson: string
): ReadonlyMap<string, { planItemId: string; dependencies: readonly string[]; estimatedExecutionOrder: number }> {
  const metadata = new Map<string, { planItemId: string; dependencies: readonly string[]; estimatedExecutionOrder: number }>();

  try {
    const parsed = JSON.parse(generatedTasksJson) as unknown;
    if (!Array.isArray(parsed)) return metadata;

    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.planItemId !== "string" || candidate.planItemId.length === 0) continue;

      metadata.set(candidate.planItemId, {
        planItemId: candidate.planItemId,
        dependencies: Array.isArray(candidate.dependencies)
          ? (candidate.dependencies as string[]).filter((d): d is string => typeof d === "string")
          : [],
        estimatedExecutionOrder:
          typeof candidate.estimatedExecutionOrder === "number"
            ? candidate.estimatedExecutionOrder
            : Number.MAX_SAFE_INTEGER,
      });
    }
  } catch {
    return metadata;
  }

  return metadata;
}
