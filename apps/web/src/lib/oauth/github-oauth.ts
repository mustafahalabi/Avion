import { GITHUB_API_BASE, githubApiHeaders } from "./github-http";
import type {
  AccountIdentity,
  ExchangeCodeInput,
  FetchLike,
  TokenExchangeResult,
} from "./types";

/**
 * GitHub OAuth App token exchange + identity resolution.
 *
 * GitHub classic OAuth App tokens do NOT expire and carry no refresh token; the
 * granted scopes come back in the token response `scope` field as a
 * COMMA-separated string (only when `Accept: application/json` is sent).
 *
 * Dependency-free `fetch` with an injectable seam for tests. Never logs the
 * code, token, or full request URLs.
 */

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchanges an authorization code for a GitHub access token.
 * @throws On a non-OK response or a provider error payload.
 */
export async function exchangeGitHubCode(
  input: ExchangeCodeInput
): Promise<TokenExchangeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const res = await fetchImpl(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed (${res.status}).`);
  }

  const data = (await res.json()) as GitHubTokenResponse;
  if (data.error || !data.access_token) {
    throw new Error(`GitHub token exchange error: ${data.error ?? "no access_token"}.`);
  }

  const scopes = (data.scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    accessToken: data.access_token,
    scopes,
    expiresAt: null,
    refreshAvailable: false,
  };
}

interface GitHubUser {
  id?: number;
  login?: string;
  email?: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Resolves the connected GitHub account's id, login, and (best-effort) email.
 * Email may be null without the `user:email` scope — tolerated by design.
 */
export async function fetchGitHubIdentity(
  token: string,
  fetchImpl?: FetchLike
): Promise<AccountIdentity> {
  const f = fetchImpl ?? fetch;

  const res = await f(`${GITHUB_API_BASE}/user`, { headers: githubApiHeaders(token) });
  if (!res.ok) {
    throw new Error(`GitHub identity fetch failed (${res.status}).`);
  }
  const user = (await res.json()) as GitHubUser;

  let email = user.email ?? undefined;
  if (!email) {
    // Best-effort; requires user:email scope, which we do not require.
    try {
      const emailRes = await f(`${GITHUB_API_BASE}/user/emails`, {
        headers: githubApiHeaders(token),
      });
      if (emailRes.ok) {
        const emails = (await emailRes.json()) as GitHubEmail[];
        const primary =
          emails.find((e) => e.primary && e.verified) ??
          emails.find((e) => e.verified);
        email = primary?.email;
      }
    } catch {
      // Ignore — email stays undefined.
    }
  }

  return {
    externalAccountId: user.id != null ? String(user.id) : undefined,
    externalAccountName: user.login ?? undefined,
    externalAccountEmail: email,
  };
}
