import type { BriefRepositoryContext } from "@/lib/implementation-brief";
import { parseJsonStringArray } from "@/lib/planning-generator";
import {
  generateRepositoryTaskContext,
  type RepositoryInput,
  type RepositoryTaskContext,
} from "@/lib/repository-task-context";

/**
 * Minimal repository row from Prisma task/project queries.
 */
export interface TaskRepositoryRow {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly primaryLanguage: string | null;
  readonly frameworks: string;
  readonly techStack: string;
  readonly importantFiles: string;
  readonly analysisStatus: string;
}

/**
 * Resolves the repository attached to a task via its project workspace.
 *
 * @param repositories - Repositories on the task project workspace.
 * @returns First repository by recency, or null when none exist.
 */
export function resolveTaskRepository(
  repositories: readonly TaskRepositoryRow[] | null | undefined
): TaskRepositoryRow | null {
  if (!repositories || repositories.length === 0) return null;
  return repositories[0] ?? null;
}

/**
 * Maps a persisted repository row to brief repository context.
 *
 * @param repo - Repository database row.
 * @returns Brief repository context for implementation briefs.
 */
export function toBriefRepositoryContext(
  repo: TaskRepositoryRow
): BriefRepositoryContext {
  return {
    name: repo.name,
    url: repo.url ?? null,
    primaryLanguage: repo.primaryLanguage ?? null,
    frameworks: parseJsonStringArray(repo.frameworks),
    techStack: parseJsonStringArray(repo.techStack),
    importantFiles: parseJsonStringArray(repo.importantFiles),
    analysisStatus: repo.analysisStatus,
  };
}

/**
 * Maps a persisted repository row to repository task context input.
 *
 * @param repo - Repository database row.
 * @returns Repository input for `generateRepositoryTaskContext`.
 */
export function toRepositoryInput(repo: TaskRepositoryRow): RepositoryInput {
  return {
    name: repo.name,
    url: repo.url ?? null,
    primaryLanguage: repo.primaryLanguage ?? null,
    frameworks: parseJsonStringArray(repo.frameworks),
    techStack: parseJsonStringArray(repo.techStack),
    importantFiles: parseJsonStringArray(repo.importantFiles),
    analysisStatus: repo.analysisStatus,
  };
}

/**
 * Builds repository-safe task context for a task and optional branch overrides.
 *
 * @param params - Task identifiers and optional repository/branch metadata.
 * @returns Resolved repository task context.
 */
export function buildTaskRepositoryContext(params: {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly branchName?: string | null;
  readonly baseBranch?: string | null;
  readonly repository?: TaskRepositoryRow | null;
}): RepositoryTaskContext {
  return generateRepositoryTaskContext({
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    branchName: params.branchName ?? null,
    baseBranch: params.baseBranch ?? null,
    repository: params.repository ? toRepositoryInput(params.repository) : null,
    repositoryId: params.repository?.id ?? null,
  });
}
