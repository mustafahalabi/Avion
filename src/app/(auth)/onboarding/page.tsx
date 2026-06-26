import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { settings: true },
  });

  if (!company) redirect("/sign-in");

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
            defaultAutonomy={company.settings?.autonomyLevel ?? "assist"}
            defaultCulture={company.settings?.cultureProfile ?? "startup"}
          />
        </div>
      </div>
    </div>
  );
}
