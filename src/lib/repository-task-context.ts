import { deriveBranchName, isProtectedBranch } from "@/lib/implementation-brief";
import { buildRepositoryIntelligenceUrl } from "@/lib/repository-intelligence-view";

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_VALIDATION_COMMANDS = [
  "npx prisma validate",
  "npx prisma format --check",
  "npx prisma generate",
  "npx tsc --noEmit",
  "npm run lint",
  "npm run build",
  "npm run test",
] as const;

const STANDARD_CONSTRAINTS = [
  "Implement only this ticket. Do not expand scope.",
  "Do not refactor unrelated code.",
  "Do not introduce placeholder, stub, or fake behavior.",
  "Do not modify protected release branches (release/*, main, master) unless explicitly a hotfix.",
  "Preserve company ownership boundaries and security invariants.",
  "Follow existing architecture, patterns, and coding conventions.",
] as const;

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Repository metadata input for generating task context.
 */
export interface RepositoryInput {
  readonly name: string;
  readonly url: string | null;
  readonly primaryLanguage: string | null;
  readonly frameworks: readonly string[];
  readonly techStack: readonly string[];
  readonly importantFiles: readonly string[];
  /** Value from Repository.analysisStatus (e.g. "pending", "completed", "failed"). */
  readonly analysisStatus: string;
  /** Additional validation commands discovered from repository analysis. */
  readonly validationCommands?: readonly string[];
}

/**
 * Input for generating a repository-safe task context.
 */
export interface RepositoryTaskContextInput {
  /** Task identifier (used to derive the branch name). */
  readonly taskId: string;
  /** Human-readable task title (used to derive the branch name). */
  readonly taskTitle: string;
  /**
   * Explicit implementation branch name. When omitted, derived deterministically
   * from taskId and taskTitle.
   */
  readonly branchName?: string | null;
  /** Base branch to check out from. Defaults to "master". */
  readonly baseBranch?: string | null;
  /** Repository attached to the task. Null when no repo is connected. */
  readonly repository?: RepositoryInput | null;
  /** Repository identifier for linking to the intelligence dashboard. */
  readonly repositoryId?: string | null;
}

/**
 * Fully-resolved, truthful repository context for one implementation task.
 * Ready to embed in a Claude task brief or render in the UI.
 */
export interface RepositoryTaskContext {
  /** Repository name, or null when no repository is attached. */
  readonly repositoryName: string | null;
  /** Repository URL, or null when not available. */
  readonly repositoryUrl: string | null;
  /** Base branch the implementation branch is checked out from. */
  readonly baseBranch: string;
  /** Target implementation branch for the agent to create and work on. */
  readonly intendedBranch: string;
  /** Primary language, or null when not detected. */
  readonly primaryLanguage: string | null;
  /** Combined tech stack (frameworks + stack), deduplicated. May be empty. */
  readonly techStack: readonly string[];
  /** Relevant files the agent should read before making changes. May be empty. */
  readonly relevantFiles: readonly string[];
  /** Ordered list of validation commands to run before considering work done. */
  readonly validationCommands: readonly string[];
  /** Truthful environment notes based solely on available metadata. */
  readonly environmentNotes: readonly string[];
  /** Safety constraints the agent must observe. */
  readonly constraints: readonly string[];
  /**
   * Warnings about missing or incomplete repository metadata.
   * Should be surfaced prominently in the brief.
   */
  readonly warnings: readonly string[];
  /** True when repository analysis has completed (analysisStatus === "completed"). */
  readonly hasAnalysis: boolean;
  /** Raw analysisStatus from the repository record, or null when no repo attached. */
  readonly analysisStatus: string | null;
  /** Deep link to the repository intelligence dashboard, when repositoryId is known. */
  readonly intelligenceDashboardUrl: string | null;
}

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * Generates a repository-safe task context for an implementation agent.
 *
 * The output is truthful: it only reports metadata that is actually stored.
 * Missing data is represented as null/empty rather than guessed. Warnings
 * are emitted for anything the agent will need but that is unavailable.
 *
 * @param input - Task and repository metadata.
 * @returns Resolved context ready to embed in a Claude task brief.
 *
 * @example
 * ```ts
 * const ctx = generateRepositoryTaskContext({
 *   taskId: "MUS-153",
 *   taskTitle: "Generate repository-safe task context",
 *   repository: {
 *     name: "engineering-os",
 *     url: "https://github.com/org/engineering-os",
 *     primaryLanguage: "TypeScript",
 *     frameworks: ["Next.js"],
 *     techStack: ["Prisma"],
 *     importantFiles: ["prisma/schema.prisma"],
 *     analysisStatus: "completed",
 *   },
 * });
 * ```
 */
export function generateRepositoryTaskContext(
  input: RepositoryTaskContextInput
): RepositoryTaskContext {
  const baseBranch = input.baseBranch?.trim() || "master";
  const intendedBranch =
    input.branchName?.trim() || deriveBranchName(input.taskId, input.taskTitle);

  const warnings: string[] = [];

  // ── Branch protection check ───────────────────────────────────────────────
  if (isProtectedBranch(intendedBranch)) {
    warnings.push(
      `Branch "${intendedBranch}" is a protected branch. ` +
        `Confirm this is an explicit hotfix before proceeding.`
    );
  }

  // ── No repository attached ────────────────────────────────────────────────
  if (!input.repository) {
    warnings.push(
      "No repository is attached to this task. " +
        "Confirm the target repository and base branch before starting implementation."
    );

    return {
      repositoryName: null,
      repositoryUrl: null,
      baseBranch,
      intendedBranch,
      primaryLanguage: null,
      techStack: [],
      relevantFiles: [],
      validationCommands: [...STANDARD_VALIDATION_COMMANDS],
      environmentNotes: [],
      constraints: [...STANDARD_CONSTRAINTS],
      warnings,
      hasAnalysis: false,
      analysisStatus: null,
      intelligenceDashboardUrl: input.repositoryId
        ? buildRepositoryIntelligenceUrl(input.repositoryId)
        : null,
    };
  }

  const repo = input.repository;
  const hasAnalysis = repo.analysisStatus === "completed";

  // ── Analysis status warnings ───────────────────────────────────────────────
  if (!hasAnalysis) {
    if (repo.analysisStatus === "pending") {
      warnings.push(
        "Repository analysis is still pending. " +
          "File tree, frameworks, and important files may be incomplete."
      );
    } else if (repo.analysisStatus === "failed") {
      warnings.push(
        "Repository analysis failed. " +
          "Available metadata may be incomplete or stale."
      );
    }
  }

  // ── Missing critical fields ────────────────────────────────────────────────
  if (!repo.url) {
    warnings.push("Repository URL is not set. The agent will need to locate the repo manually.");
  }
  if (!repo.primaryLanguage) {
    warnings.push("Primary language is not detected. Inspect the repository before writing code.");
  }

  // ── Tech stack ────────────────────────────────────────────────────────────
  const techStack = [
    ...repo.frameworks.filter(Boolean),
    ...repo.techStack.filter(Boolean),
  ];
  const dedupedStack = [...new Set(techStack)];

  // ── Relevant files ────────────────────────────────────────────────────────
  const relevantFiles = repo.importantFiles.filter(Boolean);

  // ── Validation commands ───────────────────────────────────────────────────
  const extraCommands = (repo.validationCommands ?? []).filter(
    (cmd) => !STANDARD_VALIDATION_COMMANDS.includes(cmd as typeof STANDARD_VALIDATION_COMMANDS[number])
  );
  const validationCommands = [...STANDARD_VALIDATION_COMMANDS, ...extraCommands];

  // ── Environment notes ─────────────────────────────────────────────────────
  const environmentNotes: string[] = [];
  if (repo.primaryLanguage) {
    environmentNotes.push(`Primary language: ${repo.primaryLanguage}`);
  }
  if (dedupedStack.length > 0) {
    environmentNotes.push(`Tech stack: ${dedupedStack.join(", ")}`);
  }
  if (!hasAnalysis) {
    environmentNotes.push(
      "Repository analysis has not completed — file-level details above are based on available metadata only, not live inspection."
    );
  }

  return {
    repositoryName: repo.name,
    repositoryUrl: repo.url,
    baseBranch,
    intendedBranch,
    primaryLanguage: repo.primaryLanguage,
    techStack: dedupedStack,
    relevantFiles,
    validationCommands,
    environmentNotes,
    constraints: [...STANDARD_CONSTRAINTS],
    warnings,
    hasAnalysis,
    analysisStatus: repo.analysisStatus,
    intelligenceDashboardUrl: input.repositoryId
      ? buildRepositoryIntelligenceUrl(input.repositoryId)
      : null,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a RepositoryTaskContext as a Markdown section for embedding in a
 * Claude task brief.
 *
 * @param ctx - Resolved repository task context.
 * @returns Markdown string ready to paste into an implementation brief.
 *
 * @example
 * ```ts
 * const markdown = formatRepositoryTaskContext(ctx);
 * // Insert into brief between acceptance criteria and validation sections.
 * ```
 */
export function formatRepositoryTaskContext(ctx: RepositoryTaskContext): string {
  const lines: string[] = ["## Repository Context", ""];

  // Warnings first — they are the most important signal
  if (ctx.warnings.length > 0) {
    ctx.warnings.forEach((w) => lines.push(`> ⚠️  ${w}`));
    lines.push("");
  }

  lines.push(
    `- **Repository:** ${ctx.repositoryName ?? "_(not attached)_"}`,
    `- **URL:** ${ctx.repositoryUrl ?? "_(not available)_"}`,
    `- **Base Branch:** \`${ctx.baseBranch}\``,
    `- **Implementation Branch:** \`${ctx.intendedBranch}\``,
    `- **Primary Language:** ${ctx.primaryLanguage ?? "_(not detected)_"}`,
    `- **Stack:** ${ctx.techStack.length > 0 ? ctx.techStack.join(", ") : "_(not detected)_"}`,
    `- **Analysis Status:** ${ctx.analysisStatus ?? "_(no repository)_"}`
  );

  if (ctx.intelligenceDashboardUrl) {
    lines.push(`- **Repository Intelligence:** ${ctx.intelligenceDashboardUrl}`);
  }

  if (ctx.relevantFiles.length > 0) {
    lines.push("", "**Key files to inspect:**");
    ctx.relevantFiles.slice(0, 12).forEach((f) => lines.push(`- \`${f}\``));
  }

  if (ctx.environmentNotes.length > 0) {
    lines.push("", "**Environment notes:**");
    ctx.environmentNotes.forEach((n) => lines.push(`- ${n}`));
  }

  lines.push("", "**Validation commands:**");
  ctx.validationCommands.forEach((cmd) => lines.push(`- \`${cmd}\``));

  lines.push("", "**Constraints:**");
  ctx.constraints.forEach((c) => lines.push(`- ${c}`));

  return lines.join("\n");
}
