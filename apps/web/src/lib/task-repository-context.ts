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
 * Picks the repository a task should execute against, in precedence order:
 *   1. the project's explicit `repositoryId` link (the real, chosen repo);
 *   2. the feature's project's explicit link (AI-planned tasks attach to a
 *      feature, not a project);
 *   3. (legacy fallback) the most-recent repository in the project's workspace;
 *   4. (legacy fallback) the most-recent repo in the feature's project workspace.
 *
 * The explicit-link cases (1, 2) are the fix for projects no longer guessing
 * "the first repo in the workspace"; the workspace fallbacks keep pre-link
 * projects (and any with a null `repositoryId`) working unchanged.
 */
export function pickTaskRepository(sources: {
  readonly projectRepository?: TaskRepositoryRow | null;
  readonly featureProjectRepository?: TaskRepositoryRow | null;
  readonly projectWorkspaceRepositories?: readonly TaskRepositoryRow[] | null;
  readonly featureProjectWorkspaceRepositories?:
    | readonly TaskRepositoryRow[]
    | null;
}): TaskRepositoryRow | null {
  return (
    sources.projectRepository ??
    sources.featureProjectRepository ??
    resolveTaskRepository(sources.projectWorkspaceRepositories) ??
    resolveTaskRepository(sources.featureProjectWorkspaceRepositories) ??
    null
  );
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
