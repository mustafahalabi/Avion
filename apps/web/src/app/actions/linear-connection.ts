"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  recordLinearConnection,
  getLinearConnectionStatus,
  disconnectLinear,
  LINEAR_REQUIRED_SCOPES,
  LINEAR_SCOPE_DESCRIPTIONS,
  type LinearConnectionStatus,
} from "@/lib/linear-connection-service";

export type { LinearConnectionStatus };
export { LINEAR_REQUIRED_SCOPES, LINEAR_SCOPE_DESCRIPTIONS };

// ─── Connect via manual API key ───────────────────────────────────────────────

export type ConnectLinearManualTokenState =
  | undefined
  | { error: string }
  | { success: true; connectionId: string };

const connectSchema = z.object({
  accessToken: z.string().min(1, "API key is required.").trim(),
  accountName: z.string().trim().optional(),
  accountEmail: z.string().email("Must be a valid email.").trim().optional().or(z.literal("")),
  defaultTeamId: z.string().trim().optional(),
});

/**
 * Stores a Linear personal API key as a ProviderConnection.
 * This is the manual token fallback flow — the primary OAuth flow is handled
 * via a separate OAuth callback route once Linear OAuth app credentials are configured.
 */
export async function connectLinearManualToken(
  _prev: ConnectLinearManualTokenState,
  formData: FormData
): Promise<ConnectLinearManualTokenState> {
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
    defaultTeamId: formData.get("defaultTeamId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { accessToken, accountName, accountEmail, defaultTeamId } = parsed.data;

  const conn = await recordLinearConnection({
    companyId: company.id,
    userId: null,
    connectionType: "manual_token",
    accessToken,
    externalAccountName: accountName,
    externalAccountEmail: accountEmail || undefined,
    defaultTeamId,
    grantedScopes: [],
  });

  revalidatePath("/integrations");
  revalidatePath("/integrations/linear");

  return { success: true, connectionId: conn.id };
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

/**
 * Disconnects the Linear provider connection for the authenticated user's company.
 * Clears all stored tokens and marks the connection as disconnected.
 */
export async function disconnectLinearAccount(connectionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await disconnectLinear(company.id, connectionId);

  revalidatePath("/integrations");
  revalidatePath("/integrations/linear");
}

// ─── Status query ─────────────────────────────────────────────────────────────

/**
 * Returns the current Linear connection status for the authenticated user's company.
 * Includes scope analysis, workspace identity, and default team selection.
 */
export async function getLinearStatus(): Promise<LinearConnectionStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return null;

  return getLinearConnectionStatus(company.id);
}
