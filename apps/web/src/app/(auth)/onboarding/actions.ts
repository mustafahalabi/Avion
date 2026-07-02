"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

interface OnboardingSettings {
  companyId: string;
  name: string;
  autonomyLevel: string;
  cultureProfile: string;
}

export async function saveOnboardingSettings({
  companyId,
  name,
  autonomyLevel,
  cultureProfile,
}: OnboardingSettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthenticated");

  const company = await prisma.company.findFirst({
    where: { id: companyId, ownerId: user.id },
  });
  if (!company) throw new Error("Company not found");

  await Promise.all([
    prisma.company.update({ where: { id: companyId }, data: { name } }),
    prisma.companySettings.upsert({
      where: { companyId },
      update: { autonomyLevel, cultureProfile },
      create: { companyId, autonomyLevel, cultureProfile },
    }),
  ]);
}

interface CompanySettings {
  companyId: string;
  autonomyLevel: string;
  cultureProfile: string;
}

export async function saveCompanySettings({
  companyId,
  autonomyLevel,
  cultureProfile,
}: CompanySettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthenticated");

  const company = await prisma.company.findFirst({
    where: { id: companyId, ownerId: user.id },
  });
  if (!company) throw new Error("Company not found");

  await prisma.companySettings.upsert({
    where: { companyId },
    update: { autonomyLevel, cultureProfile },
    create: { companyId, autonomyLevel, cultureProfile },
  });
}
