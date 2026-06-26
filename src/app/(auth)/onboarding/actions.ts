"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

interface OnboardingSettings {
  companyId: string;
  autonomyLevel: string;
  cultureProfile: string;
}

export async function saveOnboardingSettings({
  companyId,
  autonomyLevel,
  cultureProfile,
}: OnboardingSettings) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const company = await prisma.company.findFirst({
    where: { id: companyId, ownerId: session.user.id },
  });
  if (!company) throw new Error("Company not found");

  await prisma.companySettings.upsert({
    where: { companyId },
    update: { autonomyLevel, cultureProfile },
    create: { companyId, autonomyLevel, cultureProfile },
  });
}
