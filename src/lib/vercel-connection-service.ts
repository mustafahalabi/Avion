import {
  disconnectProviderConnection,
  getProviderConnection,
  upsertProviderConnection,
  isConnectionTokenExpired,
  getConnectionScopes,
  type ProviderConnectionWithTokens,
} from "@/lib/provider-connection-service";

// ─── Vercel Scope Constants ───────────────────────────────────────────────────

/**
 * Scopes requested when connecting Vercel via OAuth.
 * Displayed to users before they connect so they understand what access is granted.
 */
export const VERCEL_REQUIRED_SCOPES = [
  "deployments:read",
  "projects:read",
  "teams:read",
] as const;

export type VercelScope = (typeof VERCEL_REQUIRED_SCOPES)[number];

export const VERCEL_SCOPE_DESCRIPTIONS: Record<VercelScope, string> = {
  "deployments:read": "Read deployment status, URLs, build logs, and environment metadata.",
  "projects:read": "Read project configuration, domains, and environment variable names (values excluded).",
  "teams:read": "Read team membership and project associations.",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type VercelConnectionType = "oauth" | "manual_token";

export interface RecordVercelConnectionInput {
  companyId: string;
  /** null = company-level; string = user-scoped */
  userId: string | null;
  connectionType: VercelConnectionType;
  /** OAuth access token or personal access token */
  accessToken: string;
  tokenExpiresAt?: Date | null;
  refreshAvailable?: boolean;
  /** Scopes granted by the provider (empty for manual tokens) */
  grantedScopes?: string[];
  /** Vercel team slug or username */
  externalAccountName?: string;
  /** Vercel user or team ID */
  externalAccountId?: string;
  /** Primary email for the connected Vercel account */
  externalAccountEmail?: string;
  /** Vercel team ID to scope API calls to a specific team */
  teamId?: string;
}

export interface VercelConnectionStatus {
  readonly connected: boolean;
  readonly connectionId: string | null;
  readonly connectionType: VercelConnectionType | null;
  readonly accountName: string | null;
  readonly accountEmail: string | null;
  /** Vercel team ID stored in the connection token payload */
  readonly teamId: string | null;
  readonly grantedScopes: readonly string[];
  readonly missingScopes: readonly string[];
  readonly tokenExpired: boolean;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly lastConnectedAt: Date | null;
  readonly raw: ProviderConnectionWithTokens | null;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Records a Vercel connection after a successful OAuth callback or manual token entry.
 * Upserts the connection so re-connecting refreshes the stored credentials.
 */
export async function recordVercelConnection(
  input: RecordVercelConnectionInput
): Promise<ProviderConnectionWithTokens> {
  const tokens: Record<string, string> = { accessToken: input.accessToken };
  if (input.teamId) tokens.teamId = input.teamId;

  return upsertProviderConnection({
    companyId: input.companyId,
    userId: input.userId,
    provider: "vercel",
    connectionType: input.connectionType,
    status: "connected",
    tokens,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    refreshAvailable: input.refreshAvailable ?? false,
    scopes: input.grantedScopes ?? [],
    externalAccountId: input.externalAccountId ?? null,
    externalAccountName: input.externalAccountName ?? null,
    externalAccountEmail: input.externalAccountEmail ?? null,
  });
}

/**
 * Returns the current Vercel connection status for a company.
 * Computes which required scopes are missing and whether the token has expired.
 */
export async function getVercelConnectionStatus(
  companyId: string,
  userId: string | null = null
): Promise<VercelConnectionStatus> {
  const conn = await getProviderConnection(companyId, "vercel", userId);

  if (!conn || conn.status === "disconnected" || conn.status === "revoked") {
    return {
      connected: false,
      connectionId: conn?.id ?? null,
      connectionType: null,
      accountName: null,
      accountEmail: null,
      teamId: null,
      grantedScopes: [],
      missingScopes: [...VERCEL_REQUIRED_SCOPES],
      tokenExpired: false,
      errorCode: null,
      errorMessage: null,
      lastConnectedAt: null,
      raw: conn,
    };
  }

  const grantedScopes = getConnectionScopes(conn);
  const missingScopes = VERCEL_REQUIRED_SCOPES.filter(
    (s) => !grantedScopes.includes(s)
  );
  const tokenExpired = isConnectionTokenExpired(conn);
  const connected = conn.status === "connected" && !tokenExpired;
  const teamId = conn.tokens.teamId ?? null;

  return {
    connected,
    connectionId: conn.id,
    connectionType: conn.connectionType as VercelConnectionType,
    accountName: conn.externalAccountName,
    accountEmail: conn.externalAccountEmail,
    teamId,
    grantedScopes,
    missingScopes,
    tokenExpired,
    errorCode: conn.errorCode,
    errorMessage: conn.errorMessage,
    lastConnectedAt: conn.lastConnectedAt,
    raw: conn,
  };
}

/**
 * Disconnects the Vercel connection for a company, clearing all stored tokens.
 * Returns false if the connection was not found or not owned by the company.
 */
export async function disconnectVercel(
  companyId: string,
  connectionId: string
): Promise<boolean> {
  const result = await disconnectProviderConnection(companyId, connectionId);
  return result !== null;
}
