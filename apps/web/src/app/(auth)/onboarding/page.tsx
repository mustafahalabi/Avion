import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { seedCompanyStructure } from "@/lib/company-seed";
import { computeOnboardingProgress } from "@/lib/onboarding-progress";
import { DEFAULT_COMPANY_NAME, getOnboardingSnapshot } from "@/lib/onboarding-state";
import { loadProviderCards } from "@/app/actions/provider-connection-actions";
import { OnboardingFlow, type OnboardingProviderCard } from "./onboarding-flow";

/** Providers offered during onboarding, in display order. */
const PROVIDER_ORDER = ["github", "linear"] as const;

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const existing = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });

  if (!existing) {
    await prisma.$transaction(async (tx) => {
      const slug = `company-${user.id.slice(-8).toLowerCase()}`;
      const created = await tx.company.create({
        data: {
          name: DEFAULT_COMPANY_NAME,
          slug,
          ownerId: user.id,
          settings: { create: {} },
        },
      });
      await seedCompanyStructure(tx, created.id);
      return created;
    });
  }

  const state = await getOnboardingSnapshot(user.id);
  const progress = computeOnboardingProgress(state.snapshot);

  // Per-provider connection status (same source the /connections page uses), so
  // the connect step renders each provider independently.
  const cards = await loadProviderCards();
  const cardById = new Map(cards.map((c) => [c.providerId, c]));
  const providerCards: OnboardingProviderCard[] = PROVIDER_ORDER.flatMap((id) => {
    const card = cardById.get(id);
    if (!card) return [];
    return [
      {
        id: card.providerId,
        name: card.name,
        configured: card.oauthConfigured,
        connected: card.isConnected,
        accountName: card.accountName,
      },
    ];
  });

  return (
    <Suspense fallback={null}>
      <OnboardingFlow
        companyId={state.companyId}
        companyName={state.companyName}
        defaultAutonomy={state.defaultAutonomy}
        defaultCulture={state.defaultCulture}
        progress={progress}
        providerCards={providerCards}
        githubConnected={state.snapshot.githubConnected}
      />
    </Suspense>
  );
}
