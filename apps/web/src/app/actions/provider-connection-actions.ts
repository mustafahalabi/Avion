"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  upsertProviderConnection,
  disconnectProviderConnection,
  listProviderConnections,
  type Provider,
} from "@/lib/provider-connection-service";
import { computeProviderCardState, PROVIDER_DEFS } from "@/lib/provider-card-state";
import { isOAuthProvider, isProviderOAuthConfigured } from "@/lib/oauth/oauth-config";

// ─── Connect via manual token ─────────────────────────────────────────────────

export type ConnectProviderState =
  | undefined
  | { error: string }
  | { success: true; connectionId: string };

const connectSchema = z.object({
  provider: z.enum(["github", "linear"]),
  accessToken: z.string().min(1, "Access token is required.").trim(),
  accountName: z.string().trim().optional(),
});

/**
 * Stores a manual access token for any supported provider as a ProviderConnection.
 * This is the fallback path — primary OAuth flows are handled by provider-specific
 * route handlers once app credentials are configured.
 */
export async function connectProviderManualToken(
  _prev: ConnectProviderState,
  formData: FormData
): Promise<ConnectProviderState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const parsed = connectSchema.safeParse({
    provider: formData.get("provider"),
    accessToken: formData.get("accessToken"),
    accountName: formData.get("accountName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { provider, accessToken, accountName } = parsed.data;

  const conn = await upsertProviderConnection({
    companyId: company.id,
    userId: null,
    provider: provider as Provider,
    connectionType: "manual_token",
    status: "connected",
    tokens: { accessToken },
    scopes: [],
    externalAccountName: accountName ?? null,
  });

  revalidatePath("/integrations");

  return { success: true, connectionId: conn.id };
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

/**
 * Disconnects a provider connection for the authenticated user's company.
 * Clears all stored tokens and marks the connection as disconnected.
 */
export async function disconnectProvider(connectionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await disconnectProviderConnection(company.id, connectionId);
  revalidatePath("/integrations");
}

// ─── Dashboard data ───────────────────────────────────────────────────────────

export interface ProviderCardData {
  readonly providerId: string;
  readonly name: string;
  readonly description: string;
  readonly requiredScopeSummary: string;
  readonly docsUrl: string;
  readonly tokenFieldLabel: string;
  readonly tokenFieldPlaceholder: string;
  readonly cardStatus: string;
  readonly statusLabel: string;
  readonly accountName: string | null;
  readonly accountEmail: string | null;
  readonly connectionId: string | null;
  readonly lastConnectedAt: Date | null;
  readonly errorMessage: string | null;
  readonly isConnected: boolean;
  /** Whether OAuth env credentials are present so the "Connect" button works. */
  readonly oauthConfigured: boolean;
}

/**
 * Loads provider card data for the integrations dashboard.
 * Returns one card entry per provider defined in PROVIDER_DEFS.
 */
export async function loadProviderCards(): Promise<ProviderCardData[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return [];

  const connections = await listProviderConnections(company.id);
  const connectionByProvider = new Map(connections.map((c) => [c.provider, c]));

  return PROVIDER_DEFS.map((def) => {
    const conn = connectionByProvider.get(def.id) ?? null;
    const state = computeProviderCardState(conn);
    return {
      providerId: def.id,
      name: def.name,
      description: def.description,
      requiredScopeSummary: def.requiredScopeSummary,
      docsUrl: def.docsUrl,
      tokenFieldLabel: def.tokenFieldLabel,
      tokenFieldPlaceholder: def.tokenFieldPlaceholder,
      oauthConfigured: isOAuthProvider(def.id)
        ? isProviderOAuthConfigured(def.id)
        : false,
      ...state,
    };
  });
}
