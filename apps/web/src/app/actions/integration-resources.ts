"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { runRepositoryAnalysis } from "@/lib/repository-analysis-runner";
import {
  getProviderConnection,
  recordProviderConnectionError,
  isConnectionTokenExpired,
} from "@/lib/provider-connection-service";
import { getGitHubConnectionStatus } from "@/lib/github-connection-service";
import { recordLinearConnection } from "@/lib/linear-connection-service";
import {
  createRepositoryRecord,
  findRepositoryByUrl,
  normalizeRepoUrl,
} from "@/lib/repository-write";
import {
  createGitHubRepository,
  listGitHubRepositories,
  type GitHubRepoSummary,
} from "@/lib/oauth/github-resources";
import { GitHubResourceError } from "@/lib/oauth/github-http";
import {
  listLinearProjects,
  listLinearTeams,
  type LinearProjectSummary,
  type LinearTeamSummary,
} from "@/lib/oauth/linear-resources";
import { refreshLinearToken } from "@/lib/oauth/linear-oauth";
import { getOAuthProviderConfig } from "@/lib/oauth/oauth-config";
import type { ConnectionType } from "@/lib/provider-connection-service";

// ─── Shared types ───────────────────────────────────────────────────────────

/** A GitHub repo plus whether it's already imported as a Repository record. */
export interface GitHubRepoPickerItem extends GitHubRepoSummary {
  readonly alreadyImported: boolean;
}

export type LoadGitHubReposResult =
  | { ok: true; repositories: GitHubRepoPickerItem[] }
  | { ok: false; error: string; needsReauth: boolean };

export type ImportRepositoryResult =
  | { success: true; repositoryId: string; reused: boolean }
  | { error: string; needsReauth?: boolean };

export type LoadLinearResult =
  | { ok: true; teams: LinearTeamSummary[]; projects: LinearProjectSummary[] }
  | { ok: false; error: string; needsReauth: boolean };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Resolves the authenticated user's company id, or null. */
async function getCompanyId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  return company?.id ?? null;
}

/** Records a needs-reauth error on a connection (best-effort). */
async function markNeedsReauth(
  companyId: string,
  connectionId: string | null,
  message: string
): Promise<void> {
  if (!connectionId) return;
  await recordProviderConnectionError(
    companyId,
    connectionId,
    "needs_reauth",
    message
  );
}

/** True when a resource call failed because the token is no longer authorized. */
function isAuthFailure(error: unknown): boolean {
  return (
    error instanceof GitHubResourceError &&
    (error.status === 401 || error.status === 403)
  );
}

function revalidateConnectionSurfaces(): void {
  revalidatePath("/onboarding");
  revalidatePath("/integrations");
  revalidatePath("/connections");
  revalidatePath("/control-center");
}

// ─── GitHub: list + import + create ───────────────────────────────────────────

/**
 * Lists the connected GitHub account's repositories, flagging ones already
 * imported. Returns `needsReauth` when GitHub is not connected or the `repo`
 * scope is missing (so the picker can prompt a reconnect instead of breaking).
 */
export async function loadGitHubRepositories(): Promise<LoadGitHubReposResult> {
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, error: "Company not found.", needsReauth: false };

  const status = await getGitHubConnectionStatus(companyId);
  if (!status.connected) {
    return {
      ok: false,
      error: "Connect GitHub to choose a repository.",
      needsReauth: true,
    };
  }
  if (status.missingScopes.includes("repo")) {
    return {
      ok: false,
      error: "Reconnect GitHub and grant the 'repo' scope to list repositories.",
      needsReauth: true,
    };
  }

  const token = status.raw?.tokens.accessToken;
  if (!token) {
    return { ok: false, error: "Missing GitHub access token.", needsReauth: true };
  }

  try {
    const repos = await listGitHubRepositories(token);
    const existing = await prisma.repository.findMany({
      where: { workspace: { companyId }, NOT: { url: null } },
      select: { url: true },
    });
    const importedUrls = new Set(
      existing.filter((r) => r.url).map((r) => normalizeRepoUrl(r.url as string))
    );

    const repositories: GitHubRepoPickerItem[] = repos.map((repo) => ({
      ...repo,
      alreadyImported: repo.url
        ? importedUrls.has(normalizeRepoUrl(repo.url))
        : false,
    }));
    return { ok: true, repositories };
  } catch (error) {
    if (isAuthFailure(error)) {
      await markNeedsReauth(
        companyId,
        status.connectionId,
        "GitHub rejected the stored token while listing repositories."
      );
      return {
        ok: false,
        error: "GitHub access was revoked. Reconnect to continue.",
        needsReauth: true,
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to list repositories.",
      needsReauth: false,
    };
  }
}

/**
 * Imports a GitHub repository as a Repository record. Idempotent: re-importing
 * the same URL returns the existing record instead of creating a duplicate.
 */
export async function importRepository(input: {
  name: string;
  url: string;
  description?: string | null;
  primaryLanguage?: string | null;
}): Promise<ImportRepositoryResult> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "Company not found." };
  if (!input.name?.trim() || !input.url?.trim()) {
    return { error: "Repository name and URL are required." };
  }

  const existing = await findRepositoryByUrl(companyId, input.url);
  if (existing) {
    revalidateConnectionSurfaces();
    return { success: true, repositoryId: existing.id, reused: true };
  }

  const repo = await createRepositoryRecord({
    companyId,
    name: input.name,
    url: input.url,
    description: input.description ?? null,
    primaryLanguage: input.primaryLanguage ?? null,
  });
  // Auto-analyze newly imported repos (not the reused/idempotent path above).
  // `after()` runs the clone + analysis once the response is sent.
  if (repo.url) {
    after(() => runRepositoryAnalysis({ repositoryId: repo.id, companyId }));
  }
  revalidateConnectionSurfaces();
  return { success: true, repositoryId: repo.id, reused: false };
}

/**
 * Creates a new repository on GitHub (with an initial commit so it has a base
 * branch) and imports it. Surfaces 422 (name taken/invalid) and reauth states.
 */
export async function createAndImportRepository(input: {
  name: string;
  private: boolean;
  description?: string;
  org?: string;
}): Promise<ImportRepositoryResult> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "Company not found." };
  if (!input.name?.trim()) return { error: "Repository name is required." };

  const status = await getGitHubConnectionStatus(companyId);
  const token = status.raw?.tokens.accessToken;
  if (!status.connected || !token || status.missingScopes.includes("repo")) {
    return {
      error: "Connect GitHub with the 'repo' scope to create a repository.",
      needsReauth: true,
    };
  }

  let created: GitHubRepoSummary;
  try {
    created = await createGitHubRepository(token, {
      name: input.name.trim(),
      private: input.private,
      description: input.description,
      org: input.org,
    });
  } catch (error) {
    if (isAuthFailure(error)) {
      await markNeedsReauth(
        companyId,
        status.connectionId,
        "GitHub rejected the stored token while creating a repository."
      );
      return { error: "GitHub access was revoked. Reconnect to continue.", needsReauth: true };
    }
    return {
      error: error instanceof Error ? error.message : "Failed to create repository.",
    };
  }

  return importRepository({
    name: created.name,
    url: created.url,
    description: created.description,
    primaryLanguage: created.primaryLanguage,
  });
}

// ─── Linear: display teams + projects ─────────────────────────────────────────

/**
 * Loads Linear teams + projects for read-only display. Lazily refreshes the
 * access token when it has expired and a refresh token is available.
 */
export async function loadLinearProjects(): Promise<LoadLinearResult> {
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, error: "Company not found.", needsReauth: false };

  const conn = await getProviderConnection(companyId, "linear");
  if (!conn || conn.status === "disconnected" || conn.status === "revoked") {
    return { ok: false, error: "Connect Linear to view projects.", needsReauth: true };
  }

  let token = conn.tokens.accessToken;
  const connectionType = conn.connectionType as ConnectionType;

  // Lazy refresh for expired OAuth tokens (Linear tokens last ~24h).
  if (
    connectionType === "oauth" &&
    isConnectionTokenExpired(conn) &&
    conn.tokens.refreshToken
  ) {
    const config = getOAuthProviderConfig("linear");
    if (config.clientId && config.clientSecret) {
      try {
        const refreshed = await refreshLinearToken({
          refreshToken: conn.tokens.refreshToken,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        });
        await recordLinearConnection({
          companyId,
          userId: null,
          connectionType: "oauth",
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? conn.tokens.refreshToken,
          tokenExpiresAt: refreshed.expiresAt,
          refreshAvailable: refreshed.refreshAvailable,
          grantedScopes: refreshed.scopes,
          externalAccountId: conn.externalAccountId ?? undefined,
          externalAccountName: conn.externalAccountName ?? undefined,
          externalAccountEmail: conn.externalAccountEmail ?? undefined,
        });
        token = refreshed.accessToken;
      } catch {
        await markNeedsReauth(companyId, conn.id, "Linear token refresh failed.");
        return { ok: false, error: "Linear session expired. Reconnect to continue.", needsReauth: true };
      }
    }
  }

  if (!token) {
    return { ok: false, error: "Missing Linear access token.", needsReauth: true };
  }

  try {
    const [teams, projects] = await Promise.all([
      listLinearTeams(token, connectionType),
      listLinearProjects(token, connectionType),
    ]);
    return { ok: true, teams, projects };
  } catch (error) {
    await markNeedsReauth(companyId, conn.id, "Linear API rejected the stored token.");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load Linear projects.",
      needsReauth: true,
    };
  }
}
