"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  recordGitHubConnection,
  getGitHubConnectionStatus,
  disconnectGitHub,
  GITHUB_REQUIRED_SCOPES,
  GITHUB_SCOPE_DESCRIPTIONS,
  type GitHubConnectionStatus,
} from "@/lib/github-connection-service";

export type { GitHubConnectionStatus };
export { GITHUB_REQUIRED_SCOPES, GITHUB_SCOPE_DESCRIPTIONS };

// ─── Connect via manual token ─────────────────────────────────────────────────

export type ConnectGitHubManualTokenState =
  | undefined
  | { error: string }
  | { success: true; connectionId: string };

const connectSchema = z.object({
  accessToken: z.string().min(1, "Access token is required.").trim(),
  accountName: z.string().trim().optional(),
  accountEmail: z.string().email("Must be a valid email.").trim().optional().or(z.literal("")),
});

/**
 * Stores a GitHub personal access token (PAT) as a ProviderConnection.
 * This is the manual token fallback flow — the primary OAuth flow is handled
 * via a separate OAuth callback route once app credentials are configured.
 */
export async function connectGitHubManualToken(
  _prev: ConnectGitHubManualTokenState,
  formData: FormData
): Promise<ConnectGitHubManualTokenState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const parsed = connectSchema.safeParse({
    accessToken: formData.get("accessToken"),
    accountName: formData.get("accountName") || undefined,
    accountEmail: formData.get("accountEmail") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { accessToken, accountName, accountEmail } = parsed.data;

  const conn = await recordGitHubConnection({
    companyId: company.id,
    userId: null,
    connectionType: "manual_token",
    accessToken,
    externalAccountName: accountName,
    externalAccountEmail: accountEmail || undefined,
    grantedScopes: [],
  });

  revalidatePath("/integrations");
  revalidatePath("/integrations/github");

  return { success: true, connectionId: conn.id };
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

/**
 * Disconnects the GitHub provider connection for the authenticated user's company.
 * Clears all stored tokens and marks the connection as disconnected.
 */
export async function disconnectGitHubAccount(connectionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await disconnectGitHub(company.id, connectionId);

  revalidatePath("/integrations");
  revalidatePath("/integrations/github");
}

// ─── Status query ─────────────────────────────────────────────────────────────

/**
 * Returns the current GitHub connection status for the authenticated user's company.
 * Includes scope analysis and account identity details.
 */
export async function getGitHubStatus(): Promise<GitHubConnectionStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return null;

  return getGitHubConnectionStatus(company.id);
}
