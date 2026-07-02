import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { SetupWizard } from "./setup-wizard";

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { settings: true },
  });

  if (!company) redirect("/onboarding");

  return (
    <SetupWizard
      companyId={company.id}
      defaultAutonomy={company.settings?.autonomyLevel ?? "assist"}
      defaultCulture={company.settings?.cultureProfile ?? "startup"}
    />
  );
}
