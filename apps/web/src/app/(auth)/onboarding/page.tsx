import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { seedCompanyStructure } from "@/lib/company-seed";
import { computeOnboardingProgress } from "@/lib/onboarding-progress";
import { DEFAULT_COMPANY_NAME, getOnboardingSnapshot } from "@/lib/onboarding-state";
import { isProviderOAuthConfigured } from "@/lib/oauth/oauth-config";
import { OnboardingFlow } from "./onboarding-flow";

const ONBOARDING_PROVIDERS = [
  { id: "github" as const, name: "GitHub" },
  { id: "linear" as const, name: "Linear" },
];

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

  const providers = ONBOARDING_PROVIDERS.map((provider) => ({
    ...provider,
    configured: isProviderOAuthConfigured(provider.id),
  }));

  return (
    <OnboardingFlow
      companyId={state.companyId}
      companyName={state.companyName}
      defaultAutonomy={state.defaultAutonomy}
      defaultCulture={state.defaultCulture}
      progress={progress}
      providers={providers}
      githubConnected={state.snapshot.githubConnected}
    />
  );
}
