import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { seedCompanyStructure } from "@/lib/company-seed";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  let company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { settings: true },
  });

  if (!company) {
    company = await prisma.$transaction(async (tx) => {
      const slug = `company-${user.id.slice(-8).toLowerCase()}`;
      const created = await tx.company.create({
        data: {
          name: "My Company",
          slug,
          ownerId: user.id,
          settings: { create: {} },
        },
        include: { settings: true },
      });
      await seedCompanyStructure(tx, created.id);
      return created;
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
            <span className="text-sm font-bold text-neutral-900">E</span>
          </div>
          <span className="text-base font-semibold text-neutral-100">
            Engineering OS
          </span>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
          <h1 className="mb-1 text-lg font-semibold text-neutral-100">
            Set up your company
          </h1>
          <p className="mb-8 text-sm text-neutral-500">
            Two choices. Your company handles everything else.
          </p>

          <OnboardingForm
            companyId={company.id}
            defaultName={company.name}
            defaultAutonomy={company.settings?.autonomyLevel ?? "assist"}
            defaultCulture={company.settings?.cultureProfile ?? "startup"}
          />
        </div>
      </div>
    </div>
  );
}
