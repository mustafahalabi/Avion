import { describe, expect, it } from "vitest";

import {
  fetchPullRequestFeedback,
  type FetchLike,
} from "./github-pr-feedback";

// ─── Mock fetch builder ─────────────────────────────────────────────────────

interface CannedResponses {
  /** PR payload, or a status to fail the PR lookup with. */
  pull?: unknown;
  pullStatus?: number;
  reviews?: unknown;
  reviewsStatus?: number;
  checkRuns?: unknown;
  checkRunsStatus?: number;
}

/**
 * Builds a fetch impl that routes by URL to canned JSON responses.
 */
function buildFetch(canned: CannedResponses): FetchLike {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/check-runs")) {
      return json(canned.checkRuns ?? { check_runs: [] }, canned.checkRunsStatus ?? 200);
    }
    if (url.includes("/reviews")) {
      return json(canned.reviews ?? [], canned.reviewsStatus ?? 200);
    }
    // PR lookup
    return json(canned.pull ?? {}, canned.pullStatus ?? 200);
  }) as unknown as FetchLike;
}

const baseInput = {
  token: "ghp_test",
  owner: "acme",
  repo: "widgets",
  prNumber: 7,
} as const;

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("fetchPullRequestFeedback", () => {
  it("reports approved + success", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", draft: false, merged_at: null, head: { sha: "abc" } },
      reviews: [
        { state: "APPROVED", user: { id: 1, login: "alice" } },
      ],
      checkRuns: {
        check_runs: [{ name: "ci", status: "completed", conclusion: "success" }],
      },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.state).toBe("open");
    expect(feedback.reviewDecision).toBe("approved");
    expect(feedback.checksConclusion).toBe("success");
    expect(feedback.checks).toEqual([{ name: "ci", conclusion: "success" }]);
  });

  it("reports changes_requested as the aggregate review decision", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", merged_at: null, head: { sha: "abc" } },
      reviews: [
        { state: "APPROVED", user: { id: 1, login: "alice" } },
        { state: "CHANGES_REQUESTED", user: { id: 2, login: "bob" } },
      ],
      checkRuns: {
        check_runs: [{ name: "ci", status: "completed", conclusion: "success" }],
      },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.reviewDecision).toBe("changes_requested");
  });

  it("uses a reviewer's latest review when they re-review", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", merged_at: null, head: { sha: "abc" } },
      reviews: [
        { state: "CHANGES_REQUESTED", user: { id: 1, login: "alice" } },
        { state: "APPROVED", user: { id: 1, login: "alice" } },
      ],
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.reviewDecision).toBe("approved");
  });

  it("reports a CI failure when any check failed", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", merged_at: null, head: { sha: "abc" } },
      reviews: [],
      checkRuns: {
        check_runs: [
          { name: "lint", status: "completed", conclusion: "success" },
          { name: "test", status: "completed", conclusion: "failure" },
        ],
      },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.checksConclusion).toBe("failure");
    expect(feedback.reviewDecision).toBe("none");
    expect(feedback.checks).toContainEqual({ name: "test", conclusion: "failure" });
  });

  it("reports pending when a check has not completed", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", merged_at: null, head: { sha: "abc" } },
      checkRuns: {
        check_runs: [
          { name: "ci", status: "in_progress", conclusion: null },
        ],
      },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.checksConclusion).toBe("pending");
    expect(feedback.checks).toEqual([{ name: "ci", conclusion: "in_progress" }]);
  });

  it("reports no checks as 'none' without throwing", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", merged_at: null, head: { sha: "abc" } },
      checkRuns: { check_runs: [] },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.checksConclusion).toBe("none");
    expect(feedback.checks).toEqual([]);
  });

  it("reports merged when merged_at is set", async () => {
    const fetchImpl = buildFetch({
      pull: {
        state: "closed",
        merged_at: "2026-06-29T00:00:00Z",
        head: { sha: "abc" },
      },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.state).toBe("merged");
  });

  it("reports closed when the PR is closed but not merged", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "closed", merged_at: null, head: { sha: "abc" } },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.state).toBe("closed");
  });

  it("reports draft when the PR is a draft", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", draft: true, merged_at: null, head: { sha: "abc" } },
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.state).toBe("draft");
  });

  it("degrades gracefully when reviews and check-runs return non-2xx", async () => {
    const fetchImpl = buildFetch({
      pull: { state: "open", merged_at: null, head: { sha: "abc" } },
      reviewsStatus: 404,
      checkRunsStatus: 500,
    });

    const feedback = await fetchPullRequestFeedback({ ...baseInput, fetchImpl });

    expect(feedback.reviewDecision).toBe("none");
    expect(feedback.checksConclusion).toBe("none");
  });

  it("throws when the PR lookup itself fails", async () => {
    const fetchImpl = buildFetch({ pull: { message: "Not Found" }, pullStatus: 404 });

    await expect(
      fetchPullRequestFeedback({ ...baseInput, fetchImpl })
    ).rejects.toThrow(/PR fetch failed/i);
  });

  it("uses an explicit headSha for the check-runs lookup", async () => {
    let checkUrl = "";
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/check-runs")) {
        checkUrl = url;
        return new Response(JSON.stringify({ check_runs: [] }), { status: 200 });
      }
      if (url.includes("/reviews")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(
        JSON.stringify({ state: "open", merged_at: null, head: { sha: "from-pr" } }),
        { status: 200 }
      );
    }) as unknown as FetchLike;

    await fetchPullRequestFeedback({ ...baseInput, headSha: "explicit-sha", fetchImpl });

    expect(checkUrl).toContain("explicit-sha");
  });
});
