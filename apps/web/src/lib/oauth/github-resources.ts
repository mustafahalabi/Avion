import {
  GITHUB_API_BASE,
  GitHubResourceError,
  githubApiHeaders,
  parseNextLink,
} from "./github-http";
import type { FetchLike } from "./types";

/**
 * GitHub repository listing + creation.
 *
 * Listing follows the `Link` rel="next" header to page through ALL repos
 * (per_page=100, including org repos via the affiliation filter). Creation
 * always sets `auto_init: true` so the new repo has an initial commit/branch —
 * a bare repo has no base branch and the autonomous PR loop would 422.
 */

const REPO_LIST_PARAMS =
  "per_page=100&affiliation=owner,collaborator,organization_member&sort=updated";

export interface GitHubRepoSummary {
  readonly fullName: string;
  readonly name: string;
  readonly url: string;
  readonly description: string | null;
  readonly primaryLanguage: string | null;
  readonly defaultBranch: string;
  readonly private: boolean;
}

interface GitHubRepoApi {
  full_name?: string;
  name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  default_branch?: string;
  private?: boolean;
}

function mapRepo(repo: GitHubRepoApi): GitHubRepoSummary {
  return {
    fullName: repo.full_name ?? repo.name ?? "",
    name: repo.name ?? "",
    url: repo.html_url ?? "",
    description: repo.description ?? null,
    primaryLanguage: repo.language ?? null,
    defaultBranch: repo.default_branch ?? "main",
    private: Boolean(repo.private),
  };
}

/**
 * Lists every repository the token can access, following pagination.
 * @throws {GitHubResourceError} On a non-OK response (status preserved).
 */
export async function listGitHubRepositories(
  token: string,
  fetchImpl?: FetchLike
): Promise<GitHubRepoSummary[]> {
  const f = fetchImpl ?? fetch;
  const repos: GitHubRepoSummary[] = [];
  let url: string | null = `${GITHUB_API_BASE}/user/repos?${REPO_LIST_PARAMS}`;

  // Bound the loop so a malformed Link header can't spin forever.
  for (let page = 0; url && page < 20; page++) {
    const res = await f(url, { headers: githubApiHeaders(token) });
    if (!res.ok) {
      throw new GitHubResourceError(
        `Failed to list GitHub repositories (${res.status}).`,
        res.status
      );
    }
    const batch = (await res.json()) as GitHubRepoApi[];
    for (const repo of batch) repos.push(mapRepo(repo));
    url = parseNextLink(res.headers.get("link"));
  }

  return repos;
}

export interface CreateGitHubRepoInput {
  readonly name: string;
  readonly private: boolean;
  readonly description?: string;
  /** Create under an org instead of the authenticated user. */
  readonly org?: string;
}

/**
 * Creates a repository (with `auto_init: true`) and returns its summary.
 * @throws {GitHubResourceError} 422 with a friendly message for invalid/taken
 *         names; otherwise the raw status.
 */
export async function createGitHubRepository(
  token: string,
  input: CreateGitHubRepoInput,
  fetchImpl?: FetchLike
): Promise<GitHubRepoSummary> {
  const f = fetchImpl ?? fetch;
  const endpoint = input.org
    ? `${GITHUB_API_BASE}/orgs/${input.org}/repos`
    : `${GITHUB_API_BASE}/user/repos`;

  const res = await f(endpoint, {
    method: "POST",
    headers: githubApiHeaders(token),
    body: JSON.stringify({
      name: input.name,
      private: input.private,
      description: input.description,
      auto_init: true,
    }),
  });

  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      errors?: Array<{ message?: string }>;
    };
    const detail =
      body.errors?.find((e) => e.message)?.message ??
      body.message ??
      "Repository name is invalid or already exists.";
    throw new GitHubResourceError(detail, 422);
  }
  if (!res.ok) {
    throw new GitHubResourceError(
      `Failed to create GitHub repository (${res.status}).`,
      res.status
    );
  }

  return mapRepo((await res.json()) as GitHubRepoApi);
}
