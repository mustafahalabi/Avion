import { describe, expect, it, vi } from "vitest";

import { exchangeGitHubCode, fetchGitHubIdentity } from "./github-oauth";
import { exchangeLinearCode } from "./linear-oauth";
import {
  createGitHubRepository,
  listGitHubRepositories,
} from "./github-resources";
import { GitHubResourceError } from "./github-http";
import { listLinearTeams } from "./linear-resources";

interface ResponseOptions {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
}

/** Builds a minimal Response-like object (with a working `headers.get`). */
function res(body: unknown, options: ResponseOptions = {}): Response {
  const { ok = true, status = 200, headers = {} } = options;
  return {
    ok,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

type AnyMock = { mock: { calls: unknown[][] } };

/** Reads the `init` (2nd) argument of the nth recorded fetch call. */
function initOf(mock: AnyMock, index: number): RequestInit {
  return (mock.mock.calls[index] as unknown as [unknown, RequestInit])[1];
}

/** Reads a header value off a recorded request init. */
function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name];
}

const EXCHANGE = {
  code: "the-code",
  redirectUri: "https://app.example.com/api/integrations/x/callback",
  clientId: "client-id",
  clientSecret: "client-secret",
};

describe("exchangeGitHubCode", () => {
  it("requests JSON, splits comma scopes, and reports no expiry", async () => {
    const fetchImpl = vi.fn(async () =>
      res({ access_token: "gho_x", token_type: "bearer", scope: "repo,read:org,workflow" })
    );
    const result = await exchangeGitHubCode({ ...EXCHANGE, fetchImpl });

    expect(headerOf(initOf(fetchImpl, 0), "Accept")).toBe("application/json");
    expect(result.accessToken).toBe("gho_x");
    expect(result.scopes).toEqual(["repo", "read:org", "workflow"]);
    expect(result.expiresAt).toBeNull();
    expect(result.refreshAvailable).toBe(false);
  });

  it("throws on a provider error payload", async () => {
    const fetchImpl = vi.fn(async () => res({ error: "bad_verification_code" }));
    await expect(exchangeGitHubCode({ ...EXCHANGE, fetchImpl })).rejects.toThrow();
  });
});

describe("fetchGitHubIdentity", () => {
  it("maps id and login, tolerating a null email via /user/emails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res({ id: 42, login: "octocat", email: null }))
      .mockResolvedValueOnce(
        res([{ email: "octo@github.com", primary: true, verified: true }])
      );
    const identity = await fetchGitHubIdentity("gho_x", fetchImpl);
    expect(identity.externalAccountId).toBe("42");
    expect(identity.externalAccountName).toBe("octocat");
    expect(identity.externalAccountEmail).toBe("octo@github.com");
  });
});

describe("exchangeLinearCode", () => {
  it("sends form body, captures refresh token, and sets expiry", async () => {
    const fetchImpl = vi.fn(async () =>
      res({
        access_token: "lin_x",
        refresh_token: "lin_refresh",
        token_type: "Bearer",
        expires_in: 86400,
        scope: "read,write,issues:create",
      })
    );
    const result = await exchangeLinearCode({ ...EXCHANGE, fetchImpl });

    expect(String(initOf(fetchImpl, 0).body)).toContain(
      "grant_type=authorization_code"
    );
    expect(result.accessToken).toBe("lin_x");
    expect(result.refreshToken).toBe("lin_refresh");
    expect(result.refreshAvailable).toBe(true);
    expect(result.scopes).toEqual(["read", "write", "issues:create"]);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.extraTokens?.refreshToken).toBe("lin_refresh");
  });
});

describe("listGitHubRepositories", () => {
  it("follows Link rel=next pagination and maps repo fields", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        res(
          [
            {
              full_name: "acme/one",
              name: "one",
              html_url: "https://github.com/acme/one",
              description: "first",
              language: "TypeScript",
              default_branch: "main",
              private: false,
            },
          ],
          {
            headers: {
              link: '<https://api.github.com/user/repos?page=2>; rel="next"',
            },
          }
        )
      )
      .mockResolvedValueOnce(
        res([
          {
            full_name: "acme/two",
            name: "two",
            html_url: "https://github.com/acme/two",
            default_branch: "master",
            private: true,
          },
        ])
      );

    const repos = await listGitHubRepositories("gho_x", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(repos).toHaveLength(2);
    expect(repos[0]).toMatchObject({
      fullName: "acme/one",
      primaryLanguage: "TypeScript",
      defaultBranch: "main",
      private: false,
    });
    expect(repos[1]).toMatchObject({ defaultBranch: "master", private: true });
  });
});

describe("createGitHubRepository", () => {
  it("always sends auto_init: true", async () => {
    const fetchImpl = vi.fn(async () =>
      res({
        full_name: "acme/new",
        name: "new",
        html_url: "https://github.com/acme/new",
        default_branch: "main",
        private: true,
      })
    );
    await createGitHubRepository(
      "gho_x",
      { name: "new", private: true },
      fetchImpl
    );
    expect(JSON.parse(String(initOf(fetchImpl, 0).body)).auto_init).toBe(true);
  });

  it("surfaces a 422 as a typed GitHubResourceError", async () => {
    const fetchImpl = vi.fn(async () =>
      res({ message: "name already exists on this account" }, { ok: false, status: 422 })
    );
    await expect(
      createGitHubRepository("gho_x", { name: "dup", private: false }, fetchImpl)
    ).rejects.toBeInstanceOf(GitHubResourceError);
  });
});

describe("listLinearTeams (auth header by connection type)", () => {
  it("uses Bearer for oauth and a raw key for manual_token", async () => {
    const fetchImpl = vi.fn(async () => res({ data: { teams: { nodes: [] } } }));

    await listLinearTeams("oauth_tok", "oauth", fetchImpl);
    expect(headerOf(initOf(fetchImpl, 0), "Authorization")).toBe(
      "Bearer oauth_tok"
    );

    await listLinearTeams("lin_api_key", "manual_token", fetchImpl);
    expect(headerOf(initOf(fetchImpl, 1), "Authorization")).toBe("lin_api_key");
  });
});
