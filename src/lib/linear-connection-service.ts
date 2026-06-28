import {
  disconnectProviderConnection,
  getProviderConnection,
  upsertProviderConnection,
  isConnectionTokenExpired,
  getConnectionScopes,
  type ProviderConnectionWithTokens,
} from "@/lib/provider-connection-service";

// ─── Linear Scope Constants ───────────────────────────────────────────────────

/**
 * Scopes requested when connecting Linear via OAuth.
 * Displayed to users before they connect so they understand what access is granted.
 */
export const LINEAR_REQUIRED_SCOPES = ["read", "write", "issues:create"] as const;

export type LinearScope = (typeof LINEAR_REQUIRED_SCOPES)[number];

export const LINEAR_SCOPE_DESCRIPTIONS: Record<LinearScope, string> = {
  read: "Read access to your Linear workspace — issues, projects, cycles, teams, and members.",
  write: "Write access to update issues, projects, and comments on your behalf.",
  "issues:create": "Create new issues and sub-issues in your workspace.",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinearConnectionType = "oauth" | "manual_token";

export interface RecordLinearConnectionInput {
  companyId: string;
  /** null = company-level; string = user-scoped */
  userId: string | null;
  connectionType: LinearConnectionType;
  /** OAuth access token or personal API key */
  accessToken: string;
  tokenExpiresAt?: Date | null;
  refreshAvailable?: boolean;
  /** Scopes granted by the provider (empty for manual API keys) */
  grantedScopes?: string[];
  /** Linear workspace/organization name */
  externalAccountName?: string;
  /** Linear user or workspace ID */
  externalAccountId?: string;
  /** Email of the connected Linear account */
  externalAccountEmail?: string;
  /** Default Linear team ID to use when creating issues */
  defaultTeamId?: string;
}

export interface LinearConnectionStatus {
  readonly connected: boolean;
  readonly connectionId: string | null;
  readonly connectionType: LinearConnectionType | null;
  readonly accountName: string | null;
  readonly accountEmail: string | null;
  readonly defaultTeamId: string | null;
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
 * Records a Linear connection after a successful OAuth callback or manual API key entry.
 * Upserts the connection so re-connecting refreshes the stored credentials.
 */
export async function recordLinearConnection(
  input: RecordLinearConnectionInput
): Promise<ProviderConnectionWithTokens> {
  const tokens: Record<string, string> = { accessToken: input.accessToken };
  if (input.defaultTeamId) tokens.defaultTeamId = input.defaultTeamId;

  return upsertProviderConnection({
    companyId: input.companyId,
    userId: input.userId,
    provider: "linear",
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
 * Returns the current Linear connection status for a company.
 * Computes which required scopes are missing and whether the token has expired.
 */
export async function getLinearConnectionStatus(
  companyId: string,
  userId: string | null = null
): Promise<LinearConnectionStatus> {
  const conn = await getProviderConnection(companyId, "linear", userId);

  if (!conn || conn.status === "disconnected" || conn.status === "revoked") {
    return {
      connected: false,
      connectionId: conn?.id ?? null,
      connectionType: null,
      accountName: null,
      accountEmail: null,
      defaultTeamId: null,
      grantedScopes: [],
      missingScopes: [...LINEAR_REQUIRED_SCOPES],
      tokenExpired: false,
      errorCode: null,
      errorMessage: null,
      lastConnectedAt: null,
      raw: conn,
    };
  }

  const grantedScopes = getConnectionScopes(conn);
  const missingScopes = LINEAR_REQUIRED_SCOPES.filter(
    (s) => !grantedScopes.includes(s)
  );
  const tokenExpired = isConnectionTokenExpired(conn);
  const connected = conn.status === "connected" && !tokenExpired;
  const defaultTeamId = conn.tokens.defaultTeamId ?? null;

  return {
    connected,
    connectionId: conn.id,
    connectionType: conn.connectionType as LinearConnectionType,
    accountName: conn.externalAccountName,
    accountEmail: conn.externalAccountEmail,
    defaultTeamId,
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
 * Disconnects the Linear connection for a company, clearing all stored tokens.
 * Returns false if the connection was not found or not owned by the company.
 */
export async function disconnectLinear(
  companyId: string,
  connectionId: string
): Promise<boolean> {
  const result = await disconnectProviderConnection(companyId, connectionId);
  return result !== null;
}
