import { getCurrentUser } from "@/lib/current-user";
import { listEligibleReleaseTasks } from "@/lib/release-candidate-service";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreateReleaseCandidateForm } from "./create-release-candidate-form";

export default async function NewReleaseCandidatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const eligibleTasks = await listEligibleReleaseTasks(company.id);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/releases"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Releases
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">New Release Candidate</h1>
      </header>

      <div className="flex flex-col gap-4 p-6 max-w-lg">
        <p className="text-xs text-neutral-600 leading-relaxed">
          Build a release candidate from completed tasks that have passed review and QA.
          PR/branch metadata and validation evidence are collected from execution sessions when available.
        </p>
        <CreateReleaseCandidateForm eligibleTasks={eligibleTasks} />
      </div>
    </div>
  );
}
