import type {
  DeterministicPlanningDraft,
  OutcomePlanningInput,
} from "@/lib/planning-generator";

/** Grounding findings split into rejection-worthy and advisory issues. */
export interface PlanGroundingResult {
  /** Fabrications that must cause the AI draft to be rejected (e.g. invented employee ids). */
  readonly hardIssues: string[];
  /** Advisory findings that annotate the draft but do not reject it. */
  readonly softIssues: string[];
}

/** Code/document extensions that make a token look like a real repository file. */
const FILE_EXTENSION_PATTERN =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|prisma|md|mdx|css|scss|sass|less|yml|yaml|sql|sh|toml|env|lock|html)$/i;

/**
 * Extracts file-path-looking tokens from a free-text required-context entry.
 *
 * Conservative on purpose: only tokens carrying a path separator or a known source/document
 * extension are treated as file references, so prose is not mistaken for fabrication.
 *
 * @param text - A single requiredContext entry.
 * @returns File-looking tokens found in the entry.
 */
function extractFileTokens(text: string): string[] {
  const matches = text.match(/[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8}/g) ?? [];
  return matches.filter(
    (token) => token.includes("/") || FILE_EXTENSION_PATTERN.test(token)
  );
}

/**
 * Returns true when a file token plausibly matches a known important file.
 *
 * @param token - File-looking token from required context.
 * @param importantFiles - All importantFiles across attached repositories.
 * @returns Whether the token is grounded in repository evidence.
 */
function isFileGrounded(
  token: string,
  importantFiles: readonly string[]
): boolean {
  return importantFiles.some(
    (file) =>
      file === token || file.includes(token) || token.includes(file)
  );
}

/**
 * Checks an AI-generated planning draft against the real outcome context.
 *
 * Hard issues (reject the draft): any recommendedEmployeeId / ownerEmployeeId on tasks,
 * features, projects, or recommendedAssignments that is non-null and not in the company
 * employee roster — i.e. an invented assignment. Soft issues (annotate only): file-looking
 * strings in task.requiredContext that do not appear in any repository's importantFiles.
 * The soft check is skipped entirely when no importantFiles are available, to avoid false
 * positives against an empty evidence set.
 *
 * @param draft - Parsed AI planning draft.
 * @param input - The outcome context the draft was generated from.
 * @example
 * ```ts
 * const { hardIssues } = checkPlanGrounding(draft, input);
 * if (hardIssues.length > 0) return fallback.generate(input);
 * ```
 * @returns Hard and soft grounding issues.
 */
export function checkPlanGrounding(
  draft: DeterministicPlanningDraft,
  input: OutcomePlanningInput
): PlanGroundingResult {
  const hardIssues: string[] = [];
  const softIssues: string[] = [];

  const validEmployeeIds = new Set(
    input.employees.map((employee) => employee.id)
  );

  const checkEmployeeId = (
    employeeId: string | null,
    label: string
  ): void => {
    if (employeeId !== null && !validEmployeeIds.has(employeeId)) {
      hardIssues.push(
        `${label} references unknown employee id "${employeeId}" that is not in the company roster.`
      );
    }
  };

  for (const project of draft.generatedProjects) {
    checkEmployeeId(project.ownerEmployeeId, `Project ${project.planItemId}`);
  }

  for (const feature of draft.generatedFeatures) {
    checkEmployeeId(feature.ownerEmployeeId, `Feature ${feature.planItemId}`);
  }

  for (const task of draft.generatedTasks) {
    checkEmployeeId(task.recommendedEmployeeId, `Task ${task.planItemId}`);
  }

  for (const assignment of draft.recommendedAssignments) {
    checkEmployeeId(
      assignment.employeeId,
      `Recommended assignment for role "${assignment.role}"`
    );
  }

  const importantFiles = [
    ...new Set(
      input.repositories.flatMap((repository) => repository.importantFiles)
    ),
  ].filter((file) => file.length > 0);

  if (importantFiles.length > 0) {
    for (const task of draft.generatedTasks) {
      for (const entry of task.requiredContext) {
        for (const token of extractFileTokens(entry)) {
          if (!isFileGrounded(token, importantFiles)) {
            softIssues.push(
              `Task ${task.planItemId} requiredContext references "${token}", which is not in any repository importantFiles.`
            );
          }
        }
      }
    }
  }

  return { hardIssues, softIssues };
}
