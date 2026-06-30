import { prisma } from "@/lib/prisma";
import { computeProviderCardState } from "@/lib/provider-card-state";
import { listProviderConnections } from "@/lib/provider-connection-service";
import type { OnboardingSnapshot } from "@/lib/onboarding-progress";

/**
 * The name assigned to a company when it is auto-created during first-run
 * onboarding. A company still carrying this name has not been configured yet.
 */
export const DEFAULT_COMPANY_NAME = "My Company";

export interface OnboardingState {
  companyId: string;
  companyName: string;
  defaultAutonomy: string;
  defaultCulture: string;
  snapshot: OnboardingSnapshot;
}

/**
 * Derives the onboarding completion snapshot for a user's company from existing
 * platform state. No dedicated onboarding schema is read or written.
 *
 * - `companyConfigured` — the company has been renamed off its auto-create default.
 * - `providerConnected` — at least one provider connection is healthy/connected.
 * - `repositoryAdded`   — at least one repository exists under the company.
 * - `firstOutcomeSubmitted` — at least one outcome has been submitted.
 *
 * @param userId - The owner (CEO) user id
 * @returns The company identity, defaults, and derived onboarding snapshot
 * @throws When the user has no company (the onboarding page creates one first)
 */
export async function getOnboardingSnapshot(
  userId: string
): Promise<OnboardingState> {
  const company = await prisma.company.findFirst({
    where: { ownerId: userId },
    include: { settings: true },
  });
  if (!company) throw new Error("Company not found");

  const [connections, repositoryCount, outcomeCount] = await Promise.all([
    listProviderConnections(company.id),
    prisma.repository.count({
      where: { workspace: { companyId: company.id } },
    }),
    prisma.outcome.count({ where: { companyId: company.id } }),
  ]);

  const isConnected = (connection: (typeof connections)[number]): boolean =>
    computeProviderCardState({
      id: connection.id,
      status: connection.status,
      externalAccountName: connection.externalAccountName,
      externalAccountEmail: connection.externalAccountEmail,
      lastConnectedAt: connection.lastConnectedAt,
      errorMessage: connection.errorMessage,
      tokenExpiresAt: connection.tokenExpiresAt,
    }).isConnected;

  const providerConnected = connections.some(isConnected);
  const githubConnected = connections.some(
    (connection) => connection.provider === "github" && isConnected(connection)
  );

  const snapshot: OnboardingSnapshot = {
    companyConfigured: company.name !== DEFAULT_COMPANY_NAME,
    providerConnected,
    githubConnected,
    repositoryAdded: repositoryCount > 0,
    firstOutcomeSubmitted: outcomeCount > 0,
  };

  return {
    companyId: company.id,
    companyName: company.name,
    defaultAutonomy: company.settings?.autonomyLevel ?? "assist",
    defaultCulture: company.settings?.cultureProfile ?? "startup",
    snapshot,
  };
}
