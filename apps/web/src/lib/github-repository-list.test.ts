import { describe, expect, it, vi } from "vitest";
import {
  listGitHubRepositories,
  toRepoSummary,
} from "@/lib/github-repository-list";

function apiRepo(overrides: Record<string, unknown> = {}) {
  return {
    name: "widgets",
    full_name: "acme/widgets",
    html_url: "https://github.com/acme/widgets",
    description: "Widget factory",
    language: "TypeScript",
    private: true,
    default_branch: "main",
    pushed_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("toRepoSummary", () => {
  it("maps the GitHub fields onto the picker summary", () => {
    expect(toRepoSummary(apiRepo() as never)).toEqual({
      fullName: "acme/widgets",
      name: "widgets",
      url: "https://github.com/acme/widgets",
      description: "Widget factory",
      primaryLanguage: "TypeScript",
      isPrivate: true,
      defaultBranch: "main",
      pushedAt: "2026-06-01T00:00:00Z",
    });
  });

  it("preserves nulls for missing description and language", () => {
    const summary = toRepoSummary(
      apiRepo({ description: null, language: null }) as never
    );
    expect(summary.description).toBeNull();
    expect(summary.primaryLanguage).toBeNull();
  });
});

describe("listGitHubRepositories", () => {
  it("requests sorted repos with the bearer token and maps the response", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [apiRepo(), apiRepo({ name: "gadgets", full_name: "acme/gadgets" })],
    })) as unknown as typeof fetch;

    const repos = await listGitHubRepositories({ token: "gho_abc", fetchImpl });

    expect(repos).toHaveLength(2);
    expect(repos[0].fullName).toBe("acme/widgets");

    const [calledUrl, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("/user/repos");
    expect(calledUrl).toContain("sort=pushed");
    expect(init.headers.Authorization).toBe("Bearer gho_abc");
  });

  it("clamps per_page to the GitHub maximum of 100", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [],
    })) as unknown as typeof fetch;

    await listGitHubRepositories({ token: "t", perPage: 500, fetchImpl });

    const [calledUrl] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("per_page=100");
  });

  it("throws when GitHub responds with a non-2xx status", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(
      listGitHubRepositories({ token: "bad", fetchImpl })
    ).rejects.toThrow(/401/);
  });
});
