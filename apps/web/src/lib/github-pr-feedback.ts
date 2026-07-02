/**
 * GitHub Pull Request feedback fetcher.
 *
 * Reads the live state of a pull request from the GitHub REST API: its lifecycle
 * state (open/draft/merged/closed), the aggregate review decision across
 * reviewers, and the CI check-run conclusion for its head commit.
 *
 * Dependency-free: uses `fetch` (no Octokit). The `fetchImpl` seam mirrors
 * `github-pull-request.ts` and makes the network calls injectable for tests.
 * Only a hard failure on the PR lookup throws; missing reviews / checks are
 * treated as empty, never as errors.
 */

const GITHUB_API_BASE = "https://api.github.com";

/** Injectable fetch implementation (defaults to the global `fetch`). */
export type FetchLike = typeof fetch;

/** Aggregate, normalized feedback for a single pull request. */
export interface PullRequestFeedback {
  /** Lifecycle state of the PR. */
  readonly state: "open" | "draft" | "merged" | "closed";
  /** Aggregate review decision across all reviewers' latest reviews. */
  readonly reviewDecision:
    | "approved"
    | "changes_requested"
    | "review_required"
    | "none";
  /** Aggregate CI conclusion for the head commit's check-runs. */
  readonly checksConclusion: "success" | "failure" | "pending" | "none";
  /** Per-check name + conclusion (or status when not yet concluded). */
  readonly checks: { readonly name: string; readonly conclusion: string }[];
}

/** Inputs for {@link fetchPullRequestFeedback}. */
export interface FetchPullRequestFeedbackInput {
  /** GitHub access/personal token with `repo` scope. */
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  /** Head commit SHA to read check-runs for. Falls back to the PR's head.sha. */
  readonly headSha?: string;
  /** Injected fetch implementation for testing. Defaults to global `fetch`. */
  readonly fetchImpl?: FetchLike;
}

/** Minimal shape of the GitHub pull request payload we consume. */
interface GitHubPullPayload {
  readonly state: string;
  readonly draft?: boolean;
  readonly merged_at?: string | null;
  readonly head?: { readonly sha?: string };
}

/** Minimal shape of a GitHub pull request review payload. */
interface GitHubReviewPayload {
  readonly state?: string;
  readonly user?: { readonly id?: number; readonly login?: string };
}

/** Minimal shape of a GitHub check-run payload. */
interface GitHubCheckRunPayload {
  readonly name?: string;
  readonly status?: string;
  readonly conclusion?: string | null;
}

/** Minimal shape of the GitHub check-runs list response. */
interface GitHubCheckRunsResponse {
  readonly check_runs?: GitHubCheckRunPayload[];
}

/** Minimal shape of the GitHub combined commit-status response. */
interface GitHubCombinedStatusResponse {
  /** Rolled-up state across all commit statuses: failure | pending | success. */
  readonly state?: string;
  /** Number of statuses — 0 means the legacy Status API isn't used on this repo. */
  readonly total_count?: number;
  readonly statuses?: {
    readonly context?: string;
    readonly state?: string;
  }[];
}

/**
 * Conclusions that count as a failed CI run. `action_required` and `stale` are
 * included: a check demanding action or gone stale is NOT clean, and treating it
 * as absent (which is what happens if it's excluded) would let a red PR
 * auto-merge (MUS-286).
 */
const FAILURE_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "stale",
]);

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
 * Maps a GitHub pull request payload to a normalized lifecycle state.
 */
function mapState(pull: GitHubPullPayload): PullRequestFeedback["state"] {
  if (pull.merged_at) return "merged";
  if (pull.state === "closed") return "closed";
  if (pull.draft) return "draft";
  return "open";
}

/**
 * Computes the aggregate review decision from the full reviews list.
 *
 * Tracks each reviewer's latest meaningful (APPROVED / CHANGES_REQUESTED)
 * review. Any reviewer requesting changes wins; otherwise an approval wins;
 * otherwise reviews that exist but neither approve nor block read as
 * `review_required`; an empty list reads as `none`.
 */
function computeReviewDecision(
  reviews: readonly GitHubReviewPayload[]
): PullRequestFeedback["reviewDecision"] {
  const latestByReviewer = new Map<string, string>();
  for (const review of reviews) {
    const state = review.state?.toUpperCase();
    if (state !== "APPROVED" && state !== "CHANGES_REQUESTED") continue;
    const reviewer =
      review.user?.id != null
        ? `id:${review.user.id}`
        : `login:${review.user?.login ?? "unknown"}`;
    // Reviews arrive in chronological order; later entries overwrite earlier.
    latestByReviewer.set(reviewer, state);
  }

  const states = [...latestByReviewer.values()];
  if (states.includes("CHANGES_REQUESTED")) return "changes_requested";
  if (states.includes("APPROVED")) return "approved";
  return reviews.length > 0 ? "review_required" : "none";
}

/**
 * Computes the aggregate CI conclusion + per-check breakdown from check-runs.
 */
function computeChecks(runs: readonly GitHubCheckRunPayload[]): {
  conclusion: PullRequestFeedback["checksConclusion"];
  checks: { name: string; conclusion: string }[];
} {
  const checks = runs.map((run) => ({
    name: run.name ?? "check",
    conclusion: run.conclusion ?? run.status ?? "",
  }));

  if (runs.length === 0) return { conclusion: "none", checks };

  const anyFailure = runs.some(
    (run) => run.conclusion != null && FAILURE_CONCLUSIONS.has(run.conclusion)
  );
  if (anyFailure) return { conclusion: "failure", checks };

  const anyIncomplete = runs.some((run) => run.status !== "completed");
  if (anyIncomplete) return { conclusion: "pending", checks };

  const anySuccess = runs.some((run) => run.conclusion === "success");
  return { conclusion: anySuccess ? "success" : "none", checks };
}

/**
 * Computes the aggregate conclusion + per-status breakdown from the **legacy
 * Commit Status API** (`/commits/{sha}/status`). Many repos report CI via
 * commit statuses (external CI, deploy/coverage gates) that never appear in the
 * check-runs endpoint, so ignoring them let a failing PR read as "no CI" and
 * auto-merge (MUS-286).
 *
 * GitHub returns a combined `state` of `pending` even when there are **zero**
 * statuses, so `total_count`/`statuses.length` is the authority for "absent" —
 * only an empty status set reads as `none`.
 */
function computeCommitStatus(status: GitHubCombinedStatusResponse | null): {
  conclusion: PullRequestFeedback["checksConclusion"];
  checks: { name: string; conclusion: string }[];
} {
  if (!status) return { conclusion: "none", checks: [] };
  const statuses = Array.isArray(status.statuses) ? status.statuses : [];
  const total = status.total_count ?? statuses.length;
  if (total === 0) return { conclusion: "none", checks: [] };

  const checks = statuses.map((entry) => ({
    name: entry.context ?? "status",
    conclusion: entry.state ?? "",
  }));
  const conclusion: PullRequestFeedback["checksConclusion"] =
    status.state === "failure"
      ? "failure"
      : status.state === "pending"
        ? "pending"
        : status.state === "success"
          ? "success"
          : "none";
  return { conclusion, checks };
}

/**
 * Combines two CI conclusions into the strictest one: any failure wins, then
 * pending, then success; `none` only when both are absent.
 */
function combineConclusions(
  left: PullRequestFeedback["checksConclusion"],
  right: PullRequestFeedback["checksConclusion"]
): PullRequestFeedback["checksConclusion"] {
  if (left === "failure" || right === "failure") return "failure";
  if (left === "pending" || right === "pending") return "pending";
  if (left === "success" || right === "success") return "success";
  return "none";
}

/**
 * Fetches and normalizes the live feedback for a pull request.
 *
 * Performs up to four reads: the PR itself (state + head sha), its reviews
 * (aggregate decision), and the head commit's check-runs AND combined commit
 * status (CI conclusion, folded together). Only a non-2xx on the PR read throws;
 * reviews and both CI signals degrade to "none".
 *
 * @param input - Token, repo coordinates, PR number, optional head sha, fetch.
 * @returns Normalized {@link PullRequestFeedback}.
 * @throws Error when the GitHub API rejects the pull request lookup.
 */
export async function fetchPullRequestFeedback(
  input: FetchPullRequestFeedbackInput
): Promise<PullRequestFeedback> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const repoBase = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}`;

  // ── PR state (required) ─────────────────────────────────────────────────
  const pullRes = await fetchImpl(`${repoBase}/pulls/${input.prNumber}`, {
    method: "GET",
    headers,
  });
  if (!pullRes.ok) {
    throw new Error(
      `GitHub PR fetch failed (${pullRes.status}): ${await safeText(pullRes)}`
    );
  }
  const pull = (await pullRes.json()) as GitHubPullPayload;
  const state = mapState(pull);
  const sha = input.headSha ?? pull.head?.sha;

  // ── Reviews (best-effort) ───────────────────────────────────────────────
  let reviews: GitHubReviewPayload[] = [];
  try {
    const reviewsRes = await fetchImpl(
      `${repoBase}/pulls/${input.prNumber}/reviews`,
      { method: "GET", headers }
    );
    if (reviewsRes.ok) {
      const parsed = (await reviewsRes.json()) as GitHubReviewPayload[];
      if (Array.isArray(parsed)) reviews = parsed;
    }
  } catch {
    reviews = [];
  }
  const reviewDecision = computeReviewDecision(reviews);

  // ── CI signals (best-effort; needs a head sha) ──────────────────────────
  // Read BOTH the modern Check-Runs API and the legacy Commit Status API — a
  // repo may report CI via either (or both), and reading only check-runs let a
  // failing commit-status PR read as "no CI" and auto-merge (MUS-286).
  let runs: GitHubCheckRunPayload[] = [];
  let combinedStatus: GitHubCombinedStatusResponse | null = null;
  if (sha) {
    try {
      const checksRes = await fetchImpl(
        `${repoBase}/commits/${sha}/check-runs`,
        { method: "GET", headers }
      );
      if (checksRes.ok) {
        const parsed = (await checksRes.json()) as GitHubCheckRunsResponse;
        if (Array.isArray(parsed.check_runs)) runs = parsed.check_runs;
      }
    } catch {
      runs = [];
    }

    try {
      const statusRes = await fetchImpl(`${repoBase}/commits/${sha}/status`, {
        method: "GET",
        headers,
      });
      if (statusRes.ok) {
        combinedStatus = (await statusRes.json()) as GitHubCombinedStatusResponse;
      }
    } catch {
      combinedStatus = null;
    }
  }

  const fromCheckRuns = computeChecks(runs);
  const fromCommitStatus = computeCommitStatus(combinedStatus);
  const checksConclusion = combineConclusions(
    fromCheckRuns.conclusion,
    fromCommitStatus.conclusion
  );
  const checks = [...fromCheckRuns.checks, ...fromCommitStatus.checks];

  return { state, reviewDecision, checksConclusion, checks };
}
