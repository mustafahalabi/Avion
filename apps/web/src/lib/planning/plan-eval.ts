import {
  validatePlanningDraftQuality,
  type DeterministicPlanningDraft,
  type OutcomePlanningInput,
} from "@/lib/planning-generator";

/**
 * A single declarative planning-eval scenario: an outcome input plus the grounding
 * properties a good draft is expected to satisfy. Consumed by both the eval harness
 * (`scripts/planning-eval.ts`) and the colocated unit test.
 */
export interface PlanEvalCase {
  /** Stable, human-readable case label for table output and test assertions. */
  readonly name: string;
  /** Company-scoped outcome, employee, and repository context fed to the adapter. */
  readonly input: OutcomePlanningInput;
  /** Expected grounding properties; each present field adds a scored check. */
  readonly expect: {
    /** Framework name (e.g. "Next.js") that a feature/task/summary must mention. */
    readonly framework?: string;
    /** When true, at least one task's requiredContext must reference a repo important file. */
    readonly mustReferenceImportantFile?: boolean;
    /** Minimum number of generated tasks the draft must contain. */
    readonly minTasks?: number;
  };
}

/** Result of a single scored property check against a planning draft. */
export interface PlanEvalCheck {
  /** Stable identifier for the property being scored. */
  readonly name: string;
  /** Whether the draft satisfied this property. */
  readonly pass: boolean;
}

/** Aggregate score for one planning draft against one case's expectations. */
export interface PlanEvalScore {
  /** Number of checks that passed. */
  readonly score: number;
  /** Total number of applicable checks. */
  readonly max: number;
  /** Per-property pass/fail breakdown. */
  readonly checks: readonly PlanEvalCheck[];
}

/**
 * Collects every employee id referenced anywhere in a generated draft.
 *
 * @param draft - Generated planning draft.
 * @returns Non-null employee ids referenced by owners, assignments, and tasks.
 */
function collectReferencedEmployeeIds(
  draft: DeterministicPlanningDraft
): readonly string[] {
  const ids: (string | null)[] = [
    ...draft.generatedProjects.map((project) => project.ownerEmployeeId),
    ...draft.generatedFeatures.map((feature) => feature.ownerEmployeeId),
    ...draft.generatedTasks.map((task) => task.recommendedEmployeeId),
    ...draft.recommendedAssignments.map((assignment) => assignment.employeeId),
  ];

  return ids.filter((id): id is string => id !== null);
}

/**
 * Builds the lowercased text corpus a draft uses to describe the planned work.
 *
 * @param draft - Generated planning draft.
 * @returns Concatenated, lowercased summary/feature/task text for substring checks.
 */
function buildDraftCorpus(draft: DeterministicPlanningDraft): string {
  const parts: string[] = [draft.summary];

  for (const feature of draft.generatedFeatures) {
    parts.push(feature.title, feature.description);
  }
  for (const task of draft.generatedTasks) {
    parts.push(task.title, task.description);
  }

  return parts.join("\n").toLowerCase();
}

/**
 * Scores a planning draft against a case's grounding + quality expectations.
 *
 * The two unconditional checks are `passesQuality` (the shared
 * {@link validatePlanningDraftQuality} gate returns no issues) and
 * `noHallucinatedEmployees` (every referenced employee id exists in the input roster).
 * Each expectation field adds one more check only when present, so deterministic and
 * AI drafts are graded against the same, case-specific bar.
 *
 * @param draft - Generated planning draft to grade.
 * @param input - The outcome input the draft was generated from (roster + repositories).
 * @param expect - The case's expected grounding properties.
 * @example
 * ```ts
 * const result = generateDeterministicPlanningDraft(input);
 * if (result.status === "success") {
 *   const { score, max } = scorePlanningDraft(result.draft, input, { minTasks: 5 });
 * }
 * ```
 * @returns A score, max, and per-check breakdown.
 */
export function scorePlanningDraft(
  draft: DeterministicPlanningDraft,
  input: OutcomePlanningInput,
  expect: PlanEvalCase["expect"]
): PlanEvalScore {
  const checks: PlanEvalCheck[] = [];

  checks.push({
    name: "passesQuality",
    pass: validatePlanningDraftQuality(draft).length === 0,
  });

  const rosterIds = new Set(input.employees.map((employee) => employee.id));
  checks.push({
    name: "noHallucinatedEmployees",
    pass: collectReferencedEmployeeIds(draft).every((id) => rosterIds.has(id)),
  });

  if (expect.framework !== undefined) {
    const corpus = buildDraftCorpus(draft);
    checks.push({
      name: "referencesExpectedFramework",
      pass: corpus.includes(expect.framework.toLowerCase()),
    });
  }

  if (expect.mustReferenceImportantFile === true) {
    const importantFiles = input.repositories
      .flatMap((repo) => repo.importantFiles)
      .filter((file) => file.length > 0);
    const referencesFile =
      importantFiles.length > 0 &&
      draft.generatedTasks.some((task) =>
        task.requiredContext.some((context) =>
          importantFiles.some((file) => context.includes(file))
        )
      );
    checks.push({ name: "referencesAnImportantFile", pass: referencesFile });
  }

  if (expect.minTasks !== undefined) {
    checks.push({
      name: "meetsMinTasks",
      pass: draft.generatedTasks.length >= expect.minTasks,
    });
  }

  return {
    score: checks.filter((check) => check.pass).length,
    max: checks.length,
    checks,
  };
}
