import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildAuthorizeUrl,
  getOAuthProviderConfig,
  getOAuthRedirectUri,
  isOAuthProvider,
  isProviderOAuthConfigured,
} from "./oauth-config";

const OAUTH_ENV_KEYS = [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "LINEAR_OAUTH_CLIENT_ID",
  "LINEAR_OAUTH_CLIENT_SECRET",
  "OAUTH_REDIRECT_BASE_URL",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of OAUTH_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of OAUTH_ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("isOAuthProvider", () => {
  it("accepts the canonical providers and rejects others", () => {
    expect(isOAuthProvider("github")).toBe(true);
    expect(isOAuthProvider("linear")).toBe(true);
    expect(isOAuthProvider("vercel")).toBe(false);
    expect(isOAuthProvider("slack")).toBe(false);
    expect(isOAuthProvider("../etc/passwd")).toBe(false);
  });
});

describe("isProviderOAuthConfigured", () => {
  it("is false when client id/secret are missing", () => {
    process.env.OAUTH_REDIRECT_BASE_URL = "https://app.example.com";
    expect(isProviderOAuthConfigured("github")).toBe(false);
  });

  it("is false when the redirect base URL is missing", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "secret";
    expect(isProviderOAuthConfigured("github")).toBe(false);
  });

  it("is true for GitHub when id, secret, and base are all present", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "secret";
    process.env.OAUTH_REDIRECT_BASE_URL = "https://app.example.com";
    expect(isProviderOAuthConfigured("github")).toBe(true);
  });
});

describe("getOAuthRedirectUri", () => {
  it("derives the callback URL from OAUTH_REDIRECT_BASE_URL only", () => {
    process.env.OAUTH_REDIRECT_BASE_URL = "https://app.example.com/";
    expect(getOAuthRedirectUri("github")).toBe(
      "https://app.example.com/api/integrations/github/callback"
    );
    expect(getOAuthRedirectUri("linear")).toBe(
      "https://app.example.com/api/integrations/linear/callback"
    );
  });

  it("returns null when the base URL is unset or invalid", () => {
    expect(getOAuthRedirectUri("github")).toBeNull();
    process.env.OAUTH_REDIRECT_BASE_URL = "not a url";
    expect(getOAuthRedirectUri("github")).toBeNull();
  });
});

describe("getOAuthProviderConfig", () => {
  it("uses comma scope separator for Linear and space for GitHub", () => {
    expect(getOAuthProviderConfig("linear").scopeSeparator).toBe(",");
    expect(getOAuthProviderConfig("github").scopeSeparator).toBe(" ");
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes client_id, state, redirect_uri, and space-joined scopes for GitHub", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "gh_client";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "secret";
    const url = new URL(
      buildAuthorizeUrl("github", {
        state: "state123",
        redirectUri: "https://app.example.com/api/integrations/github/callback",
      })
    );
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("gh_client");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/integrations/github/callback"
    );
    expect(url.searchParams.get("scope")).toContain("repo");
    expect(url.searchParams.get("response_type")).toBeNull();
  });

  it("uses comma-joined scopes and response_type=code for Linear", () => {
    process.env.LINEAR_OAUTH_CLIENT_ID = "ln_client";
    process.env.LINEAR_OAUTH_CLIENT_SECRET = "secret";
    const url = new URL(
      buildAuthorizeUrl("linear", {
        state: "s",
        redirectUri: "https://app.example.com/api/integrations/linear/callback",
      })
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("read,write,issues:create");
  });
});
