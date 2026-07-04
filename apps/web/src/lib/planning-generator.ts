import type { PlanningDraftStatus } from "@/lib/outcome-planning";
import type { CompanyMemoryItem } from "@/lib/memory/memory-types";

export const PLANNING_GENERATOR_VERSION = "deterministic-v2" as const;

/**
 * Whether a generated task produces real product code or is a planning/analysis
 * artifact already captured by the plan itself.
 *
 * - `implementation` — the task changes real product code; it earns an execution
 *   session → branch → PR.
 * - `analysis` — a planning/design/QA-planning step whose deliverable is plan
 *   content (scope, feature descriptions, review/QA plans), not a code change.
 *   Analysis tasks are NOT turned into executable Task rows (see
 *   {@link import("@/lib/plan-application-service")}), so a plan spends exactly one
 *   PR on the delivery task instead of one docs PR per planning step.
 */
export type PlanningTaskKind = "implementation" | "analysis";

/**
 * Roles that, by definition, do not author product code. Used only as the
 * *fallback* classifier for tasks that lack an explicit {@link PlanningTaskKind}
 * (e.g. AI-planned or planless tasks). The deterministic template sets `kind`
 * explicitly per blueprint, so its design tasks assigned to engineer roles are
 * still correctly treated as analysis regardless of this set.
 */
const ANALYSIS_ONLY_ROLES: ReadonlySet<string> = new Set([
  "reviewer",
  "qa engineer",
  "product manager",
  "product analyst",
  "technical writer",
]);

/**
 * Conservatively infers a task kind from its recommended role when no explicit
 * kind is present. Defaults to `implementation` for any engineer/unknown role so
 * this never silently drops real work — only roles that never write code
 * ({@link ANALYSIS_ONLY_ROLES}) are treated as `analysis`.
 *
 * @param recommendedRole - The task's recommended owner role.
 * @returns The inferred task kind.
 */
export function classifyTaskKind(recommendedRole: string): PlanningTaskKind {
  return ANALYSIS_ONLY_ROLES.has(recommendedRole.trim().toLowerCase())
    ? "analysis"
    : "implementation";
}

const MIN_TASK_ACCEPTANCE_CRITERIA = 2;
const MIN_TASK_DESCRIPTION_LENGTH = 48;

const MIN_OUTCOME_LENGTH = 8;
const MIN_MEANINGFUL_WORDS = 2;

const VAGUE_OUTCOME_PATTERNS = [
  /^improve (it|this|that|things|the app)$/i,
  /^make (it|this|that|things|the app) better$/i,
  /^fix (it|this|that|stuff|things)$/i,
  /^do (it|this|that)$/i,
  /^build (it|this|that)$/i,
] as const;

const UNSUPPORTED_KEYWORDS = [
  "order pizza",
  "book flight",
  "buy groceries",
  "personal errand",
  "schedule dentist",
] as const;

const COMMON_SCOPE = [
  "Clarify the CEO outcome into an approval-ready delivery plan.",
  "Produce generated project, feature, and task instructions inside the planning draft only.",
  "Define review, QA, release, dependency, risk, assumption, and acceptance criteria coverage.",
] as const;

const COMMON_NON_SCOPE = [
  "Do not create Project, Feature, Task, Review, QAResult, or Release records until approval.",
  "Do not mark delivery as started or assign live execution work.",
  "Do not call external AI APIs or represent this deterministic plan as AI output.",
] as const;

interface KeywordTemplate {
  readonly id: string;
  readonly matches: readonly string[];
  readonly projectNoun: string;
  readonly description: string;
  readonly roles: readonly string[];
}

const KEYWORD_TEMPLATES: readonly KeywordTemplate[] = [
  {
    id: "repository-intelligence",
    matches: ["repository", "repo", "codebase", "source tree", "package manifest"],
    projectNoun: "Repository Intelligence",
    description:
      "Analyze connected repositories, extract durable engineering metadata, and expose an actionable intelligence summary for planning and risk review.",
    roles: [
      "Product Manager",
      "Tech Lead",
      "Backend Engineer",
      "Frontend Engineer",
      "QA Engineer",
      "Reviewer",
      "Release Manager",
    ],
  },
  {
    id: "security",
    matches: ["security", "auth", "permission", "vulnerability", "compliance"],
    projectNoun: "Security Improvement",
    description:
      "Strengthen product and platform safety through explicit threat analysis, guarded implementation, independent review, and release controls.",
    roles: ["Security Engineer", "Tech Lead", "Backend Engineer", "Reviewer", "QA Engineer"],
  },
  {
    id: "performance",
    matches: ["performance", "speed", "latency", "slow", "optimize"],
    projectNoun: "Performance Improvement",
    description:
      "Identify performance bottlenecks, implement targeted improvements, and validate measurable user-facing and system-facing gains.",
    roles: ["Tech Lead", "Backend Engineer", "Frontend Engineer", "Monitoring Engineer", "QA Engineer"],
  },
  {
    id: "documentation",
    matches: ["documentation", "docs", "runbook", "guide"],
    projectNoun: "Documentation Improvement",
    description:
      "Turn the requested knowledge gap into maintained documentation with clear ownership, review, and release communication.",
    roles: ["Technical Writer", "Product Manager", "Tech Lead", "Reviewer"],
  },
] as const;

export interface PlanningEmployeeContext {
  readonly id: string;
  readonly name: string;
  readonly title: string | null;
  readonly roleName: string | null;
  readonly responsibilities: string | null;
}

export interface PlanningRepositoryContext {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly primaryLanguage: string | null;
  readonly techStack: readonly string[];
  readonly frameworks: readonly string[];
  readonly dependencies: readonly string[];
  readonly importantFiles: readonly string[];
  readonly analysisStatus: string;
  readonly analysisNotes: string | null;
  readonly latestChangeSummary: string | null;
  readonly latestChangeImpactLevel: string | null;
  readonly latestChangeAffectedAreas: readonly string[];
  readonly latestChangeRecommendedActions: readonly string[];
}

export interface OutcomePlanningInput {
  readonly companyId: string;
  readonly outcomeId: string;
  readonly title: string;
  readonly rawRequest: string;
  readonly brief: string | null;
  readonly businessValue: string | null;
  readonly successCriteria: readonly string[];
  readonly constraints: readonly string[];
  readonly employees: readonly PlanningEmployeeContext[];
  readonly repositories: readonly PlanningRepositoryContext[];
  /**
   * Durable company memory (lessons learned, promoted standards) surfaced to the planner
   * so plans incorporate accumulated experience. The AI planner renders it into its prompt;
   * the deterministic generator renders the top items as explicit plan assumptions.
   */
  readonly companyMemory?: readonly CompanyMemoryItem[];
  /**
   * The company's culture (`CompanySettings.cultureProfile`). When it maps to
   * known guidance, the AI planner prompt gains a culture directive so the work
   * breakdown reflects it (e.g. Enterprise → more review/security work; Design
   * First → UX/a11y emphasis). Unset/unknown adds nothing (MUS-288).
   */
  readonly cultureProfile?: string | null;
}

export interface PlanningMilestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly deliverables: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly estimatedOrder: number;
}

export interface GeneratedPlanningProject {
  readonly planItemId: string;
  readonly name: string;
  readonly description: string;
  readonly ownerRole: string;
  readonly ownerEmployeeId: string | null;
  readonly ownerEmployeeName: string | null;
  readonly milestones: readonly PlanningMilestone[];
  readonly acceptanceCriteria: readonly string[];
  readonly estimatedExecutionOrder: number;
}

export interface GeneratedPlanningFeature {
  readonly planItemId: string;
  readonly projectPlanItemId: string;
  readonly milestoneId: string;
  readonly title: string;
  readonly description: string;
  readonly ownerRole: string;
  readonly ownerEmployeeId: string | null;
  readonly ownerEmployeeName: string | null;
  readonly dependencies: readonly string[];
  readonly risks: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly qaExpectations: readonly string[];
  readonly releaseRelevance: string;
  readonly estimatedExecutionOrder: number;
}

export interface GeneratedPlanningTask {
  readonly planItemId: string;
  readonly featurePlanItemId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendedRole: string;
  readonly recommendedEmployeeId: string | null;
  readonly recommendedEmployeeName: string | null;
  readonly dependencies: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly definitionOfDone: readonly string[];
  readonly requiredContext: readonly string[];
  readonly reviewRequirements: readonly string[];
  readonly qaImpact: string;
  readonly estimatedExecutionOrder: number;
  readonly estimatePoints: number;
  /**
   * Whether this task produces real product code (`implementation`) or is a
   * planning/analysis artifact already captured by the plan (`analysis`). Optional
   * for back-compat with AI drafts and older persisted plans; a value is stamped
   * before persistence ({@link classifyTaskKind} is the fallback), and an absent
   * value is treated as `implementation` everywhere it is read.
   */
  readonly kind?: PlanningTaskKind;
}

export interface PlanningAssignmentRecommendation {
  readonly role: string;
  readonly employeeId: string | null;
  readonly employeeName: string | null;
  readonly reason: string;
  readonly taskPlanItemIds: readonly string[];
}

export interface PlanningDependency {
  readonly id: string;
  readonly type: "product" | "technical" | "repository" | "data" | "security" | "release" | "approval";
  readonly description: string;
  readonly blocks: readonly string[];
  readonly requiredBeforeOrder: number;
}

export interface PlanningRisk {
  readonly id: string;
  readonly severity: "low" | "medium" | "high";
  readonly description: string;
  readonly mitigation: string;
  readonly ownerRole: string;
}

export interface PlanningReviewPlan {
  readonly ownerRole: string;
  readonly requiredReviewers: readonly string[];
  readonly checkpoints: readonly string[];
  readonly approvalGate: string;
}

export interface PlanningQaPlan {
  readonly ownerRole: string;
  readonly strategy: string;
  readonly requiredChecks: readonly string[];
  readonly evidenceRequired: readonly string[];
}

export interface PlanningReleasePlan {
  readonly ownerRole: string;
  readonly strategy: string;
  readonly readinessCriteria: readonly string[];
  readonly rolloutSteps: readonly string[];
  readonly rollbackPlan: string;
}

export interface DeterministicPlanningDraft {
  readonly generatorVersion: string;
  readonly title: string;
  readonly summary: string;
  readonly status: PlanningDraftStatus;
  readonly scope: readonly string[];
  readonly nonScope: readonly string[];
  readonly assumptions: readonly string[];
  readonly risks: readonly PlanningRisk[];
  readonly dependencies: readonly PlanningDependency[];
  readonly recommendedAssignments: readonly PlanningAssignmentRecommendation[];
  readonly generatedProjects: readonly GeneratedPlanningProject[];
  readonly generatedFeatures: readonly GeneratedPlanningFeature[];
  readonly generatedTasks: readonly GeneratedPlanningTask[];
  readonly reviewPlan: PlanningReviewPlan;
  readonly qaPlan: PlanningQaPlan;
  readonly releasePlan: PlanningReleasePlan;
  readonly openCeoQuestions: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly estimatedExecutionOrder: readonly string[];
}

export interface PlanningGenerationFailure {
  readonly status: "failed";
  readonly reason: string;
  readonly openCeoQuestions: readonly string[];
}

/**
 * Which planner actually produced a draft, and — when the AI path was attempted
 * but did not yield a trustworthy draft — why it fell back (MUS-271). Makes the
 * charter's "AI validated with deterministic fallback" guarantee observable to
 * the CEO instead of silent.
 */
export interface PlanningProvenance {
  /** The planner whose output this draft actually is. */
  readonly provider: "deterministic" | "ai";
  /** "ai" when the AI path was attempted (even if it then fell back); null otherwise. */
  readonly providerAttempted: "ai" | null;
  /** Why the AI path fell back to deterministic, or null (genuine AI / plain deterministic). */
  readonly fallbackReason: string | null;
  /**
   * Real token/cost usage the LLM reported for the planning completion (Goal 3),
   * or null (deterministic-only, or the CLI surfaced no usage). Present even when
   * the AI path fell back — the failed attempt still cost tokens.
   */
  readonly usage?: import("@/lib/adapters/agent-usage").AgentUsage | null;
}

export interface PlanningGenerationSuccess {
  readonly status: "success";
  readonly draft: DeterministicPlanningDraft;
  /**
   * Provenance of this draft. Optional on the type so the pure generator can omit
   * it, but every adapter (deterministic + AI) attaches it so the service can persist it.
   */
  readonly provenance?: PlanningProvenance;
}

export type PlanningGenerationResult = PlanningGenerationSuccess | PlanningGenerationFailure;

interface FeatureBlueprint {
  readonly id: string;
  readonly milestoneId: string;
  readonly title: string;
  readonly description: string;
  readonly ownerRole: string;
  readonly taskBlueprints: readonly TaskBlueprint[];
}

interface TaskBlueprint {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly role: string;
  readonly dependencies: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly qaImpact: string;
  readonly estimatePoints: number;
  /**
   * Explicit task kind. When omitted the task is treated as `implementation`.
   * The general-engineering template sets this to `analysis` on its planning/design
   * steps so they never open a PR even though some are owned by engineer roles.
   */
  readonly kind?: PlanningTaskKind;
}

/**
 * Generates a deterministic planning draft for a CEO outcome.
 *
 * @param input - Company-scoped outcome, employee, and repository context.
 * @example
 * ```ts
 * const result = generateDeterministicPlanningDraft({
 *   companyId: "company_123",
 *   outcomeId: "outcome_123",
 *   title: "Build Repository Intelligence V2",
 *   rawRequest: "Build Repository Intelligence V2",
 *   brief: null,
 *   businessValue: null,
 *   successCriteria: [],
 *   constraints: [],
 *   employees: [],
 *   repositories: [],
 * });
 * ```
 * @returns A successful deterministic draft or a failed validation result with CEO questions.
 */
export function generateDeterministicPlanningDraft(
  input: OutcomePlanningInput
): PlanningGenerationResult {
  const validation = validateOutcomeForPlanning(input.title, input.rawRequest);
  if (validation !== null) {
    return validation;
  }

  const normalizedOutcome = normalizeWhitespace(input.rawRequest || input.title);
  const template = selectTemplate(normalizedOutcome);
  const projectName = buildProjectName(input.title, template);
  const employees = sortEmployees(input.employees);
  const repositories = sortRepositories(input.repositories);
  const projectPlanItemId = `project:${slugify(projectName)}`;
  const repositorySummary = summarizeRepositories(repositories);
  const featureBlueprints = buildFeatureBlueprints(template.id, normalizedOutcome, repositories);
  const milestones = buildMilestones(template.id, projectName, repositories);
  const generatedFeatures = featureBlueprints.map((feature, index, allFeatures) =>
    buildFeature(feature, projectPlanItemId, employees, index + 1, allFeatures)
  );
  const generatedTasks = featureBlueprints.flatMap((feature, featureIndex) =>
    feature.taskBlueprints.map((task, taskIndex) =>
      buildTask(
        task,
        feature,
        employees,
        repositories,
        template.id,
        featureIndex * 10 + taskIndex + 1
      )
    )
  );
  const assignments = buildAssignments(generatedTasks, employees);
  const dependencies = buildDependencies(template.id, repositories, generatedFeatures);
  const risks = buildRisks(template.id, repositories);
  const acceptanceCriteria = buildAcceptanceCriteria(template.id, projectName);
  const openCeoQuestions = buildOpenCeoQuestions(template.id, input.constraints, repositories);

  return {
    status: "success",
    draft: {
      generatorVersion: PLANNING_GENERATOR_VERSION,
      title: `${projectName} Planning Draft`,
      summary: `${projectName} will pursue "${normalizedOutcome}" through ${generatedFeatures.length} planned features and ${generatedTasks.length} execution-ready tasks. ${repositorySummary}`,
      status: "draft",
      scope: buildScope(template.id, normalizedOutcome, repositories),
      nonScope: COMMON_NON_SCOPE,
      assumptions: [
        ...buildAssumptions(template.id, repositories),
        ...buildMemoryAssumptions(input.companyMemory),
      ],
      risks,
      dependencies,
      recommendedAssignments: assignments,
      generatedProjects: [
        {
          planItemId: projectPlanItemId,
          name: projectName,
          description: buildProjectDescription(input, template, repositorySummary),
          ownerRole: "Product Manager",
          ...findOwnerAssignment("Product Manager", employees),
          milestones,
          acceptanceCriteria,
          estimatedExecutionOrder: 1,
        },
      ],
      generatedFeatures,
      generatedTasks,
      reviewPlan: buildReviewPlan(template.id),
      qaPlan: buildQaPlan(template.id),
      releasePlan: buildReleasePlan(template.id),
      openCeoQuestions,
      acceptanceCriteria,
      estimatedExecutionOrder: generatedTasks.map((task) => task.planItemId),
    },
  };
}

/**
 * Validates whether an outcome is specific enough for deterministic planning.
 *
 * @param title - Outcome title supplied by the CEO intake.
 * @param rawRequest - Raw CEO request text.
 * @example
 * ```ts
 * const failure = validateOutcomeForPlanning("Fix it", "Fix it");
 * ```
 * @returns A failure result when planning should not continue, otherwise `null`.
 */
export interface PlanningDraftQualityIssue {
  readonly code: string;
  readonly message: string;
  readonly planItemId?: string;
}

/**
 * Validates that a generated planning draft meets execution-ready quality thresholds.
 *
 * @param draft - Successful planning draft payload.
 * @example
 * ```ts
 * const result = generateDeterministicPlanningDraft(input);
 * if (result.status === "success") {
 *   const issues = validatePlanningDraftQuality(result.draft);
 * }
 * ```
 * @returns Quality issues; an empty array means the draft passes validation.
 */
export function validatePlanningDraftQuality(
  draft: DeterministicPlanningDraft
): readonly PlanningDraftQualityIssue[] {
  const issues: PlanningDraftQualityIssue[] = [];

  if (draft.generatedProjects.length === 0) {
    issues.push({
      code: "missing-project",
      message: "Planning draft must include at least one generated project.",
    });
  }

  for (const project of draft.generatedProjects) {
    if (project.milestones.length === 0) {
      issues.push({
        code: "missing-milestones",
        message: `Project ${project.planItemId} must include milestones.`,
        planItemId: project.planItemId,
      });
    }

    for (const milestone of project.milestones) {
      if (milestone.acceptanceCriteria.length === 0) {
        issues.push({
          code: "missing-milestone-acceptance",
          message: `Milestone ${milestone.id} must include acceptance criteria.`,
          planItemId: milestone.id,
        });
      }
    }
  }

  if (draft.generatedFeatures.length === 0) {
    issues.push({
      code: "missing-features",
      message: "Planning draft must include at least one generated feature.",
    });
  }

  for (const feature of draft.generatedFeatures) {
    if (feature.acceptanceCriteria.length === 0) {
      issues.push({
        code: "missing-feature-acceptance",
        message: `Feature ${feature.planItemId} must include acceptance criteria.`,
        planItemId: feature.planItemId,
      });
    }

    if (feature.ownerRole.trim().length === 0) {
      issues.push({
        code: "missing-feature-owner-role",
        message: `Feature ${feature.planItemId} must include an owner role.`,
        planItemId: feature.planItemId,
      });
    }
  }

  if (draft.generatedTasks.length === 0) {
    issues.push({
      code: "missing-tasks",
      message: "Planning draft must include at least one generated task.",
    });
  }

  for (const task of draft.generatedTasks) {
    if (task.description.trim().length < MIN_TASK_DESCRIPTION_LENGTH) {
      issues.push({
        code: "task-description-too-short",
        message: `Task ${task.planItemId} description is too short for implementation agents.`,
        planItemId: task.planItemId,
      });
    }

    if (task.acceptanceCriteria.length < MIN_TASK_ACCEPTANCE_CRITERIA) {
      issues.push({
        code: "insufficient-task-acceptance",
        message: `Task ${task.planItemId} must include at least ${MIN_TASK_ACCEPTANCE_CRITERIA} acceptance criteria.`,
        planItemId: task.planItemId,
      });
    }

    if (task.recommendedRole.trim().length === 0) {
      issues.push({
        code: "missing-task-role",
        message: `Task ${task.planItemId} must include a recommended role.`,
        planItemId: task.planItemId,
      });
    }

    if (task.definitionOfDone.length === 0) {
      issues.push({
        code: "missing-definition-of-done",
        message: `Task ${task.planItemId} must include definition-of-done guidance.`,
        planItemId: task.planItemId,
      });
    }

    if (task.requiredContext.length === 0) {
      issues.push({
        code: "missing-required-context",
        message: `Task ${task.planItemId} must include required context for implementation agents.`,
        planItemId: task.planItemId,
      });
    }
  }

  if (draft.risks.length === 0) {
    issues.push({ code: "missing-risks", message: "Planning draft must include risks." });
  }

  if (draft.dependencies.length === 0) {
    issues.push({ code: "missing-dependencies", message: "Planning draft must include dependencies." });
  }

  if (draft.assumptions.length === 0) {
    issues.push({ code: "missing-assumptions", message: "Planning draft must include assumptions." });
  }

  if (draft.openCeoQuestions.length === 0) {
    issues.push({
      code: "missing-ceo-questions",
      message: "Planning draft must include open CEO questions.",
    });
  }

  if (draft.reviewPlan.checkpoints.length === 0) {
    issues.push({
      code: "missing-review-plan",
      message: "Planning draft must include a review plan with checkpoints.",
    });
  }

  if (draft.qaPlan.requiredChecks.length === 0) {
    issues.push({
      code: "missing-qa-plan",
      message: "Planning draft must include a QA plan with required checks.",
    });
  }

  if (draft.releasePlan.readinessCriteria.length === 0) {
    issues.push({
      code: "missing-release-plan",
      message: "Planning draft must include a release plan with readiness criteria.",
    });
  }

  return issues;
}

export function validateOutcomeForPlanning(
  title: string,
  rawRequest: string
): PlanningGenerationFailure | null {
  const combined = normalizeWhitespace(rawRequest || title);

  if (combined.length === 0) {
    return {
      status: "failed",
      reason: "Outcome cannot be empty.",
      openCeoQuestions: ["What outcome should Avion plan for?"],
    };
  }

  if (combined.length < MIN_OUTCOME_LENGTH || countMeaningfulWords(combined) < MIN_MEANINGFUL_WORDS) {
    return {
      status: "failed",
      reason: "Outcome is too short to generate a useful deterministic plan.",
      openCeoQuestions: [
        "What business or product result should this outcome create?",
        "What visible behavior or system capability would prove success?",
      ],
    };
  }

  if (VAGUE_OUTCOME_PATTERNS.some((pattern) => pattern.test(combined))) {
    return {
      status: "failed",
      reason: "Outcome is ambiguous and needs CEO clarification before planning.",
      openCeoQuestions: [
        "What specific capability or user-visible result should be improved?",
        "Which users, workflow, repository, or system area should this plan target?",
        "What acceptance criteria would make the improvement complete?",
      ],
    };
  }

  const lower = combined.toLowerCase();
  if (UNSUPPORTED_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return {
      status: "failed",
      reason: "Outcome is outside the supported Avion planning scope.",
      openCeoQuestions: [
        "Is there a software, product, infrastructure, or documentation outcome Avion should plan instead?",
      ],
    };
  }

  return null;
}

/**
 * Safely parses a JSON string array from persisted repository metadata.
 *
 * @param value - JSON string from a repository metadata column.
 * @example
 * ```ts
 * const frameworks = parseJsonStringArray("[\"Next.js\"]");
 * ```
 * @returns A stable string array, or an empty array for invalid values.
 */
export function parseJsonStringArray(value: string | null | undefined): readonly string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === "string").map(normalizeWhitespace);
  } catch {
    return [];
  }
}

/**
 * Converts a value to a deterministic slug for generated plan item IDs.
 *
 * @param value - Human-readable title or name.
 * @example
 * ```ts
 * const id = slugify("Repository Intelligence V2");
 * ```
 * @returns A lowercase slug that is stable for the same input.
 */
export function slugify(value: string): string {
  const slug = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug.length > 0 ? slug : "item";
}

/**
 * Selects the deterministic template that best matches an outcome.
 *
 * @param outcome - Normalized CEO outcome text.
 * @returns The selected keyword template.
 */
function selectTemplate(outcome: string): KeywordTemplate {
  const lower = outcome.toLowerCase();

  return (
    KEYWORD_TEMPLATES.find((template) =>
      template.matches.some((keyword) => lower.includes(keyword))
    ) ?? {
      id: "general-engineering",
      matches: [],
      projectNoun: "Outcome Delivery",
      description:
        "Translate the CEO outcome into a scoped software delivery plan with clear implementation, quality, and release gates.",
      roles: ["Product Manager", "Tech Lead", "Backend Engineer", "Frontend Engineer", "Reviewer", "QA Engineer"],
    }
  );
}

/**
 * Builds a useful project name from CEO wording and the selected template.
 *
 * @param title - Outcome title.
 * @param template - Selected planning template.
 * @returns A stable project name.
 */
function buildProjectName(title: string, template: KeywordTemplate): string {
  const cleaned = normalizeWhitespace(title)
    .replace(/^(build|create|implement|add|ship|launch|develop)\s+/i, "")
    .replace(/\s+project$/i, "");

  if (cleaned.length >= MIN_OUTCOME_LENGTH) {
    return titleCase(cleaned);
  }

  return template.projectNoun;
}

/**
 * Builds the project description from outcome and repository context.
 *
 * @param input - Outcome planning input.
 * @param template - Selected planning template.
 * @param repositorySummary - Deterministic repository context summary.
 * @returns A project description suitable for a future Project row.
 */
function buildProjectDescription(
  input: OutcomePlanningInput,
  template: KeywordTemplate,
  repositorySummary: string
): string {
  const businessValue =
    input.businessValue ?? input.brief ?? "The plan preserves CEO intent while preparing approval-ready engineering work.";

  return `${template.description} ${businessValue} ${repositorySummary}`;
}

/**
 * Produces feature blueprints for the selected outcome category.
 *
 * @param templateId - Selected template identifier.
 * @param outcome - Normalized outcome text.
 * @param repositories - Sorted company repositories.
 * @returns Feature blueprints used to build generated plan payloads.
 */
function buildFeatureBlueprints(
  templateId: string,
  outcome: string,
  repositories: readonly PlanningRepositoryContext[]
): readonly FeatureBlueprint[] {
  if (templateId === "repository-intelligence") {
    return [
      {
        id: "source-model",
        milestoneId: "milestone:repository-discovery",
        title: "Repository source model and manifest detection",
        description:
          "Create a reliable repository analysis layer that understands source tree shape, package managers, manifests, frameworks, routing, and database conventions.",
        ownerRole: "Backend Engineer",
        taskBlueprints: [
          {
            id: "inspect-source-tree-model",
            title: "Inspect repository source tree model",
            description:
              "Define the deterministic file and directory signals needed to describe repository layout, entry points, app directories, generated files, and ignored paths.",
            role: "Backend Engineer",
            dependencies: [],
            acceptanceCriteria: [
              "Source tree signals are documented as deterministic metadata fields.",
              "Ignored, generated, and dependency directories are excluded from the analysis scope.",
            ],
            qaImpact: "Requires fixture repositories that cover shallow, nested, and monorepo layouts.",
            estimatePoints: 3,
          },
          {
            id: "detect-package-manager",
            title: "Detect package manager and workspace strategy",
            description:
              "Detect npm, pnpm, yarn, bun, and workspace configuration from lockfiles and package manager metadata without executing repository code.",
            role: "Backend Engineer",
            dependencies: ["task:inspect-source-tree-model"],
            acceptanceCriteria: [
              "Lockfile precedence is deterministic when multiple package managers are present.",
              "Workspace packages are listed with stable names and paths.",
            ],
            qaImpact: "Add coverage for each package manager and mixed-lockfile edge cases.",
            estimatePoints: 2,
          },
          {
            id: "parse-package-manifests",
            title: "Parse package manifests and dependency groups",
            description:
              "Parse package manifests into runtime, development, script, engine, and toolchain summaries that can be stored as repository metadata.",
            role: "Backend Engineer",
            dependencies: ["task:detect-package-manager"],
            acceptanceCriteria: [
              "Dependencies are grouped by purpose and sorted for stable output.",
              "Scripts and engine constraints are captured without leaking secrets.",
            ],
            qaImpact: "Validate malformed manifests fail with a useful repository analysis warning.",
            estimatePoints: 3,
          },
          {
            id: "detect-framework-routing",
            title: "Detect framework and routing system",
            description:
              "Identify frameworks, app routers, page routers, API routes, server actions, and build conventions from manifests and source paths.",
            role: "Tech Lead",
            dependencies: ["task:parse-package-manifests"],
            acceptanceCriteria: [
              "Framework detection includes confidence notes and source evidence.",
              "Routing system summaries distinguish UI routes from API/server entry points.",
            ],
            qaImpact: "Fixture coverage must include Next.js App Router, API routes, and a non-Next repository.",
            estimatePoints: 3,
          },
          {
            id: "identify-database-layer",
            title: "Identify database layer and persistence risks",
            description:
              "Detect ORM clients, schema files, migrations, seed files, and database adapters to summarize persistence architecture and migration risk.",
            role: "Backend Engineer",
            dependencies: ["task:parse-package-manifests"],
            acceptanceCriteria: [
              "Database technologies are listed with evidence paths.",
              "Migration and generated-client risks are included in the repository risk report inputs.",
            ],
            qaImpact: "Add fixtures for Prisma, direct SQL, and repositories without database usage.",
            estimatePoints: 3,
          },
        ],
      },
      {
        id: "api-risk-summary",
        milestoneId: "milestone:intelligence-summary",
        title: "API surface and repository risk summary",
        description:
          "Summarize backend/API boundaries, operational dependencies, and repository risks in a format useful to planning and CEO review.",
        ownerRole: "Tech Lead",
        taskBlueprints: [
          {
            id: "summarize-api-surface",
            title: "Summarize API surface and server entry points",
            description:
              "Extract route handlers, server actions, webhook endpoints, background jobs, and integration touchpoints into a concise API surface map.",
            role: "Backend Engineer",
            dependencies: ["task:detect-framework-routing"],
            acceptanceCriteria: [
              "API surface entries include path or symbol evidence.",
              "Server-only and client-triggered entry points are categorized separately.",
            ],
            qaImpact: "Use route fixture snapshots to verify stable API summaries.",
            estimatePoints: 3,
          },
          {
            id: "generate-repository-risk-report",
            title: "Generate repository risk report",
            description:
              "Produce deterministic risk findings for dependency age, missing tests, fragile routing, persistence changes, secrets exposure indicators, and deployment uncertainty.",
            role: "Reviewer",
            dependencies: ["task:summarize-api-surface", "task:identify-database-layer"],
            acceptanceCriteria: [
              "Risks include severity, evidence, owner role, and mitigation guidance.",
              "The report clearly separates confirmed facts from assumptions.",
            ],
            qaImpact: "Risk report fixtures must remain stable across repeated analysis runs.",
            estimatePoints: 3,
          },
        ],
      },
      {
        id: "repository-intelligence-ui",
        milestoneId: "milestone:reviewable-delivery",
        title: "Repository intelligence UI and planning integration",
        description:
          "Expose repository intelligence summaries where Avion users review repositories and prepare outcome plans.",
        ownerRole: "Frontend Engineer",
        taskBlueprints: [
          {
            id: "expose-summary-ui",
            title: "Expose repository intelligence summary in UI",
            description:
              "Add a readable repository intelligence section showing stack, frameworks, routing, database layer, API surface, risks, and analysis freshness.",
            role: "Frontend Engineer",
            dependencies: ["task:generate-repository-risk-report"],
            acceptanceCriteria: [
              "UI renders a useful empty state when repository metadata is incomplete.",
              "Risk and stack summaries are scannable without exposing raw JSON.",
            ],
            qaImpact: "Add UI state coverage for analyzed, pending, and failed repository analysis states.",
            estimatePoints: 3,
          },
          {
            id: "add-analysis-qa-coverage",
            title: "Add QA coverage for repository analysis",
            description:
              "Cover repository analysis fixtures, metadata serialization, deterministic ordering, and UI summary rendering with automated and manual QA checks.",
            role: "QA Engineer",
            dependencies: ["task:expose-summary-ui"],
            acceptanceCriteria: [
              "QA checks cover generator determinism and repository metadata edge cases.",
              "Manual QA script includes at least one connected repository with incomplete metadata.",
            ],
            qaImpact: "This task owns final QA evidence for the repository intelligence flow.",
            estimatePoints: 2,
          },
        ],
      },
    ];
  }

  const repositoryContext =
    repositories.length > 0
      ? "Use connected repository metadata to avoid duplicate architecture discovery."
      : "Start from existing code and documentation because repository metadata is not yet attached.";

  return [
    {
      id: "outcome-definition",
      milestoneId: "milestone:scope-definition",
      title: "Outcome definition and acceptance boundary",
      description: `Convert "${outcome}" into a clear implementation boundary, success model, and approval package. ${repositoryContext}`,
      ownerRole: "Product Manager",
      taskBlueprints: [
        {
          id: "write-outcome-brief",
          kind: "analysis",
          title: "Write outcome brief and measurable acceptance criteria",
          description:
            "Transform CEO intent into a short outcome brief with business value, user/system impact, non-scope, and measurable completion criteria.",
          role: "Product Manager",
          dependencies: [],
          acceptanceCriteria: [
            "Outcome brief explains why the work exists and what visible result proves success.",
            "Non-scope explicitly prevents drift into unrelated follow-up work.",
          ],
          qaImpact: "QA can trace each future test back to explicit acceptance criteria.",
          estimatePoints: 2,
        },
      ],
    },
    {
      id: "technical-design",
      milestoneId: "milestone:implementation-path",
      title: "Technical design and implementation path",
      description:
        "Define data, API, UI, integration, and operational changes needed to deliver the outcome safely.",
      ownerRole: "Tech Lead",
      taskBlueprints: [
        {
          id: "map-code-touchpoints",
          kind: "analysis",
          title: "Map affected code, data, and integration touchpoints",
          description:
            "Identify concrete modules, data models, actions/routes, integrations, and UI surfaces that need to change before implementation begins.",
          role: "Tech Lead",
          dependencies: ["task:write-outcome-brief"],
          acceptanceCriteria: [
            "Touchpoints are grouped by ownership area and risk.",
            "Unknown repository or integration context is listed as a dependency, not guessed.",
          ],
          qaImpact: "Touchpoint map becomes the basis for regression coverage.",
          estimatePoints: 3,
        },
        {
          id: "define-data-api-contracts",
          kind: "analysis",
          title: "Define data and API contracts for the outcome",
          description:
            "Specify the data shape, validation rules, server action or route contract, idempotency behavior, and ownership checks required by the outcome.",
          role: "Backend Engineer",
          dependencies: ["task:map-code-touchpoints"],
          acceptanceCriteria: [
            "Contracts include validation, authorization, and error states.",
            "Persistence changes preserve company ownership boundaries.",
          ],
          qaImpact: "Contract tests can be written before implementation.",
          estimatePoints: 3,
        },
        {
          id: "design-user-workflow",
          kind: "analysis",
          title: "Design user workflow and UI states",
          description:
            "Define entry points, success states, empty states, loading states, failure states, and the information hierarchy for the user-facing workflow.",
          role: "Frontend Engineer",
          dependencies: ["task:define-data-api-contracts"],
          acceptanceCriteria: [
            "Workflow covers happy path, validation errors, and missing-context states.",
            "UI states map directly to server response states.",
          ],
          qaImpact: "UI QA can validate state transitions without requiring live execution records.",
          estimatePoints: 3,
        },
        {
          // The delivery task (MUS-274): the design tasks above only describe the
          // change; without this task a deterministic plan ships documentation and
          // the outcome still reports `completed`. The outcome goal is carried in
          // the acceptanceCriteria (not just the description) because the execution
          // brief renders title + acceptanceCriteria, not the task description (MUS-277).
          id: "implement-outcome",
          kind: "implementation",
          title: `Implement the requested change: ${outcome}`,
          description:
            `Make the actual code change the CEO requested — implement "${outcome}" in real product code, guided by the touchpoint map, the data/API contracts, and the user-workflow design from the preceding tasks. This is the delivery task: when it is done, the visible result described in the outcome brief must exist in the repository and be exercised by the repo's real build/test commands. A documentation-only change does not satisfy this task. ${repositoryContext}`,
          role: "Backend Engineer",
          dependencies: ["task:design-user-workflow"],
          acceptanceCriteria: [
            `The change described by the outcome — "${outcome}" — is implemented in real product code (not documentation), and the visible result the outcome brief describes exists in the repository.`,
            "The repository's real validation commands (build and tests) pass against the change; existing tests are updated to reflect the intended behavior rather than skipped or deleted.",
          ],
          qaImpact:
            "QA validates the implemented change against the acceptance criteria and the repository's real build/test results — the primary evidence the outcome was actually delivered.",
          estimatePoints: 5,
        },
      ],
    },
    {
      id: "quality-release",
      milestoneId: "milestone:quality-release-readiness",
      title: "Quality, review, and release readiness",
      description:
        "Prepare independent review, QA evidence, documentation, and release controls before the outcome can ship.",
      ownerRole: "QA Engineer",
      taskBlueprints: [
        {
          id: "create-review-checklist",
          kind: "analysis",
          title: "Create review checklist for ownership, correctness, and risk",
          description:
            "Define reviewer checks for correctness, company ownership, idempotency, observability, security, and user-facing behavior.",
          role: "Reviewer",
          dependencies: ["task:implement-outcome"],
          acceptanceCriteria: [
            "Checklist includes required evidence and change-request triggers.",
            "Review scope is independent from implementation ownership.",
          ],
          qaImpact: "Review findings feed into QA readiness before release.",
          estimatePoints: 2,
        },
        {
          id: "create-qa-release-plan",
          kind: "analysis",
          title: "Create QA and release verification plan",
          description:
            "Define automated checks, manual test scenarios, release readiness criteria, rollback trigger, and CEO acceptance evidence.",
          role: "QA Engineer",
          dependencies: ["task:create-review-checklist"],
          acceptanceCriteria: [
            "QA plan covers unit, integration, build, and representative user workflow checks.",
            "Release plan includes rollback and post-release monitoring expectations.",
          ],
          qaImpact: "This task produces the final QA sign-off checklist for the outcome.",
          estimatePoints: 2,
        },
      ],
    },
  ];
}

/**
 * Builds deterministic milestones for the generated project payload.
 *
 * @param templateId - Selected template identifier.
 * @param projectName - Generated project name.
 * @param repositories - Sorted company repositories.
 * @returns Milestones nested inside the generated project draft.
 */
function buildMilestones(
  templateId: string,
  projectName: string,
  repositories: readonly PlanningRepositoryContext[]
): readonly PlanningMilestone[] {
  if (templateId === "repository-intelligence") {
    return [
      {
        id: "milestone:repository-discovery",
        title: "Repository discovery model complete",
        description:
          "The repository analyzer can deterministically identify source layout, package manager, manifests, frameworks, routing, and persistence signals.",
        deliverables: [
          "Source tree signal model",
          "Package manager and manifest parser",
          "Framework, routing, and database layer detector",
        ],
        acceptanceCriteria: [
          "Analyzer outputs stable metadata for repeated runs over the same repository.",
          "Missing or malformed metadata produces clear warnings instead of execution claims.",
        ],
        estimatedOrder: 1,
      },
      {
        id: "milestone:intelligence-summary",
        title: "Repository intelligence summary complete",
        description:
          "API surface, dependency context, and repository risks are summarized with evidence and mitigation guidance.",
        deliverables: ["API surface summary", "Repository risk report", "Planning-ready metadata payload"],
        acceptanceCriteria: [
          "Summary distinguishes facts, assumptions, and unresolved repository questions.",
          "Risks include owner role and mitigation guidance.",
        ],
        estimatedOrder: 2,
      },
      {
        id: "milestone:reviewable-delivery",
        title: "Reviewable repository intelligence experience complete",
        description:
          "The repository intelligence summary is visible in Avion and covered by QA and release readiness checks.",
        deliverables: ["Repository intelligence UI", "QA evidence", "Release readiness checklist"],
        acceptanceCriteria: [
          "Users can review repository intelligence without reading raw JSON.",
          "QA has validated pending, analyzed, and incomplete metadata states.",
        ],
        estimatedOrder: 3,
      },
    ];
  }

  const repositoryDeliverable =
    repositories.length > 0 ? `Repository context reviewed: ${repositories.map((repo) => repo.name).join(", ")}` : "Repository context gap documented";

  return [
    {
      id: "milestone:scope-definition",
      title: `${projectName} scope and acceptance boundary complete`,
      description: "The outcome has a clear business purpose, non-scope, acceptance criteria, and approval-ready framing.",
      deliverables: ["Outcome brief", "Scope/non-scope boundary", "Acceptance criteria"],
      acceptanceCriteria: [
        "CEO intent is preserved without adding unrelated work.",
        "Ambiguities are either resolved from context or listed as CEO questions.",
      ],
      estimatedOrder: 1,
    },
    {
      id: "milestone:implementation-path",
      title: `${projectName} implementation path complete`,
      description: "Engineering has a concrete data, API, UI, and integration strategy for later approved execution.",
      deliverables: ["Technical touchpoint map", "Data/API contracts", repositoryDeliverable],
      acceptanceCriteria: [
        "Implementation steps can be assigned without creating real work records yet.",
        "Ownership and idempotency constraints are explicit.",
      ],
      estimatedOrder: 2,
    },
    {
      id: "milestone:quality-release-readiness",
      title: `${projectName} quality and release plan complete`,
      description: "Review, QA, release, rollback, and CEO acceptance evidence are prepared before delivery starts.",
      deliverables: ["Review checklist", "QA plan", "Release plan"],
      acceptanceCriteria: [
        "QA and release criteria are specific enough for later execution.",
        "No execution status is claimed before approval.",
      ],
      estimatedOrder: 3,
    },
  ];
}

/**
 * Converts a feature blueprint into a generated planning feature.
 *
 * @param blueprint - Feature blueprint.
 * @param projectPlanItemId - Parent generated project ID.
 * @param employees - Sorted employee context.
 * @param order - Estimated execution order.
 * @returns Generated feature payload.
 */
function buildFeature(
  blueprint: FeatureBlueprint,
  projectPlanItemId: string,
  employees: readonly PlanningEmployeeContext[],
  order: number,
  allFeatures: readonly FeatureBlueprint[]
): GeneratedPlanningFeature {
  const previousFeature = order > 1 ? allFeatures[order - 2] : undefined;

  return {
    planItemId: `feature:${blueprint.id}`,
    projectPlanItemId,
    milestoneId: blueprint.milestoneId,
    title: blueprint.title,
    description: blueprint.description,
    ownerRole: blueprint.ownerRole,
    ...findOwnerAssignment(blueprint.ownerRole, employees),
    dependencies: previousFeature !== undefined ? [`feature:${previousFeature.id}`] : [],
    risks: [`${blueprint.title} may need revision if CEO acceptance criteria change before approval.`],
    acceptanceCriteria: [
      `${blueprint.title} has concrete task instructions with dependencies and QA expectations.`,
      "Generated work remains inside PlanningDraft until approval and apply steps run.",
    ],
    qaExpectations: [
      "Review generated tasks for deterministic ordering.",
      "Verify each task has acceptance criteria and a role recommendation.",
    ],
    releaseRelevance: "Included in release readiness once approved work is applied and validated.",
    estimatedExecutionOrder: order,
  };
}

/**
 * Converts a task blueprint into a generated planning task.
 *
 * @param blueprint - Task blueprint.
 * @param feature - Parent feature blueprint.
 * @param employees - Sorted employee context.
 * @param order - Estimated execution order.
 * @returns Generated task payload.
 */
function buildTask(
  blueprint: TaskBlueprint,
  feature: FeatureBlueprint,
  employees: readonly PlanningEmployeeContext[],
  repositories: readonly PlanningRepositoryContext[],
  templateId: string,
  order: number
): GeneratedPlanningTask {
  const baseTask: GeneratedPlanningTask = {
    planItemId: `task:${blueprint.id}`,
    featurePlanItemId: `feature:${feature.id}`,
    title: blueprint.title,
    description: blueprint.description,
    recommendedRole: blueprint.role,
    ...findRecommendedAssignment(blueprint.role, employees),
    dependencies: blueprint.dependencies,
    acceptanceCriteria: blueprint.acceptanceCriteria,
    definitionOfDone: [
      "Implementation approach is documented in the eventual task handoff.",
      "Acceptance criteria are satisfied with evidence.",
      "Reviewer and QA expectations are ready before status can move beyond implementation.",
    ],
    requiredContext: [
      "Source Outcome and PlanningDraft identifiers",
      "Relevant repository metadata and known constraints",
      "Company ownership and idempotency invariants",
    ],
    reviewRequirements: [
      "Independent reviewer checks correctness, ownership boundaries, and regression risk.",
      "Change requests must be captured before QA sign-off.",
    ],
    qaImpact: blueprint.qaImpact,
    estimatedExecutionOrder: order,
    estimatePoints: blueprint.estimatePoints,
    kind: blueprint.kind ?? "implementation",
  };

  return enrichTaskWithRepositoryContext(baseTask, blueprint.id, repositories, templateId);
}

const REPOSITORY_INTELLIGENCE_TASK_HINTS: Readonly<
  Record<string, { readonly modules: readonly string[]; readonly extraAcceptance: readonly string[] }>
> = {
  "inspect-source-tree-model": {
    modules: ["src/lib/repository-analyzer.ts", "src/lib/repository-snapshot-service.ts"],
    extraAcceptance: [
      "File tree ingestion excludes ignored, vendor, build, and generated directories.",
      "Snapshot output is versioned and can be re-run without mutating repository state.",
    ],
  },
  "detect-package-manager": {
    modules: ["src/lib/repository-analyzer.ts", "package.json", "package-lock.json"],
    extraAcceptance: [
      "Detection covers npm, pnpm, yarn, and bun lockfile signals when present.",
      "Workspace package boundaries are listed with stable relative paths.",
    ],
  },
  "parse-package-manifests": {
    modules: ["package.json", "src/lib/repository-analyzer.ts"],
    extraAcceptance: [
      "Scripts for lint, build, test, and typecheck are extracted when declared.",
      "Dependency groups distinguish runtime, development, and toolchain packages.",
    ],
  },
  "detect-framework-routing": {
    modules: ["src/app/", "next.config.ts", "src/lib/repository-analyzer.ts"],
    extraAcceptance: [
      "Next.js App Router routes and API handlers are detected with evidence paths.",
      "Framework detection records confidence notes instead of overstating certainty.",
    ],
  },
  "identify-database-layer": {
    modules: ["prisma/schema.prisma", "prisma/migrations/", "src/lib/repository-analyzer.ts"],
    extraAcceptance: [
      "Prisma schema, migration, and seed paths are captured when present.",
      "Persistence risks include migration drift and generated-client freshness.",
    ],
  },
  "summarize-api-surface": {
    modules: ["src/app/actions/", "src/app/api/", "src/lib/repository-analyzer.ts"],
    extraAcceptance: [
      "Server actions, route handlers, and webhook entry points are categorized separately.",
      "Each API surface entry includes a path or symbol evidence reference.",
    ],
  },
  "generate-repository-risk-report": {
    modules: ["src/lib/repository-impact-analysis.ts", "src/lib/repository-change-intelligence.ts"],
    extraAcceptance: [
      "Risk findings include severity, evidence path, owner role, and mitigation guidance.",
      "Confirmed repository facts are separated from assumptions and unknowns.",
    ],
  },
  "expose-summary-ui": {
    modules: ["src/app/(app)/", "src/app/actions/repository.ts"],
    extraAcceptance: [
      "Dashboard renders analyzed, pending, and incomplete repository states truthfully.",
      "Evidence paths for stack, routing, database, and risk claims are visible to users.",
    ],
  },
  "add-analysis-qa-coverage": {
    modules: ["src/lib/planning-generator.test.ts", "src/lib/repository-snapshot-dogfood.test.ts"],
    extraAcceptance: [
      "Automated tests cover deterministic ordering and incomplete-metadata edge cases.",
      "Manual QA script includes at least one repository with partial analysis metadata.",
    ],
  },
};

/**
 * Enriches a generated task with repository-specific context and acceptance criteria.
 *
 * @param task - Base generated task payload.
 * @param taskBlueprintId - Task blueprint identifier.
 * @param repositories - Sorted repository context rows.
 * @param templateId - Selected planning template identifier.
 * @returns Task payload enriched with repository-aware implementation guidance.
 */
function enrichTaskWithRepositoryContext(
  task: GeneratedPlanningTask,
  taskBlueprintId: string,
  repositories: readonly PlanningRepositoryContext[],
  templateId: string
): GeneratedPlanningTask {
  if (repositories.length === 0 || templateId !== "repository-intelligence") {
    return task;
  }

  const hints = REPOSITORY_INTELLIGENCE_TASK_HINTS[taskBlueprintId];
  const repositoryNames = repositories.map((repo) => repo.name).join(", ");
  const importantFiles = [
    ...new Set(repositories.flatMap((repo) => repo.importantFiles).filter(Boolean)),
  ].slice(0, 8);
  const stackSummary = [
    ...new Set(
      repositories.flatMap((repo) => [
        ...repo.frameworks,
        ...repo.techStack,
        ...(repo.primaryLanguage ? [repo.primaryLanguage] : []),
      ])
    ),
  ]
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");

  const requiredContext = [
    ...task.requiredContext,
    `Attached repositories: ${repositoryNames}.`,
    stackSummary.length > 0 ? `Detected stack context: ${stackSummary}.` : "Repository stack metadata is incomplete.",
    ...(hints?.modules.map((modulePath) => `Inspect ${modulePath} before implementation.`) ?? []),
    ...importantFiles.map((filePath) => `Review repository evidence file: ${filePath}.`),
  ];

  const acceptanceCriteria = [
    ...task.acceptanceCriteria,
    ...(hints?.extraAcceptance ?? []),
    `Validation commands pass for ${repositoryNames}: npx prisma validate, npx tsc --noEmit, npm run lint, npm run test.`,
  ].slice(0, 6);

  const descriptionSuffix =
    stackSummary.length > 0
      ? ` Use attached repository context (${repositoryNames}; ${stackSummary}) to keep the task concrete for implementation agents.`
      : ` Confirm repository facts for ${repositoryNames} before claiming detection behavior.`;

  return {
    ...task,
    description: `${task.description}${descriptionSuffix}`,
    requiredContext,
    acceptanceCriteria,
    definitionOfDone: [
      ...task.definitionOfDone,
      "Repository validation commands listed in the task acceptance criteria pass locally.",
    ],
  };
}

/**
 * Builds plan scope entries.
 *
 * @param templateId - Selected template identifier.
 * @param outcome - Normalized outcome text.
 * @param repositories - Sorted company repositories.
 * @returns Scope entries for the draft.
 */
function buildScope(
  templateId: string,
  outcome: string,
  repositories: readonly PlanningRepositoryContext[]
): readonly string[] {
  const repositoryScope =
    repositories.length > 0
      ? [`Use attached repository metadata from ${repositories.map((repo) => repo.name).join(", ")}.`]
      : ["Document repository metadata gaps and avoid guessing unavailable codebase facts."];

  if (templateId === "repository-intelligence") {
    return [
      `Plan the Repository Intelligence V2 outcome: ${outcome}.`,
      "Analyze repository source tree, manifests, package manager, framework, routing, database, API, and risk signals.",
      "Expose the resulting intelligence in a UI-ready summary.",
      ...repositoryScope,
      ...COMMON_SCOPE,
    ];
  }

  return [`Plan the CEO outcome: ${outcome}.`, ...repositoryScope, ...COMMON_SCOPE];
}

/**
 * Builds deterministic assumptions.
 *
 * @param templateId - Selected template identifier.
 * @param repositories - Sorted company repositories.
 * @returns Draft assumptions.
 */
function buildAssumptions(
  templateId: string,
  repositories: readonly PlanningRepositoryContext[]
): readonly string[] {
  const repositoryAssumption =
    repositories.length > 0
      ? `Attached repository metadata is current for: ${repositories.map((repo) => repo.name).join(", ")}.`
      : "No attached repository metadata is available, so repository-specific facts must be confirmed before execution.";

  const base = [
    "The CEO wants a plan first, not immediate execution.",
    "The current company employees and role definitions are the available assignment pool.",
    repositoryAssumption,
  ];

  if (templateId === "repository-intelligence") {
    return [
      ...base,
      "Repository analysis must be read-only and deterministic in this planning version.",
      "Repository metadata can be incomplete and should produce explicit warnings rather than hidden assumptions.",
    ];
  }

  return base;
}

/**
 * Builds deterministic dependencies for the draft.
 *
 * @param templateId - Selected template identifier.
 * @param repositories - Sorted company repositories.
 * @param features - Generated feature payloads.
 * @returns Dependency map entries.
 */
function buildDependencies(
  templateId: string,
  repositories: readonly PlanningRepositoryContext[],
  features: readonly GeneratedPlanningFeature[]
): readonly PlanningDependency[] {
  const dependencies: PlanningDependency[] = [
    {
      id: "dependency:ceo-approval",
      type: "approval",
      description: "CEO must approve the planning draft before generated work records can be created.",
      blocks: features.map((feature) => feature.planItemId),
      requiredBeforeOrder: 99,
    },
  ];

  if (repositories.length === 0) {
    dependencies.unshift({
      id: "dependency:repository-context",
      type: "repository",
      description: "Repository metadata is missing and should be attached or confirmed before execution starts.",
      blocks: features.map((feature) => feature.planItemId),
      requiredBeforeOrder: 1,
    });
  } else {
    dependencies.unshift({
      id: "dependency:repository-metadata-freshness",
      type: "repository",
      description: `Repository metadata freshness should be confirmed for ${repositories.map((repo) => repo.name).join(", ")}.`,
      blocks: features.slice(0, 2).map((feature) => feature.planItemId),
      requiredBeforeOrder: 1,
    });
  }

  if (templateId === "repository-intelligence") {
    dependencies.splice(1, 0, {
      id: "dependency:manifest-fixtures",
      type: "technical",
      description: "Representative fixture repositories are needed to validate package manager, framework, routing, and database detection.",
      blocks: ["task:detect-package-manager", "task:detect-framework-routing", "task:identify-database-layer"],
      requiredBeforeOrder: 2,
    });
  }

  return dependencies;
}

/**
 * Builds deterministic risk entries.
 *
 * @param templateId - Selected template identifier.
 * @param repositories - Sorted company repositories.
 * @returns Risk register entries.
 */
/** Maximum memory-derived assumptions rendered into a deterministic plan. */
const MAX_MEMORY_ASSUMPTIONS = 5;

/**
 * Renders durable company memory into plan assumptions so the deterministic
 * generator (the default provider) also compounds prior experience — not just
 * the AI planner. Standards and lessons become explicit, reviewable plan lines.
 *
 * @param memory - Retrieved company memory, highest-confidence first.
 * @returns Assumption lines, capped at {@link MAX_MEMORY_ASSUMPTIONS}.
 */
export function buildMemoryAssumptions(
  memory: readonly CompanyMemoryItem[] | undefined
): readonly string[] {
  if (!memory || memory.length === 0) return [];
  return memory
    .slice(0, MAX_MEMORY_ASSUMPTIONS)
    .map(
      (item) =>
        `Company memory (${item.category}): ${item.content} — the plan and its execution must honor this.`
    );
}

function buildRisks(
  templateId: string,
  repositories: readonly PlanningRepositoryContext[]
): readonly PlanningRisk[] {
  const risks: PlanningRisk[] = [
    {
      id: "risk:premature-work-creation",
      severity: "high",
      description: "Generated work could be mistaken for approved execution work.",
      mitigation: "Keep all generated projects, features, and tasks inside PlanningDraft until MUS-142 approval/apply logic runs.",
      ownerRole: "Tech Lead",
    },
    {
      id: "risk:incomplete-context",
      severity: repositories.length > 0 ? "medium" : "high",
      description:
        repositories.length > 0
          ? "Attached repository metadata may be stale or incomplete."
          : "No attached repository metadata is available for repository-specific decisions.",
      mitigation: "Record assumptions and CEO questions; require context confirmation before approved execution starts.",
      ownerRole: "Product Manager",
    },
  ];

  if (templateId === "repository-intelligence") {
    risks.push({
      id: "risk:overconfident-detection",
      severity: "medium",
      description: "Repository detectors may overstate confidence when conventions overlap across frameworks or package managers.",
      mitigation: "Store evidence paths and confidence notes for each detected repository signal.",
      ownerRole: "Reviewer",
    });
  }

  return risks;
}

/**
 * Builds acceptance criteria for the generated project.
 *
 * @param templateId - Selected template identifier.
 * @param projectName - Generated project name.
 * @returns Project-level acceptance criteria.
 */
function buildAcceptanceCriteria(templateId: string, projectName: string): readonly string[] {
  if (templateId === "repository-intelligence") {
    return [
      "Planning draft includes project, milestones, features, and specific execution-ready tasks for Repository Intelligence V2.",
      "Plan covers source tree, package manager, manifest, framework/routing, database, API, risk report, UI, QA, and release work.",
      "Plan recommends company roles or employees where available.",
      "No real work records are created before CEO approval.",
    ];
  }

  return [
    `${projectName} has a complete planning draft with scope, non-scope, milestones, features, tasks, dependencies, risks, and acceptance criteria.`,
    "Plan recommends company roles or employees where available.",
    "Review, QA, and release strategies are specific enough for approval discussion.",
    "No real work records are created before CEO approval.",
  ];
}

/**
 * Builds CEO questions for unresolved planning decisions.
 *
 * @param templateId - Selected template identifier.
 * @param constraints - Existing outcome constraints.
 * @param repositories - Sorted company repositories.
 * @returns Focused CEO questions.
 */
function buildOpenCeoQuestions(
  templateId: string,
  constraints: readonly string[],
  repositories: readonly PlanningRepositoryContext[]
): readonly string[] {
  const questions = [
    "What deadline or release window should constrain this plan, if any?",
    "Are there explicit exclusions or tradeoffs the CEO wants preserved before approval?",
  ];

  if (constraints.length === 0) {
    questions.push("Are there budget, compliance, migration, or customer commitments that should constrain execution?");
  }

  if (repositories.length === 0) {
    questions.push("Which repository or workspace should this plan use as the source of truth?");
  }

  if (templateId === "repository-intelligence") {
    questions.push("Should Repository Intelligence V2 prioritize analysis accuracy, UI visibility, or integration into future planning first?");
  }

  return questions;
}

/**
 * Builds the review plan.
 *
 * @param templateId - Selected template identifier.
 * @returns Review plan payload.
 */
function buildReviewPlan(templateId: string): PlanningReviewPlan {
  const checkpoints = [
    "Verify every generated item traces to the source Outcome and PlanningDraft.",
    "Confirm generated work remains draft-only and does not imply execution has started.",
    "Check company ownership, idempotency, and rejection guard invariants.",
  ];

  if (templateId === "repository-intelligence") {
    checkpoints.push("Review repository detectors for evidence-backed output and deterministic ordering.");
  }

  return {
    ownerRole: "Reviewer",
    requiredReviewers: ["Tech Lead", "Reviewer"],
    checkpoints,
    approvalGate: "CEO approval is required before any generated work records are applied.",
  };
}

/**
 * Builds the QA plan.
 *
 * @param templateId - Selected template identifier.
 * @returns QA plan payload.
 */
function buildQaPlan(templateId: string): PlanningQaPlan {
  const requiredChecks = [
    "Unit test deterministic plan generation for stable output.",
    "Validate empty, vague, and unsupported outcomes fail with clear CEO questions.",
    "Verify generated plans include dependencies, risks, review, QA, release, assignments, and acceptance criteria.",
    "Confirm no Project, Feature, Task, Review, QAResult, or Release rows are created during generation.",
  ];

  if (templateId === "repository-intelligence") {
    requiredChecks.push(
      "Fixture-test package manager, manifest, framework/routing, database, API surface, and risk report planning coverage."
    );
  }

  return {
    ownerRole: "QA Engineer",
    strategy: "Use deterministic generator tests plus manual review of the runtime planning draft event.",
    requiredChecks,
    evidenceRequired: [
      "Generator test output",
      "Prisma validation",
      "Lint, build, and TypeScript test results",
      "Runtime event showing plan generation or failure",
    ],
  };
}

/**
 * Builds the release plan.
 *
 * @param templateId - Selected template identifier.
 * @returns Release plan payload.
 */
function buildReleasePlan(templateId: string): PlanningReleasePlan {
  return {
    ownerRole: "Release Manager",
    strategy:
      templateId === "repository-intelligence"
        ? "Release repository intelligence planning as a draft-generation capability first; defer work application and live repository scanning to later approved tickets."
        : "Release the deterministic planning capability behind existing intake flows before adding approval/apply automation.",
    readinessCriteria: [
      "PlanningDraft rows are generated or failed deterministically.",
      "Runtime/timeline events are written for generation success and failure.",
      "No downstream work records are created before approval.",
      "Validation commands pass.",
    ],
    rolloutSteps: [
      "Deploy generator and server action.",
      "Submit representative CEO outcome through existing intake.",
      "Inspect generated PlanningDraft and runtime event.",
      "Keep approval/apply flow disabled until its own ticket ships.",
    ],
    rollbackPlan: "Disable the trigger action and leave existing Outcome records intact; generated draft rows can remain historical planning artifacts.",
  };
}

/**
 * Builds recommended assignment groups from generated tasks.
 *
 * @param tasks - Generated task payloads.
 * @param employees - Sorted employee context.
 * @returns Assignment recommendations grouped by role.
 */
function buildAssignments(
  tasks: readonly GeneratedPlanningTask[],
  employees: readonly PlanningEmployeeContext[]
): readonly PlanningAssignmentRecommendation[] {
  const roles = [...new Set(tasks.map((task) => task.recommendedRole))].sort((a, b) => a.localeCompare(b));

  return roles.map((role) => {
    const assignment = findEmployeeForRole(role, employees);
    const taskPlanItemIds = tasks
      .filter((task) => task.recommendedRole === role)
      .map((task) => task.planItemId);

    return {
      role,
      employeeId: assignment?.id ?? null,
      employeeName: assignment?.name ?? null,
      reason:
        assignment !== undefined
          ? `${assignment.name} matches the ${role} responsibility area.`
          : `No active ${role} employee was found; keep this as a role recommendation until staffing is confirmed.`,
      taskPlanItemIds,
    };
  });
}

/**
 * Finds owner assignment fields for generated projects and features.
 *
 * @param role - Desired role name.
 * @param employees - Sorted company employee context.
 * @returns Owner assignment fields.
 */
function findOwnerAssignment(
  role: string,
  employees: readonly PlanningEmployeeContext[]
): Pick<GeneratedPlanningProject, "ownerEmployeeId" | "ownerEmployeeName"> {
  const employee = findEmployeeForRole(role, employees);

  return {
    ownerEmployeeId: employee?.id ?? null,
    ownerEmployeeName: employee?.name ?? null,
  };
}

/**
 * Finds recommended assignment fields for generated tasks.
 *
 * @param role - Desired role name.
 * @param employees - Sorted company employee context.
 * @returns Recommended task assignment fields.
 */
function findRecommendedAssignment(
  role: string,
  employees: readonly PlanningEmployeeContext[]
): Pick<GeneratedPlanningTask, "recommendedEmployeeId" | "recommendedEmployeeName"> {
  const employee = findEmployeeForRole(role, employees);

  return {
    recommendedEmployeeId: employee?.id ?? null,
    recommendedEmployeeName: employee?.name ?? null,
  };
}

/**
 * Finds the best deterministic employee for a requested role.
 *
 * @param role - Desired role name.
 * @param employees - Sorted company employee context.
 * @returns Matching employee context when available.
 */
function findEmployeeForRole(
  role: string,
  employees: readonly PlanningEmployeeContext[]
): PlanningEmployeeContext | undefined {
  const normalizedRole = role.toLowerCase();

  return (
    employees.find((candidate) => candidate.roleName?.toLowerCase() === normalizedRole) ??
    employees.find((candidate) => candidate.title?.toLowerCase() === normalizedRole) ??
    employees.find((candidate) => candidate.name.toLowerCase() === normalizedRole) ??
    employees.find((candidate) => candidate.responsibilities?.toLowerCase().includes(normalizedRole))
  );
}

/**
 * Summarizes attached repository metadata for plan descriptions.
 *
 * @param repositories - Sorted repository context.
 * @returns Human-readable repository summary.
 */
function summarizeRepositories(repositories: readonly PlanningRepositoryContext[]): string {
  if (repositories.length === 0) {
    return "No attached repository metadata is available yet.";
  }

  const summaries = repositories.map((repo) => {
    const stack = [...repo.frameworks, ...repo.techStack, repo.primaryLanguage]
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .slice(0, 4)
      .join(", ");
    const latestChange =
      repo.latestChangeSummary && repo.latestChangeImpactLevel
        ? ` Latest changes: ${repo.latestChangeImpactLevel} impact across ${repo.latestChangeAffectedAreas.join(", ") || "unclassified areas"} - ${repo.latestChangeSummary}`
        : "";

    return stack.length > 0 ? `${repo.name} (${stack}).${latestChange}` : `${repo.name}.${latestChange}`;
  });

  return `Attached repository context: ${summaries.join("; ")}.`;
}

/**
 * Sorts employees for deterministic assignment selection.
 *
 * @param employees - Employee context rows.
 * @returns Sorted employee rows.
 */
function sortEmployees(
  employees: readonly PlanningEmployeeContext[]
): readonly PlanningEmployeeContext[] {
  return [...employees].sort((a, b) => {
    const roleCompare = (a.roleName ?? "").localeCompare(b.roleName ?? "");
    if (roleCompare !== 0) return roleCompare;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Sorts repositories for deterministic metadata use.
 *
 * @param repositories - Repository context rows.
 * @returns Sorted repository rows.
 */
function sortRepositories(
  repositories: readonly PlanningRepositoryContext[]
): readonly PlanningRepositoryContext[] {
  return [...repositories].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalizes internal whitespace in user or metadata text.
 *
 * @param value - Text to normalize.
 * @returns Text with single spaces and trimmed ends.
 */
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Counts meaningful words for validation.
 *
 * @param value - Input text.
 * @returns Count of words longer than one character.
 */
function countMeaningfulWords(value: string): number {
  return normalizeWhitespace(value)
    .split(" ")
    .filter((word) => /[a-z0-9]{2,}/i.test(word)).length;
}

/**
 * Converts a short project label to title case.
 *
 * @param value - Project label.
 * @returns Title-cased label.
 */
function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
