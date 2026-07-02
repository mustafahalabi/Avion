// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderCardStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "expired"
  | "needs_reauth"
  | "warning";

export interface ProviderConnectionSnapshot {
  readonly id: string;
  readonly status: string;
  readonly externalAccountName: string | null;
  readonly externalAccountEmail: string | null;
  readonly lastConnectedAt: Date | null;
  readonly errorMessage: string | null;
  readonly tokenExpiresAt: Date | null;
}

export interface ProviderCardState {
  readonly cardStatus: ProviderCardStatus;
  readonly statusLabel: string;
  readonly accountName: string | null;
  readonly accountEmail: string | null;
  readonly connectionId: string | null;
  readonly lastConnectedAt: Date | null;
  readonly errorMessage: string | null;
  readonly isConnected: boolean;
}

// ─── State computation ────────────────────────────────────────────────────────

/**
 * Derives a typed provider card display state from a raw ProviderConnection record.
 * Pure — no I/O; safe to test without a database.
 *
 * @param connection - ProviderConnection snapshot, or null if no record exists
 * @returns ProviderCardState for rendering the provider card
 */
export function computeProviderCardState(
  connection: ProviderConnectionSnapshot | null
): ProviderCardState {
  if (!connection) {
    return {
      cardStatus: "disconnected",
      statusLabel: "Not connected",
      accountName: null,
      accountEmail: null,
      connectionId: null,
      lastConnectedAt: null,
      errorMessage: null,
      isConnected: false,
    };
  }

  const tokenExpired =
    connection.tokenExpiresAt !== null &&
    connection.tokenExpiresAt < new Date();

  // Determine card status from database status + expiry
  let cardStatus: ProviderCardStatus;
  let statusLabel: string;

  if (connection.status === "connected" && tokenExpired) {
    cardStatus = "expired";
    statusLabel = "Token expired";
  } else if (connection.status === "connected") {
    cardStatus = "connected";
    statusLabel = "Connected";
  } else if (connection.status === "error") {
    cardStatus = "error";
    statusLabel = "Connection error";
  } else if (connection.status === "expired") {
    cardStatus = "expired";
    statusLabel = "Token expired";
  } else if (connection.status === "needs_reauth") {
    cardStatus = "needs_reauth";
    statusLabel = "Needs attention";
  } else if (connection.status === "revoked") {
    cardStatus = "needs_reauth";
    statusLabel = "Access revoked";
  } else {
    cardStatus = "disconnected";
    statusLabel = "Not connected";
  }

  return {
    cardStatus,
    statusLabel,
    accountName: connection.externalAccountName,
    accountEmail: connection.externalAccountEmail,
    connectionId: connection.id,
    lastConnectedAt: connection.lastConnectedAt,
    errorMessage: connection.errorMessage,
    isConnected: cardStatus === "connected",
  };
}

// ─── Provider definitions ─────────────────────────────────────────────────────

export interface ProviderDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredScopeSummary: string;
  readonly docsUrl: string;
  /** Field key for the access token when using manual entry */
  readonly tokenFieldLabel: string;
  readonly tokenFieldPlaceholder: string;
}

export const PROVIDER_DEFS: readonly ProviderDef[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories, track pull requests, and automate branch workflows.",
    requiredScopeSummary: "repo, read:org, workflow",
    docsUrl: "https://github.com/settings/tokens",
    tokenFieldLabel: "Personal access token",
    tokenFieldPlaceholder: "ghp_… or ghs_…",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Sync issues, projects, and cycles from your Linear workspace.",
    requiredScopeSummary: "read, write, issues:create",
    docsUrl: "https://linear.app/settings/api",
    tokenFieldLabel: "Personal API key",
    tokenFieldPlaceholder: "lin_api_…",
  },
] as const;
