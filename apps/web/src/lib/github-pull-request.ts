/**
 * GitHub Pull Request helper.
 *
 * Opens (or reuses) a pull request for an agent's session branch via the GitHub
 * REST API. Dependency-free: uses `fetch` so no Octokit install is required.
 * The `fetchImpl` seam makes the network calls injectable for tests.
 */

import type { PrStatus } from "@/lib/execution-session-service";

const GITHUB_API_BASE = "https://api.github.com";

/** Owner/repo pair parsed from a repository URL. */
export interface ParsedGitHubRepo {
  readonly owner: string;
  readonly repo: string;
}

/**
 * Parses the `owner` and `repo` from a GitHub repository URL.
 *
 * Handles HTTPS (`https://github.com/owner/repo(.git)`), token-injected HTTPS
 * (`https://token@github.com/owner/repo`), and SSH (`git@github.com:owner/repo`)
 * forms, with or without a trailing `.git`.
 *
 * @param url - Repository URL.
 * @returns Parsed owner/repo, or null when the URL is not a GitHub repo URL.
 *
 * @example
 * ```ts
 * parseGitHubRepoUrl("https://github.com/acme/widgets.git");
 * // { owner: "acme", repo: "widgets" }
 * ```
 */
export function parseGitHubRepoUrl(url: string): ParsedGitHubRepo | null {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!match) return null;
  const [, owner, repo] = match;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/** Inputs used to build the PR body. */
export interface BuildPullRequestBodyInput {
  readonly taskTitle: string;
  readonly summary: string | null;
  readonly filesChanged: readonly string[];
  readonly validationOutput: string | null;
}

/**
 * Builds a Markdown PR body from the task and agent result.
 *
 * @param input - Task title, summary, files changed, and validation output.
 * @returns Markdown body covering summary, files, and validation.
 */
export function buildPullRequestBody(input: BuildPullRequestBodyInput): string {
  const lines: string[] = [];

  lines.push("## Summary");
  lines.push(input.summary?.trim() || "_No summary provided._");
  lines.push("");

  lines.push("## Files changed");
  if (input.filesChanged.length > 0) {
    for (const file of input.filesChanged) {
      lines.push(`- \`${file}\``);
    }
  } else {
    lines.push("_No files reported._");
  }
  lines.push("");

  lines.push("## Validation");
  const validation = input.validationOutput?.trim();
  lines.push(validation ? `\`\`\`\n${validation}\n\`\`\`` : "_No validation output captured._");
  lines.push("");

  lines.push(`_Task: ${input.taskTitle}_`);
  lines.push("");
  lines.push("🤖 Opened automatically by the Avion worker.");

  return lines.join("\n");
}

/**
 * Builds a deterministic PR title from the task title.
 *
 * @param taskTitle - Title of the task being implemented.
 * @returns PR title of the form `feat: <title>`.
 */
export function buildPullRequestTitle(taskTitle: string | null): string {
  const title = taskTitle?.trim();
  return title ? `feat: ${title}` : "feat: Automated implementation";
}

type FetchLike = typeof fetch;

/** Inputs for {@link openOrReusePullRequest}. */
export interface OpenPullRequestInput {
  /** GitHub access/personal token with `repo` scope. */
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  /** Head branch (the session branch). */
  readonly head: string;
  /**
   * Base branch to merge into. When omitted/empty, the repository's actual
   * default branch is resolved from the GitHub API (handles main vs master).
   */
  readonly base?: string;
  readonly title: string;
  readonly body: string;
  /** Injected fetch implementation for testing. Defaults to global `fetch`. */
  readonly fetchImpl?: FetchLike;
}

/** Result of opening or reusing a pull request. */
export interface PullRequestResult {
  readonly prUrl: string;
  readonly prNumber: number;
  readonly prStatus: PrStatus;
  /** True when an existing open PR was reused instead of created. */
  readonly reused: boolean;
}

/** Minimal shape of the GitHub pull request payload we consume. */
interface GitHubPullPayload {
  readonly number: number;
  readonly html_url: string;
  readonly state: string;
  readonly draft?: boolean;
  readonly merged_at?: string | null;
}

/**
 * Maps a GitHub pull request payload to our {@link PrStatus} enum.
 */
function mapPrStatus(pull: GitHubPullPayload): PrStatus {
  if (pull.merged_at) return "merged";
  if (pull.state === "closed") return "closed";
  if (pull.draft) return "draft";
  return "open";
}

/**
 * Reads up to 500 chars of a response body without throwing.
 */
async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}

/**
 * Resolves a repository's default branch (e.g. `main` vs `master`) via the
 * GitHub REST API, so PRs always target a branch that actually exists.
 *
 * @param input - Token and repo coordinates.
 * @returns The default branch name, falling back to `main` when unknown.
 * @throws Error when the GitHub API rejects the repository lookup.
 */
export async function resolveDefaultBranch(input: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly fetchImpl?: FetchLike;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    throw new Error(
      `GitHub repository lookup failed (${res.status}): ${await safeText(res)}`
    );
  }
  const repo = (await res.json()) as { default_branch?: string };
  return repo.default_branch || "main";
}

/**
 * Opens a pull request from `head` into `base`, reusing an existing open PR for
 * the same head branch when one already exists (idempotent). When `base` is
 * omitted, the repository's default branch is resolved automatically.
 *
 * @param input - Token, repo coordinates, branches, and PR content.
 * @returns The PR URL, number, status, and whether it was reused.
 * @throws Error when the GitHub API rejects the lookup or creation.
 */
export async function openOrReusePullRequest(
  input: OpenPullRequestInput
): Promise<PullRequestResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  const pullsUrl = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls`;
  const base =
    input.base && input.base.trim()
      ? input.base
      : await resolveDefaultBranch({
          token: input.token,
          owner: input.owner,
          repo: input.repo,
          fetchImpl,
        });

  // Idempotency: reuse an existing open PR for this head branch.
  const headFilter = encodeURIComponent(`${input.owner}:${input.head}`);
  const listRes = await fetchImpl(`${pullsUrl}?head=${headFilter}&state=open`, {
    method: "GET",
    headers,
  });
  if (!listRes.ok) {
    throw new Error(
      `GitHub PR lookup failed (${listRes.status}): ${await safeText(listRes)}`
    );
  }
  const existing = (await listRes.json()) as GitHubPullPayload[];
  if (Array.isArray(existing) && existing.length > 0) {
    const pull = existing[0];
    return {
      prUrl: pull.html_url,
      prNumber: pull.number,
      prStatus: mapPrStatus(pull),
      reused: true,
    };
  }

  // Create a new PR.
  const createRes = await fetchImpl(pullsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      head: input.head,
      base,
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `GitHub PR creation failed (${createRes.status}): ${await safeText(createRes)}`
    );
  }
  const created = (await createRes.json()) as GitHubPullPayload;
  return {
    prUrl: created.html_url,
    prNumber: created.number,
    prStatus: mapPrStatus(created),
    reused: false,
  };
}

// ─── Merge (auto_merge autonomy action) ──────────────────────────────────────

/** Inputs for {@link mergePullRequest}. */
export interface MergePullRequestInput {
  /** GitHub access/personal token with `repo` scope. */
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  /** Merge method; defaults to `squash` for a linear history. */
  readonly method?: "merge" | "squash" | "rebase";
  /** Injected fetch implementation for testing. Defaults to global `fetch`. */
  readonly fetchImpl?: FetchLike;
}

/** Result of a merge attempt. */
export interface MergePullRequestResult {
  /** True when GitHub reports the PR merged. */
  readonly merged: boolean;
  /** Merge commit SHA when merged. */
  readonly sha: string | null;
  /** GitHub's message (e.g. "Pull Request is not mergeable" on 405). */
  readonly message: string;
}

/**
 * Merges a pull request via the GitHub REST API. Never force-merges: a PR that
 * GitHub reports as not mergeable (405) or whose head moved (409) returns
 * `merged: false` with the reason instead of throwing, so callers can simply
 * retry on a later poll.
 *
 * @param input - Token, repo coordinates, PR number, and merge method.
 * @returns Whether the merge happened, with the merge SHA or the refusal reason.
 * @throws Error on unexpected GitHub API failures (auth, 5xx, …).
 */
export async function mergePullRequest(
  input: MergePullRequestInput
): Promise<MergePullRequestResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls/${input.prNumber}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ merge_method: input.method ?? "squash" }),
    }
  );

  if (res.ok) {
    const payload = (await res.json()) as {
      merged?: boolean;
      sha?: string;
      message?: string;
    };
    return {
      merged: payload.merged === true,
      sha: payload.sha ?? null,
      message: payload.message ?? "merged",
    };
  }

  // 405: not mergeable (checks/branch protection); 409: head SHA moved.
  if (res.status === 405 || res.status === 409) {
    return {
      merged: false,
      sha: null,
      message: `GitHub refused the merge (${res.status}): ${await safeText(res)}`,
    };
  }

  throw new Error(
    `GitHub PR merge failed (${res.status}): ${await safeText(res)}`
  );
}
