/**
 * GitHub repository listing helper.
 *
 * Lists the repositories the connected GitHub account can access, so the CEO
 * can pick one from a list when adding a repository instead of hand-typing the
 * URL and metadata. Dependency-free: uses `fetch` so no Octokit install is
 * required. The `fetchImpl` seam makes the network call injectable for tests.
 */

const GITHUB_API_BASE = "https://api.github.com";

/** A repository summary as surfaced to the Add Repository picker. */
export interface GitHubRepoSummary {
  /** `owner/repo`. */
  readonly fullName: string;
  /** Bare repository name. */
  readonly name: string;
  /** Browser URL (`https://github.com/owner/repo`). */
  readonly url: string;
  readonly description: string | null;
  readonly primaryLanguage: string | null;
  readonly isPrivate: boolean;
  readonly defaultBranch: string;
  /** ISO timestamp of the last push, used to sort most-recent first. */
  readonly pushedAt: string | null;
}

/** Minimal shape of the GitHub `/user/repos` response we consume. */
interface GitHubApiRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  default_branch: string;
  pushed_at: string | null;
}

type FetchLike = typeof fetch;

export interface ListGitHubRepositoriesInput {
  /** GitHub OAuth/personal token with `repo` scope. */
  readonly token: string;
  /** Page size (GitHub caps at 100). Defaults to 100. */
  readonly perPage?: number;
  readonly fetchImpl?: FetchLike;
}

/**
 * Maps a raw GitHub repository object to our picker summary.
 *
 * @param repo - Raw `/user/repos` entry.
 * @returns Normalized summary.
 */
export function toRepoSummary(repo: GitHubApiRepo): GitHubRepoSummary {
  return {
    fullName: repo.full_name,
    name: repo.name,
    url: repo.html_url,
    description: repo.description,
    primaryLanguage: repo.language,
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
    pushedAt: repo.pushed_at,
  };
}

/**
 * Lists repositories the connected account can access, most-recently-pushed
 * first. Returns at most `perPage` (default 100) — the first page only.
 *
 * @param input - Token, optional page size, and optional fetch seam.
 * @returns Normalized repository summaries.
 * @throws When the GitHub API responds with a non-2xx status.
 */
export async function listGitHubRepositories(
  input: ListGitHubRepositoriesInput
): Promise<GitHubRepoSummary[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const perPage = Math.min(Math.max(input.perPage ?? 100, 1), 100);

  const url =
    `${GITHUB_API_BASE}/user/repos` +
    `?per_page=${perPage}&sort=pushed&direction=desc` +
    `&affiliation=owner,collaborator,organization_member`;

  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(
      `GitHub repository list failed (${res.status} ${res.statusText}).`
    );
  }

  const data = (await res.json()) as GitHubApiRepo[];
  return data.map(toRepoSummary);
}
