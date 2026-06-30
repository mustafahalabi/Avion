import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OutcomeForm } from "./outcome-form";

export default async function NewOutcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const repositories = await prisma.repository.findMany({
    where: { workspace: { companyId: company.id } },
    select: { id: true, name: true, primaryLanguage: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/projects"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">New Outcome</h1>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Submit an outcome
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Describe what you want built. Avion will generate a
            structured plan for your review before any work begins.
          </p>
        </div>

        <OutcomeForm repositories={repositories} />
      </div>
    </div>
  );
}
