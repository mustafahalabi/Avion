/**
 * Pull-request feedback ingestion service.
 *
 * Polls the open/draft pull requests opened by a company's execution sessions
 * and reacts to their live GitHub state:
 *
 * - A merged PR closes the loop: the session's `prStatus` is set to `merged`.
 * - A failing CI run or a reviewer requesting changes re-opens the work: a
 *   `changes_requested` review is recorded (which creates a ChangeRequest and
 *   moves the task back to `in-progress`) so the agent loop can produce a fix.
 *
 * Ingestion is idempotent per PR: if an unresolved PR-feedback ChangeRequest
 * already captures the same feedback, no duplicate is opened. This service is
 * deliberately narrow — it does NOT run the review/QA gate-advancement logic.
 */

import { prisma } from "@/lib/prisma";
import { parseGitHubRepoUrl } from "@/lib/github-pull-request";
import { getProviderConnection } from "@/lib/provider-connection-service";
import { recordReviewResult } from "@/lib/review-service";
import {
  fetchPullRequestFeedback,
  type PullRequestFeedback,
} from "@/lib/github-pr-feedback";

/**
 * Title prefix marking a Review that was opened from PR feedback. Used to make
 * ingestion idempotent without colliding with human/agent-authored reviews.
 */
const PR_FEEDBACK_REVIEW_TITLE_PREFIX = "PR feedback:";

/** Injectable dependencies for {@link ingestPullRequestFeedbackForCompany}. */
export interface PrFeedbackIngestionDeps {
  /** Override the GitHub feedback fetcher (injected in tests). */
  readonly fetchFeedback?: typeof fetchPullRequestFeedback;
}

/** Aggregate counts returned by {@link ingestPullRequestFeedbackForCompany}. */
export interface PrFeedbackIngestionResult {
  /** Number of sessions whose PR feedback was actually fetched + inspected. */
  readonly sessionsChecked: number;
  /** Number of new ChangeRequests opened from PR feedback this run. */
  readonly changeRequestsOpened: number;
  /** Number of sessions whose PR was observed merged this run. */
  readonly merged: number;
}

/**
 * Builds a human-readable summary of the actionable PR feedback.
 *
 * @param feedback - Normalized pull request feedback.
 * @returns A one-paragraph summary covering CI failures and/or requested changes.
 */
function buildFeedbackSummary(feedback: PullRequestFeedback): string {
  const parts: string[] = [];

  if (feedback.checksConclusion === "failure") {
    const failed = feedback.checks
      .filter((c) =>
        ["failure", "timed_out", "cancelled"].includes(c.conclusion)
      )
      .map((c) => c.name);
    parts.push(
      failed.length > 0
        ? `CI checks failed: ${failed.join(", ")}.`
        : "CI checks failed on the pull request."
    );
  }

  if (feedback.reviewDecision === "changes_requested") {
    parts.push("A reviewer requested changes on the pull request.");
  }

  return parts.length > 0
    ? parts.join(" ")
    : "Pull request feedback requires changes.";
}

/**
 * Ingests live PR feedback for a company's open/draft execution-session PRs.
 *
 * For each session with a tracked PR (`prNumber` set, `prStatus` in
 * `open`/`draft`):
 * - Resolves the company's GitHub token and the repo's owner/repo. Sessions
 *   missing a token or a parseable repo URL are skipped (counted as nothing).
 * - Fetches feedback and, per session (best-effort, isolated by try/catch):
 *   - merged → marks the session `prStatus = "merged"`.
 *   - CI failure or changes requested → records a `changes_requested` review
 *     (idempotently) which opens a ChangeRequest and returns the task to
 *     `in-progress`.
 *
 * @param companyId - The company whose sessions to inspect.
 * @param deps - Optional injected dependencies (feedback fetcher).
 * @returns Counts of sessions checked, change requests opened, and PRs merged.
 */
export async function ingestPullRequestFeedbackForCompany(
  companyId: string,
  deps?: PrFeedbackIngestionDeps
): Promise<PrFeedbackIngestionResult> {
  const fetchFeedback = deps?.fetchFeedback ?? fetchPullRequestFeedback;

  let sessionsChecked = 0;
  let changeRequestsOpened = 0;
  let merged = 0;

  // Company-level GitHub token (same for every session in the company).
  const connection = await getProviderConnection(companyId, "github");
  const token =
    connection?.tokens.accessToken ?? connection?.tokens.manualToken ?? null;

  const sessions = await prisma.executionSession.findMany({
    where: {
      companyId,
      prNumber: { not: null },
      prStatus: { in: ["open", "draft"] },
    },
    include: { task: true, repository: true },
  });

  for (const session of sessions) {
    try {
      if (!token) continue;
      if (session.prNumber == null) continue;

      const repoUrl = session.repository?.url;
      const parsed = repoUrl ? parseGitHubRepoUrl(repoUrl) : null;
      if (!parsed) continue;

      const feedback = await fetchFeedback({
        token,
        owner: parsed.owner,
        repo: parsed.repo,
        prNumber: session.prNumber,
        headSha: session.commitSha ?? undefined,
      });

      sessionsChecked++;

      if (feedback.state === "merged") {
        await prisma.executionSession.update({
          where: { id: session.id },
          data: { prStatus: "merged", updatedAt: new Date() },
        });
        merged++;
        continue;
      }

      const needsChanges =
        feedback.checksConclusion === "failure" ||
        feedback.reviewDecision === "changes_requested";
      if (!needsChanges) continue;

      const taskId = session.taskId;
      if (!taskId) continue;

      // Idempotency: skip if an unresolved PR-feedback change request already
      // captures this PR's feedback for the task.
      const existing = await prisma.review.findFirst({
        where: {
          companyId,
          entityType: "task",
          entityId: taskId,
          status: "changes_requested",
          title: { startsWith: PR_FEEDBACK_REVIEW_TITLE_PREFIX },
          changeRequests: { some: { resolved: false } },
        },
      });
      if (existing) continue;

      const summary = buildFeedbackSummary(feedback);
      const taskTitle = session.task?.title ?? taskId;

      const review = await prisma.review.create({
        data: {
          companyId,
          entityType: "task",
          entityId: taskId,
          title: `${PR_FEEDBACK_REVIEW_TITLE_PREFIX} ${taskTitle}`,
          status: "pending",
        },
      });

      const result = await recordReviewResult({
        companyId,
        reviewId: review.id,
        verdict: "changes_requested",
        notes: summary,
        findings: [
          { severity: "blocker", description: summary, actionable: true },
        ],
      });

      changeRequestsOpened += result.changeRequestIds.length;
    } catch {
      // Best-effort per session: a failure on one PR must not abort the rest.
    }
  }

  return { sessionsChecked, changeRequestsOpened, merged };
}
