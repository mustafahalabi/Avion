import {
  PROVIDER_CONNECTION_PROVIDERS,
  type Provider,
} from "@/lib/provider-connection-service";
import { GITHUB_REQUIRED_SCOPES } from "@/lib/github-connection-service";
import { LINEAR_REQUIRED_SCOPES } from "@/lib/linear-connection-service";

/**
 * Single source of per-provider OAuth configuration and "is this provider
 * configured?" detection.
 *
 * All `process.env` reads happen at CALL TIME (never module-load constants) so
 * the module is unit-testable by mutating `process.env`, mirroring
 * `credentials-crypto.ts`.
 *
 * GitHub and Linear are uniform authorize/token OAuth2 flows. The config keeps
 * per-provider flags (scope separator, whether to send scope/response_type) so
 * additional providers can be modeled without assuming one shape.
 */

export type OAuthProvider = Provider;

/** Path the per-provider CSRF nonce cookie is scoped to. */
export const OAUTH_NONCE_COOKIE_PATH = "/api/integrations";

/** Per-provider httpOnly nonce cookie name (allows concurrent connects). */
export function oauthNonceCookieName(provider: OAuthProvider): string {
  return `eos_oauth_${provider}`;
}

export interface OAuthProviderConfig {
  readonly provider: OAuthProvider;
  /** Authorize endpoint. */
  readonly authorizeUrl: string;
  /** Token-exchange endpoint. */
  readonly tokenUrl: string;
  /** Scopes requested at authorize time. */
  readonly scopes: string[];
  /** Delimiter when joining scopes: GitHub " ", Linear ",". */
  readonly scopeSeparator: string;
  /** Whether to append a `scope` query param to the authorize URL. */
  readonly sendScopeParam: boolean;
  /** Whether to append `response_type=code` to the authorize URL. */
  readonly sendResponseType: boolean;
  /** Whether to append `redirect_uri` to the authorize URL. */
  readonly sendRedirectUriParam: boolean;
  /** Reserved for future PKCE support (all false in v1). */
  readonly supportsPkce: boolean;
  /** OAuth client id, or null when unconfigured. */
  readonly clientId: string | null;
  /** OAuth client secret, or null when unconfigured. */
  readonly clientSecret: string | null;
}

/** Reads a trimmed, non-empty env var or null. */
function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

/**
 * Type guard: is `value` one of the canonical OAuth providers?
 * Uses `PROVIDER_CONNECTION_PROVIDERS` (github|linear) — NOT the
 * `integrations.ts` list, which also includes "slack".
 */
export function isOAuthProvider(value: string): value is OAuthProvider {
  return (PROVIDER_CONNECTION_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Returns the OAuth configuration for a provider, reading env at call time.
 * `clientId`/`clientSecret` are null when the corresponding env vars are unset.
 */
export function getOAuthProviderConfig(
  provider: OAuthProvider
): OAuthProviderConfig {
  switch (provider) {
    case "github":
      return {
        provider,
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: [...GITHUB_REQUIRED_SCOPES],
        scopeSeparator: " ",
        sendScopeParam: true,
        sendResponseType: false,
        sendRedirectUriParam: true,
        supportsPkce: false,
        clientId: env("GITHUB_OAUTH_CLIENT_ID"),
        clientSecret: env("GITHUB_OAUTH_CLIENT_SECRET"),
      };
    case "linear":
      return {
        provider,
        authorizeUrl: "https://linear.app/oauth/authorize",
        tokenUrl: "https://api.linear.app/oauth/token",
        scopes: [...LINEAR_REQUIRED_SCOPES],
        scopeSeparator: ",", // Linear requires COMMA-separated scopes.
        sendScopeParam: true,
        sendResponseType: true,
        sendRedirectUriParam: true,
        supportsPkce: false,
        clientId: env("LINEAR_OAUTH_CLIENT_ID"),
        clientSecret: env("LINEAR_OAUTH_CLIENT_SECRET"),
      };
  }
}

/**
 * Builds the exact callback redirect URI for a provider from the configured
 * base URL ONLY — never from the request origin / Host header (which would be a
 * host-header-injection vector, and would not byte-match the value registered
 * with the provider). The same value must be reused at token exchange.
 *
 * @returns The absolute callback URL, or null when `OAUTH_REDIRECT_BASE_URL` is
 *          unset/invalid (which makes the provider count as not configured).
 */
export function getOAuthRedirectUri(provider: OAuthProvider): string | null {
  const base = env("OAUTH_REDIRECT_BASE_URL");
  if (!base) return null;

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/api/integrations/${provider}/callback`;
}

/**
 * True only when a provider can actually run its OAuth flow: client id + secret
 * present and a resolvable redirect base. Gates the UI buttons and fails the
 * route handlers closed.
 */
export function isProviderOAuthConfigured(provider: OAuthProvider): boolean {
  const config = getOAuthProviderConfig(provider);
  if (!config.clientId || !config.clientSecret) return false;
  if (!getOAuthRedirectUri(provider)) return false;
  return true;
}

/**
 * Builds the provider authorize URL to redirect the user to, applying the
 * per-provider param flags (scope/response_type/redirect_uri).
 *
 * @throws If the provider is not configured (callers should gate on
 *         `isProviderOAuthConfigured` first).
 */
export function buildAuthorizeUrl(
  provider: OAuthProvider,
  params: { state: string; redirectUri: string }
): string {
  const config = getOAuthProviderConfig(provider);
  if (!config.clientId || !config.authorizeUrl) {
    throw new Error(`OAuth provider "${provider}" is not configured.`);
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", params.state);
  if (config.sendRedirectUriParam) {
    url.searchParams.set("redirect_uri", params.redirectUri);
  }
  if (config.sendResponseType) {
    url.searchParams.set("response_type", "code");
  }
  if (config.sendScopeParam && config.scopes.length > 0) {
    url.searchParams.set("scope", config.scopes.join(config.scopeSeparator));
  }
  return url.toString();
}
