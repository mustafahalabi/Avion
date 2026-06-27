"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations";
import { encryptCredentials } from "@/lib/credentials-crypto";

export type ConnectIntegrationState =
  | undefined
  | { error: string }
  | { success: true; id: string };

export async function connectIntegration(
  _prev: ConnectIntegrationState,
  formData: FormData
): Promise<ConnectIntegrationState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const provider = formData.get("provider") as string;
  const providerDef = INTEGRATION_PROVIDERS.find((p) => p.id === provider);
  if (!providerDef) return { error: "Unknown integration provider." };

  // Collect credential fields into a JSON object
  const credentials: Record<string, string> = {};
  for (const field of providerDef.fields) {
    const val = formData.get(field.key) as string | null;
    if (field.required && !val?.trim()) {
      return { error: `${field.label} is required.` };
    }
    if (val?.trim()) credentials[field.key] = val.trim();
  }

  // Upsert: one integration per provider per company
  const existing = await prisma.integration.findFirst({
    where: { companyId: company.id, provider },
    select: { id: true },
  });

  let integration;
  const encryptedCredentials = encryptCredentials(credentials);

  if (existing) {
    integration = await prisma.integration.update({
      where: { id: existing.id },
      data: {
        credentials: encryptedCredentials,
        status: "connected",
        errorMessage: null,
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    await prisma.integrationSyncLog.create({
      data: {
        integrationId: existing.id,
        status: "info",
        message: `Credentials updated for ${providerDef.name}.`,
        recordsCount: 0,
      },
    });
  } else {
    integration = await prisma.integration.create({
      data: {
        companyId: company.id,
        name: providerDef.name,
        provider,
        credentials: encryptedCredentials,
        status: "connected",
        config: "{}",
      },
      select: { id: true },
    });
    await prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: "info",
        message: `${providerDef.name} credentials saved. Provider sync is not yet active.`,
        recordsCount: 0,
      },
    });
  }

  revalidatePath("/integrations");
  return { success: true, id: integration.id };
}

export async function disconnectIntegration(integrationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, companyId: company.id },
    select: { id: true, name: true },
  });
  if (!integration) return;

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      status: "disconnected",
      credentials: "{}",
      errorMessage: null,
    },
  });

  await prisma.integrationSyncLog.create({
    data: {
      integrationId,
      status: "info",
      message: `${integration.name} disconnected.`,
      recordsCount: 0,
    },
  });

  revalidatePath("/integrations");
  revalidatePath(`/integrations/${integrationId}`);
}

export async function triggerSync(integrationId: string): Promise<{ message: string }> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "Company not found." };

  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, companyId: company.id },
  });
  if (!integration) return { message: "Integration not found." };
  if (integration.status !== "connected") return { message: "Integration is not connected." };

  await prisma.integrationSyncLog.create({
    data: {
      integrationId,
      status: "info",
      message: `Sync requested for ${integration.name}. Live provider sync is not yet implemented — credentials are stored but no data has been fetched from the provider.`,
      recordsCount: 0,
    },
  });

  revalidatePath(`/integrations/${integrationId}`);
  return { message: "Sync request logged." };
}
