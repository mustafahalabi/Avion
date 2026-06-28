import { decryptCredentials, encryptCredentials } from "@/lib/credentials-crypto";
import { prisma } from "@/lib/prisma";
import type { ProviderConnection } from "@/generated/prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PROVIDER_CONNECTION_PROVIDERS = [
  "github",
  "linear",
  "vercel",
] as const;

export const PROVIDER_CONNECTION_TYPES = [
  "oauth",
  "github_app",
  "manual_token",
] as const;

export const PROVIDER_CONNECTION_STATUSES = [
  "connected",
  "disconnected",
  "error",
  "expired",
  "revoked",
  "needs_reauth",
] as const;

export type Provider = (typeof PROVIDER_CONNECTION_PROVIDERS)[number];
export type ConnectionType = (typeof PROVIDER_CONNECTION_TYPES)[number];
export type ConnectionStatus = (typeof PROVIDER_CONNECTION_STATUSES)[number];

// ─── Input / Output Interfaces ────────────────────────────────────────────────

/**
 * Decrypted token payload stored inside a ProviderConnection.
 * Keys are provider-specific; all are optional to support different flows.
 */
export interface ConnectionTokens {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  /** GitHub App installation ID */
  installationId?: string;
  /** Manual token (used when connectionType is "manual_token") */
  manualToken?: string;
  [key: string]: string | undefined;
}

/**
 * Input for creating or upserting a provider connection.
 */
export interface UpsertProviderConnectionInput {
  companyId: string;
  /** null = company-level connection; string = user-scoped */
  userId: string | null;
  provider: Provider;
  connectionType: ConnectionType;
  status: ConnectionStatus;
  tokens: ConnectionTokens;
  tokenExpiresAt?: Date | null;
  refreshAvailable?: boolean;
  scopes?: string[];
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  externalAccountEmail?: string | null;
}

/**
 * A ProviderConnection with decrypted token payload attached.
 */
export interface ProviderConnectionWithTokens extends ProviderConnection {
  tokens: ConnectionTokens;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Serializes scopes array into JSON for storage.
 *
 * @param scopes - Array of scope strings
 * @returns JSON string representation
 */
function serializeScopes(scopes: string[]): string {
  return JSON.stringify(scopes);
}

/**
 * Deserializes scopes JSON from storage.
 *
 * @param raw - Raw JSON string from database
 * @returns Array of scope strings
 */
function deserializeScopes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Attaches decrypted tokens to a ProviderConnection record.
 *
 * @param connection - Raw ProviderConnection from database
 * @returns ProviderConnection with decrypted tokens attached
 */
function withTokens(connection: ProviderConnection): ProviderConnectionWithTokens {
  const tokens = decryptCredentials(connection.encryptedTokens) as ConnectionTokens;
  return { ...connection, tokens };
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Upserts a provider connection for a company (or user within a company).
 *
 * SQLite does not enforce uniqueness on composite indexes containing NULL
 * values. For company-level connections (userId IS NULL), uniqueness is
 * enforced here: we first look up any existing connection for the same
 * companyId + provider + null userId before upserting.
 *
 * @param input - Connection upsert payload including decrypted tokens
 * @returns The upserted ProviderConnection with decrypted tokens
 *
 * @example
 * const conn = await upsertProviderConnection({
 *   companyId: "cmp_123",
 *   userId: null,
 *   provider: "github",
 *   connectionType: "oauth",
 *   status: "connected",
 *   tokens: { accessToken: "gho_…" },
 *   scopes: ["repo", "read:org"],
 *   externalAccountId: "12345",
 *   externalAccountName: "my-org",
 * });
 */
export async function upsertProviderConnection(
  input: UpsertProviderConnectionInput
): Promise<ProviderConnectionWithTokens> {
  const {
    companyId,
    userId,
    provider,
    connectionType,
    status,
    tokens,
    tokenExpiresAt,
    refreshAvailable,
    scopes,
    externalAccountId,
    externalAccountName,
    externalAccountEmail,
  } = input;

  const encryptedTokens = encryptCredentials(
    tokens as Record<string, string>
  );
  const scopesJson = serializeScopes(scopes ?? []);

  // Enforce company-level uniqueness for SQLite's NULL handling
  const existing = await prisma.providerConnection.findFirst({
    where: { companyId, provider, userId: userId ?? null },
  });

  if (existing) {
    const updated = await prisma.providerConnection.update({
      where: { id: existing.id },
      data: {
        connectionType,
        status,
        encryptedTokens,
        tokenExpiresAt: tokenExpiresAt ?? null,
        refreshAvailable: refreshAvailable ?? false,
        scopes: scopesJson,
        externalAccountId: externalAccountId ?? null,
        externalAccountName: externalAccountName ?? null,
        externalAccountEmail: externalAccountEmail ?? null,
        errorCode: null,
        errorMessage: null,
        lastConnectedAt: status === "connected" ? new Date() : existing.lastConnectedAt,
        disconnectedAt: status === "disconnected" || status === "revoked" ? new Date() : null,
      },
    });
    return withTokens(updated);
  }

  const isDisconnectedStatus = status === "disconnected" || status === "revoked";

  const created = await prisma.providerConnection.create({
    data: {
      companyId,
      userId: userId ?? null,
      provider,
      connectionType,
      status,
      encryptedTokens,
      tokenExpiresAt: tokenExpiresAt ?? null,
      refreshAvailable: refreshAvailable ?? false,
      scopes: scopesJson,
      externalAccountId: externalAccountId ?? null,
      externalAccountName: externalAccountName ?? null,
      externalAccountEmail: externalAccountEmail ?? null,
      lastConnectedAt: status === "connected" ? new Date() : null,
      disconnectedAt: isDisconnectedStatus ? new Date() : null,
    },
  });
  return withTokens(created);
}

/**
 * Retrieves the active provider connection for a company (or user) and provider.
 *
 * @param companyId - Company ID
 * @param provider - Provider identifier
 * @param userId - null for company-level; string for user-scoped
 * @returns ProviderConnection with tokens, or null if not found
 *
 * @example
 * const conn = await getProviderConnection("cmp_123", "github", null);
 * if (conn?.status === "connected") {
 *   const { accessToken } = conn.tokens;
 * }
 */
export async function getProviderConnection(
  companyId: string,
  provider: Provider,
  userId: string | null = null
): Promise<ProviderConnectionWithTokens | null> {
  const connection = await prisma.providerConnection.findFirst({
    where: { companyId, provider, userId: userId ?? null },
  });
  return connection ? withTokens(connection) : null;
}

/**
 * Lists all provider connections for a company.
 *
 * @param companyId - Company ID
 * @returns Array of ProviderConnections with tokens attached
 *
 * @example
 * const connections = await listProviderConnections("cmp_123");
 */
export async function listProviderConnections(
  companyId: string
): Promise<ProviderConnectionWithTokens[]> {
  const connections = await prisma.providerConnection.findMany({
    where: { companyId },
    orderBy: { provider: "asc" },
  });
  return connections.map(withTokens);
}

/**
 * Marks a provider connection as disconnected and clears token data.
 *
 * @param companyId - Company ID (ownership guard)
 * @param connectionId - ProviderConnection ID
 * @returns Updated connection, or null if not found / not owned by company
 *
 * @example
 * await disconnectProviderConnection("cmp_123", "conn_456");
 */
export async function disconnectProviderConnection(
  companyId: string,
  connectionId: string
): Promise<ProviderConnectionWithTokens | null> {
  const existing = await prisma.providerConnection.findFirst({
    where: { id: connectionId, companyId },
  });
  if (!existing) return null;

  const updated = await prisma.providerConnection.update({
    where: { id: connectionId },
    data: {
      status: "disconnected",
      encryptedTokens: "{}",
      refreshAvailable: false,
      tokenExpiresAt: null,
      disconnectedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  });
  return withTokens(updated);
}

/**
 * Records an error state on a provider connection.
 *
 * @param companyId - Company ID (ownership guard)
 * @param connectionId - ProviderConnection ID
 * @param errorCode - Machine-readable error code
 * @param errorMessage - Human-readable error description
 * @returns Updated connection, or null if not found / not owned by company
 *
 * @example
 * await recordProviderConnectionError("cmp_123", "conn_456", "token_expired", "Access token has expired.");
 */
export async function recordProviderConnectionError(
  companyId: string,
  connectionId: string,
  errorCode: string,
  errorMessage: string
): Promise<ProviderConnectionWithTokens | null> {
  const existing = await prisma.providerConnection.findFirst({
    where: { id: connectionId, companyId },
  });
  if (!existing) return null;

  const updated = await prisma.providerConnection.update({
    where: { id: connectionId },
    data: {
      status: "error",
      errorCode,
      errorMessage,
    },
  });
  return withTokens(updated);
}

/**
 * Permanently deletes a provider connection and clears all stored tokens.
 *
 * @param companyId - Company ID (ownership guard)
 * @param connectionId - ProviderConnection ID
 * @returns True if deleted, false if not found or not owned by company
 *
 * @example
 * const deleted = await deleteProviderConnection("cmp_123", "conn_456");
 */
export async function deleteProviderConnection(
  companyId: string,
  connectionId: string
): Promise<boolean> {
  const existing = await prisma.providerConnection.findFirst({
    where: { id: connectionId, companyId },
  });
  if (!existing) return false;

  await prisma.providerConnection.delete({ where: { id: connectionId } });
  return true;
}

/**
 * Returns scopes granted for a provider connection as a string array.
 *
 * @param connection - ProviderConnection record
 * @returns Array of scope strings
 *
 * @example
 * const scopes = getConnectionScopes(conn);
 * if (scopes.includes("repo")) { ... }
 */
export function getConnectionScopes(connection: ProviderConnection): string[] {
  return deserializeScopes(connection.scopes);
}

/**
 * Returns true when the connection's access token has expired.
 *
 * @param connection - ProviderConnection record
 * @returns True if expired, false if not expired or expiry is unknown
 *
 * @example
 * if (isConnectionTokenExpired(conn)) {
 *   await refreshConnection(conn.id);
 * }
 */
export function isConnectionTokenExpired(connection: ProviderConnection): boolean {
  if (!connection.tokenExpiresAt) return false;
  return connection.tokenExpiresAt < new Date();
}
