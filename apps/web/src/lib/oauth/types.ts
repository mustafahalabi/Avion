/**
 * Shared types for the OAuth token-exchange and resource modules.
 * Every network call accepts an injectable `fetchImpl` (defaults to global
 * `fetch`), mirroring the seam in `src/lib/github-pull-request.ts`.
 */

export type FetchLike = typeof fetch;

/** Normalized result of exchanging an authorization code for tokens. */
export interface TokenExchangeResult {
  /** The provider access token. */
  readonly accessToken: string;
  /** Refresh token, when the provider issues one (Linear). */
  readonly refreshToken?: string;
  /** Scopes actually granted by the provider (never the requested set). */
  readonly scopes: string[];
  /** Absolute expiry, or null for non-expiring tokens (e.g. GitHub OAuth App). */
  readonly expiresAt: Date | null;
  /** Whether a refresh token is available for re-acquiring access. */
  readonly refreshAvailable: boolean;
  /**
   * Provider-specific values to persist alongside the access token in the
   * encrypted token map (e.g. Linear `refreshToken`). `ConnectionTokens`
   * already accepts arbitrary keys.
   */
  readonly extraTokens?: Record<string, string>;
}

/** Connected-account identity resolved after token exchange. */
export interface AccountIdentity {
  readonly externalAccountId?: string;
  readonly externalAccountName?: string;
  readonly externalAccountEmail?: string;
}

/** Inputs common to every provider's code→token exchange. */
export interface ExchangeCodeInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetchImpl?: FetchLike;
}
