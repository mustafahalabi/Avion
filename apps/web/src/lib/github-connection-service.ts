import {
  disconnectProviderConnection,
  getProviderConnection,
  upsertProviderConnection,
  isConnectionTokenExpired,
  getConnectionScopes,
  type ProviderConnectionWithTokens,
} from "@/lib/provider-connection-service";

// ─── GitHub Scope Constants ───────────────────────────────────────────────────

/**
 * Scopes required for Avion to operate on GitHub repositories.
 * Displayed to users before they connect so they know what access is requested.
 */
export const GITHUB_REQUIRED_SCOPES = ["repo", "read:org", "workflow"] as const;

export type GitHubScope = (typeof GITHUB_REQUIRED_SCOPES)[number];

export const GITHUB_SCOPE_DESCRIPTIONS: Record<GitHubScope, string> = {
  repo: "Full access to repositories — read code, create branches, open pull requests, and write commit statuses.",
  "read:org": "Read organization membership, teams, and public member lists.",
  workflow: "Create and update GitHub Actions workflow files on your behalf.",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type GitHubConnectionType = "oauth" | "github_app" | "manual_token";

export interface RecordGitHubConnectionInput {
  companyId: string;
  /** null = company-level; string = user-scoped */
  userId: string | null;
  connectionType: GitHubConnectionType;
  /** OAuth access token or personal access token */
  accessToken: string;
  /** GitHub App installation ID (only for github_app connections) */
  installationId?: string;
  tokenExpiresAt?: Date | null;
  refreshAvailable?: boolean;
  /** Scopes granted by the provider (empty for manual tokens) */
  grantedScopes?: string[];
  /** GitHub user or org login */
  externalAccountName?: string;
  /** GitHub user or org numeric ID */
  externalAccountId?: string;
  /** Primary email for the connected GitHub account */
  externalAccountEmail?: string;
}

export interface GitHubConnectionStatus {
  readonly connected: boolean;
  readonly connectionId: string | null;
  readonly connectionType: GitHubConnectionType | null;
  readonly accountName: string | null;
  readonly accountEmail: string | null;
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
 * Records a GitHub connection after a successful OAuth callback or manual token entry.
 * Upserts the connection so re-connecting refreshes the stored credentials.
 */
export async function recordGitHubConnection(
  input: RecordGitHubConnectionInput
): Promise<ProviderConnectionWithTokens> {
  const tokens: Record<string, string> = { accessToken: input.accessToken };
  if (input.installationId) tokens.installationId = input.installationId;

  return upsertProviderConnection({
    companyId: input.companyId,
    userId: input.userId,
    provider: "github",
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
 * Returns the current GitHub connection status for a company.
 * Computes which required scopes are missing and whether the token has expired.
 */
export async function getGitHubConnectionStatus(
  companyId: string,
  userId: string | null = null
): Promise<GitHubConnectionStatus> {
  const conn = await getProviderConnection(companyId, "github", userId);

  if (!conn || conn.status === "disconnected" || conn.status === "revoked") {
    return {
      connected: false,
      connectionId: conn?.id ?? null,
      connectionType: null,
      accountName: null,
      accountEmail: null,
      grantedScopes: [],
      missingScopes: [...GITHUB_REQUIRED_SCOPES],
      tokenExpired: false,
      errorCode: null,
      errorMessage: null,
      lastConnectedAt: null,
      raw: conn,
    };
  }

  const grantedScopes = getConnectionScopes(conn);
  const missingScopes = GITHUB_REQUIRED_SCOPES.filter(
    (s) => !grantedScopes.includes(s)
  );
  const tokenExpired = isConnectionTokenExpired(conn);
  const connected =
    conn.status === "connected" && !tokenExpired;

  return {
    connected,
    connectionId: conn.id,
    connectionType: conn.connectionType as GitHubConnectionType,
    accountName: conn.externalAccountName,
    accountEmail: conn.externalAccountEmail,
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
 * Disconnects the GitHub connection for a company, clearing all stored tokens.
 * Returns false if the connection was not found or not owned by the company.
 */
export async function disconnectGitHub(
  companyId: string,
  connectionId: string
): Promise<boolean> {
  const result = await disconnectProviderConnection(companyId, connectionId);
  return result !== null;
}
