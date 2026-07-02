import { describe, expect, it, vi } from "vitest";

import {
  buildPullRequestBody,
  buildPullRequestTitle,
  openOrReusePullRequest,
  parseGitHubRepoUrl,
} from "./github-pull-request";

/** Builds a minimal Response-like object for the fetch mock. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const BASE_INPUT = {
  token: "ghp_test",
  owner: "acme",
  repo: "widgets",
  head: "feature/MUS-208-open-pull-request",
  base: "master",
  title: "feat: Open a pull request",
  body: "body",
};

describe("parseGitHubRepoUrl", () => {
  it("parses an https URL with .git suffix", () => {
    expect(parseGitHubRepoUrl("https://github.com/acme/widgets.git")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
  });

  it("parses an https URL without suffix or trailing slash", () => {
    expect(parseGitHubRepoUrl("https://github.com/acme/widgets")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
  });

  it("parses a token-injected https URL", () => {
    expect(
      parseGitHubRepoUrl("https://ghp_abc@github.com/acme/widgets.git")
    ).toEqual({ owner: "acme", repo: "widgets" });
  });

  it("parses an ssh URL", () => {
    expect(parseGitHubRepoUrl("git@github.com:acme/widgets.git")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/acme/widgets")).toBeNull();
  });
});

describe("buildPullRequestTitle", () => {
  it("prefixes the task title with feat:", () => {
    expect(buildPullRequestTitle("Add billing")).toBe("feat: Add billing");
  });

  it("falls back when no title is provided", () => {
    expect(buildPullRequestTitle(null)).toBe("feat: Automated implementation");
  });
});

describe("buildPullRequestBody", () => {
  it("includes summary, files, and validation sections", () => {
    const body = buildPullRequestBody({
      taskTitle: "Add billing",
      summary: "Implemented billing.",
      filesChanged: ["src/billing.ts", "src/billing.test.ts"],
      validationOutput: "All tests pass",
    });

    expect(body).toContain("## Summary");
    expect(body).toContain("Implemented billing.");
    expect(body).toContain("## Files changed");
    expect(body).toContain("`src/billing.ts`");
    expect(body).toContain("## Validation");
    expect(body).toContain("All tests pass");
    expect(body).toContain("Add billing");
  });

  it("uses placeholders when fields are empty", () => {
    const body = buildPullRequestBody({
      taskTitle: "Task",
      summary: null,
      filesChanged: [],
      validationOutput: null,
    });

    expect(body).toContain("_No summary provided._");
    expect(body).toContain("_No files reported._");
    expect(body).toContain("_No validation output captured._");
  });
});

describe("openOrReusePullRequest", () => {
  it("creates a new PR when none exists", async () => {
    const fetchImpl = vi
      .fn()
      // list returns empty → no existing PR
      .mockResolvedValueOnce(jsonResponse([]))
      // create returns the new PR
      .mockResolvedValueOnce(
        jsonResponse({
          number: 7,
          html_url: "https://github.com/acme/widgets/pull/7",
          state: "open",
          draft: false,
          merged_at: null,
        })
      );

    const result = await openOrReusePullRequest({ ...BASE_INPUT, fetchImpl });

    expect(result).toEqual({
      prUrl: "https://github.com/acme/widgets/pull/7",
      prNumber: 7,
      prStatus: "open",
      reused: false,
    });

    // First call lists, second call POSTs.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [createUrl, createOpts] = fetchImpl.mock.calls[1];
    expect(String(createUrl)).toContain("/repos/acme/widgets/pulls");
    expect(createOpts.method).toBe("POST");
  });

  it("reuses an existing open PR (idempotent)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          number: 3,
          html_url: "https://github.com/acme/widgets/pull/3",
          state: "open",
          draft: false,
          merged_at: null,
        },
      ])
    );

    const result = await openOrReusePullRequest({ ...BASE_INPUT, fetchImpl });

    expect(result).toEqual({
      prUrl: "https://github.com/acme/widgets/pull/3",
      prNumber: 3,
      prStatus: "open",
      reused: true,
    });
    // Only the lookup call — never POSTs a duplicate.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws when the lookup request fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Bad creds" }, false, 401));

    await expect(
      openOrReusePullRequest({ ...BASE_INPUT, fetchImpl })
    ).rejects.toThrow(/GitHub PR lookup failed \(401\)/);
  });

  it("throws when PR creation fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ message: "Validation failed" }, false, 422)
      );

    await expect(
      openOrReusePullRequest({ ...BASE_INPUT, fetchImpl })
    ).rejects.toThrow(/GitHub PR creation failed \(422\)/);
  });

  it("maps a draft PR to draft status", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          number: 9,
          html_url: "https://github.com/acme/widgets/pull/9",
          state: "open",
          draft: true,
          merged_at: null,
        },
      ])
    );

    const result = await openOrReusePullRequest({ ...BASE_INPUT, fetchImpl });
    expect(result.prStatus).toBe("draft");
  });
});
