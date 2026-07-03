import { getCultureGuidance } from "@/lib/company-culture";
import type {
  OutcomePlanningInput,
  PlanningEmployeeContext,
  PlanningRepositoryContext,
} from "@/lib/planning-generator";

/**
 * System + user prompt pair for the AI planning adapter.
 *
 * The `system` prompt frames the model as the Avion planning organization and
 * fixes the output contract; the `prompt` grounds it in the real outcome, employee roster,
 * and repository intelligence.
 */
export interface PlanningPromptPair {
  readonly system: string;
  readonly prompt: string;
}

/**
 * Builds the system prompt that frames the model and fixes the JSON output contract.
 *
 * @returns The Avion planning system prompt.
 */
function buildSystemPrompt(): string {
  return [
    "You are the Avion planning organization: a Product Manager, Tech Lead, and",
    "Quality lead working together to turn a CEO outcome into an approval-ready delivery plan.",
    "You do NOT write code or create real work records — you produce a single planning draft",
    "that a human CEO will review before any execution begins.",
    "",
    "OUTPUT CONTRACT (hard requirements):",
    "- Respond with a SINGLE JSON object and nothing else. No prose, no markdown, no code fences.",
    "- The JSON object MUST match the DeterministicPlanningDraft schema exactly, with these keys:",
    "  generatorVersion, title, summary, status, scope, nonScope, assumptions, risks, dependencies,",
    "  recommendedAssignments, generatedProjects, generatedFeatures, generatedTasks, reviewPlan,",
    "  qaPlan, releasePlan, openCeoQuestions, acceptanceCriteria, estimatedExecutionOrder.",
    '- "status" must be the string "draft".',
    "- The draft MUST pass quality validation, so it MUST include:",
    "  - At least 1 generatedProjects entry; each project MUST have a non-empty milestones array,",
    "    and every milestone MUST have non-empty acceptanceCriteria. Each project also needs its own",
    "    non-empty acceptanceCriteria, an ownerRole, planItemId, name, description, and estimatedExecutionOrder.",
    "  - At least 1 generatedFeatures entry; each feature MUST have non-empty acceptanceCriteria and a",
    "    non-empty ownerRole, plus planItemId, projectPlanItemId, milestoneId, title, description,",
    "    dependencies, risks, qaExpectations, releaseRelevance, and estimatedExecutionOrder.",
    "  - At least 1 generatedTasks entry; each task MUST have a description of at least 48 characters,",
    "    at least 2 acceptanceCriteria, a non-empty recommendedRole, a non-empty definitionOfDone array,",
    "    and a non-empty requiredContext array, plus planItemId, featurePlanItemId, title, dependencies,",
    "    reviewRequirements, qaImpact, estimatedExecutionOrder, estimatePoints, and kind.",
    "  - Non-empty risks, dependencies, assumptions, and openCeoQuestions arrays.",
    "  - reviewPlan.checkpoints, qaPlan.requiredChecks, and releasePlan.readinessCriteria must be non-empty.",
    "",
    "TASK DISCIPLINE (generatedTasks are executable work, not paperwork):",
    "- Each task is executed by an autonomous coding agent that opens exactly ONE pull request for it.",
    '- Each task MUST set "kind": "implementation" when it changes real product code (source, tests,',
    '  config, migrations), or "analysis" when it is a pure planning/design/documentation artifact.',
    '- STRONGLY prefer "implementation" tasks. Do NOT emit standalone "write the brief", "map',
    '  touchpoints", "define contracts", "design the UI", or "create a review/QA checklist" tasks —',
    "  that planning content belongs in scope, assumptions, generatedFeatures descriptions, reviewPlan,",
    '  and qaPlan, NOT as separate tasks. An "analysis" task never writes code and never ships a change.',
    '- The plan MUST include at least one "implementation" task that actually delivers the outcome; a',
    "  plan whose tasks are all analysis (or all documentation) delivers nothing and will be rejected.",
    "- Each risk has id, severity (low|medium|high), description, mitigation, ownerRole.",
    "- Each dependency has id, type (product|technical|repository|data|security|release|approval),",
    "  description, blocks (array), requiredBeforeOrder (number).",
    "- recommendedEmployeeId / ownerEmployeeId values must be either null or an id from the provided",
    "  employee roster — never invent employee ids. Use null when no roster member fits.",
    "- requiredContext file references must only name files that appear in the repository importantFiles.",
    "- estimatedExecutionOrder is an array of task planItemId values in execution order.",
  ].join("\n");
}

/**
 * Renders the employee roster the model may assign work to.
 *
 * @param employees - Company employee context rows.
 * @returns A roster block, or a no-roster note when empty.
 */
function renderRoster(
  employees: readonly PlanningEmployeeContext[]
): string {
  if (employees.length === 0) {
    return "No employees are available; set every recommendedEmployeeId and ownerEmployeeId to null and recommend roles only.";
  }

  return employees
    .map((employee) => {
      const role = employee.roleName ?? employee.title ?? "Unassigned role";
      const responsibilities = employee.responsibilities ?? "No documented responsibilities.";
      return `- id=${employee.id} | name=${employee.name} | role=${role} | responsibilities: ${responsibilities}`;
    })
    .join("\n");
}

/**
 * Renders a single repository's real intelligence for grounding.
 *
 * @param repository - Repository context row.
 * @returns A multi-line repository block.
 */
function renderRepository(repository: PlanningRepositoryContext): string {
  const list = (values: readonly string[]): string =>
    values.length > 0 ? values.join(", ") : "(none detected)";

  const lines = [
    `- name: ${repository.name}`,
    `  primaryLanguage: ${repository.primaryLanguage ?? "(unknown)"}`,
    `  frameworks: ${list(repository.frameworks)}`,
    `  techStack: ${list(repository.techStack)}`,
    `  dependencies: ${list(repository.dependencies)}`,
    `  importantFiles: ${list(repository.importantFiles)}`,
    `  analysisNotes: ${repository.analysisNotes ?? "(none)"}`,
  ];

  if (repository.latestChangeSummary) {
    lines.push(`  latestChangeSummary: ${repository.latestChangeSummary}`);
    lines.push(
      `  latestChangeImpactLevel: ${repository.latestChangeImpactLevel ?? "(unknown)"}`
    );
    lines.push(
      `  latestChangeAffectedAreas: ${list(repository.latestChangeAffectedAreas)}`
    );
    lines.push(
      `  latestChangeRecommendedActions: ${list(repository.latestChangeRecommendedActions)}`
    );
  }

  return lines.join("\n");
}

/**
 * Renders the repositories block, or a no-repository note when empty.
 *
 * @param repositories - Company repository context rows.
 * @returns The repositories grounding block.
 */
function renderRepositories(
  repositories: readonly PlanningRepositoryContext[]
): string {
  if (repositories.length === 0) {
    return "No repositories are attached; document repository-context gaps as assumptions and open CEO questions instead of guessing files.";
  }

  return repositories.map(renderRepository).join("\n");
}

/**
 * Renders a labelled bullet list, or a fallback line when the list is empty.
 *
 * @param values - String values to render.
 * @param emptyNote - Text used when no values exist.
 * @returns A newline-joined bullet block.
 */
function renderList(
  values: readonly string[],
  emptyNote: string
): string {
  if (values.length === 0) {
    return emptyNote;
  }
  return values.map((value) => `- ${value}`).join("\n");
}

/**
 * Renders durable company memory (lessons learned, promoted standards) for the planner.
 *
 * @param memory - Retrieved company memory items, if any.
 * @returns A bullet block, or a no-memory note.
 */
function renderMemory(memory: OutcomePlanningInput["companyMemory"]): string {
  if (!memory || memory.length === 0) {
    return "(no prior company memory yet)";
  }
  return memory.map((item) => `- [${item.category}] ${item.content}`).join("\n");
}

/**
 * Renders the company's culture guidance for the planner (MUS-288).
 *
 * @param culture - `CompanySettings.cultureProfile`, if any.
 * @returns The culture guidance block, or a neutral note when unset/unknown.
 */
function renderCulture(culture: OutcomePlanningInput["cultureProfile"]): string {
  const guidance = getCultureGuidance(culture ?? null);
  if (!guidance) {
    return "(no specific culture configured — use balanced engineering judgment)";
  }
  return [
    `**${guidance.label}** — ${guidance.summary}`,
    ...guidance.directives.map((directive) => `- ${directive}`),
  ].join("\n");
}

/**
 * Builds the grounded system/user prompt pair for AI planning.
 *
 * @param input - Company-scoped outcome, employee, and repository context.
 * @example
 * ```ts
 * const { system, prompt } = buildPlanningPrompt(input);
 * const completion = await llm.complete({ system, prompt });
 * ```
 * @returns The system and user prompts to send to the LLM client.
 */
export function buildPlanningPrompt(
  input: OutcomePlanningInput
): PlanningPromptPair {
  const prompt = [
    "Produce the planning draft JSON for the following CEO outcome.",
    "",
    "## Outcome",
    `Title: ${input.title}`,
    `Raw request: ${input.rawRequest}`,
    `Brief: ${input.brief ?? "(none provided)"}`,
    `Business value: ${input.businessValue ?? "(none provided)"}`,
    "",
    "## Success criteria",
    renderList(input.successCriteria, "(none provided — infer measurable criteria from the outcome)"),
    "",
    "## Constraints",
    renderList(input.constraints, "(none provided)"),
    "",
    "## Employee roster (the ONLY valid assignment pool)",
    renderRoster(input.employees),
    "",
    "## Repository intelligence",
    renderRepositories(input.repositories),
    "",
    "## Company memory (lessons learned from past reviews, QA, and releases)",
    renderMemory(input.companyMemory),
    "",
    "## Company culture",
    renderCulture(input.cultureProfile),
    "",
    "## Instructions",
    "- Ground every project, feature, and task in the outcome and the repository intelligence above.",
    "- Apply the company memory: honor promoted standards and avoid repeating past review/QA findings.",
    "- Reflect the company culture above when scoping and prioritizing work (e.g. weight review/security, UX/accessibility, or performance tasks accordingly).",
    "- Only assign recommendedEmployeeId / ownerEmployeeId values that appear in the employee roster; otherwise use null.",
    "- Only reference files in requiredContext that appear in a repository's importantFiles list.",
    "- Break the outcome into real implementation tasks (kind=\"implementation\"); keep planning, design,",
    "  review, and QA guidance in the plan fields rather than as separate documentation tasks.",
    "- Set estimatedExecutionOrder to the task planItemId values in the order they should be executed.",
    "- Return ONLY the JSON object described in the system prompt.",
  ].join("\n");

  return { system: buildSystemPrompt(), prompt };
}
