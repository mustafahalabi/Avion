import { linearGraphql } from "./linear-resources";
import type {
  AccountIdentity,
  ExchangeCodeInput,
  FetchLike,
  TokenExchangeResult,
} from "./types";

/**
 * Linear OAuth token exchange, identity, and refresh.
 *
 * Linear access tokens expire (~24h) and DO return a refresh token, so the
 * callback must persist the refresh token + expiry and mark refreshAvailable.
 * Token endpoint is form-encoded; scopes come back COMMA-separated.
 */

const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";

interface LinearTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string | string[];
  error?: string;
}

/** Normalizes Linear's `scope` (string or array) into a string[]. */
function parseScopes(scope: string | string[] | undefined): string[] {
  if (Array.isArray(scope)) return scope.filter(Boolean);
  return (scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toResult(data: LinearTokenResponse): TokenExchangeResult {
  if (data.error || !data.access_token) {
    throw new Error(`Linear token exchange error: ${data.error ?? "no access_token"}.`);
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;
  const extraTokens: Record<string, string> = {};
  if (data.refresh_token) extraTokens.refreshToken = data.refresh_token;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scopes: parseScopes(data.scope),
    expiresAt,
    refreshAvailable: Boolean(data.refresh_token),
    extraTokens,
  };
}

/**
 * Exchanges an authorization code for a Linear access + refresh token.
 * @throws On a non-OK response or a provider error payload.
 */
export async function exchangeLinearCode(
  input: ExchangeCodeInput
): Promise<TokenExchangeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Linear token exchange failed (${res.status}).`);
  }
  return toResult((await res.json()) as LinearTokenResponse);
}

/**
 * Re-acquires a Linear access token from a stored refresh token. Invoke lazily
 * before Linear API calls when `isConnectionTokenExpired()` is true.
 */
export async function refreshLinearToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchLike;
}): Promise<TokenExchangeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Linear token refresh failed (${res.status}).`);
  }
  return toResult((await res.json()) as LinearTokenResponse);
}

interface LinearViewer {
  id?: string;
  name?: string;
  email?: string;
  organization?: { name?: string };
}

/**
 * Resolves the connected Linear account's id, workspace name, and email via the
 * GraphQL `viewer` query (OAuth bearer token).
 */
export async function fetchLinearIdentity(
  token: string,
  fetchImpl?: FetchLike
): Promise<AccountIdentity> {
  const data = await linearGraphql<{ viewer: LinearViewer }>(
    token,
    "oauth",
    "{ viewer { id name email organization { name } } }",
    fetchImpl
  );
  const viewer = data.viewer ?? {};
  return {
    externalAccountId: viewer.id,
    externalAccountName: viewer.organization?.name ?? viewer.name,
    externalAccountEmail: viewer.email,
  };
}
