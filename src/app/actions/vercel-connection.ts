"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  recordVercelConnection,
  getVercelConnectionStatus,
  disconnectVercel,
  type VercelConnectionStatus,
} from "@/lib/vercel-connection-service";

export type ConnectVercelManualTokenState =
  | undefined
  | { error: string }
  | { success: true; connectionId: string };

export async function connectVercelManualToken(
  _prev: ConnectVercelManualTokenState,
  formData: FormData
): Promise<ConnectVercelManualTokenState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const accessToken = (formData.get("accessToken") as string | null)?.trim();
  const accountName = (formData.get("accountName") as string | null)?.trim() || undefined;
  const accountEmail = (formData.get("accountEmail") as string | null)?.trim() || undefined;
  const teamId = (formData.get("teamId") as string | null)?.trim() || undefined;

  if (!accessToken) return { error: "Access token is required." };

  try {
    const conn = await recordVercelConnection({
      companyId: company.id,
      userId: null,
      connectionType: "manual_token",
      accessToken,
      externalAccountName: accountName,
      externalAccountEmail: accountEmail,
      teamId,
    });

    revalidatePath("/integrations");
    return { success: true, connectionId: conn.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to store credentials.";
    return { error: msg };
  }
}

export async function disconnectVercelAccount(connectionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await disconnectVercel(company.id, connectionId);
  revalidatePath("/integrations");
}

export async function getVercelStatus(): Promise<VercelConnectionStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return null;

  return getVercelConnectionStatus(company.id);
}
