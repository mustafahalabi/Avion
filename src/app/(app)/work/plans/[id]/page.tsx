import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { PlanReviewDashboard } from "@/components/planning/plan-review-dashboard";
import { getCurrentUser } from "@/lib/current-user";
import { getPlanningReviewPageData } from "@/lib/planning-review-service";
import { prisma } from "@/lib/prisma";

interface PlanReviewPageProps {
  params: Promise<{ id: string }>;
}

/**
 * CEO-facing planning draft review page.
 *
 * @param props - Route parameters containing the planning draft ID.
 * @returns Plan review dashboard for company-owned drafts.
 */
export default async function PlanReviewPage({ params }: PlanReviewPageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const data = await getPlanningReviewPageData({
    planningDraftId: id,
    companyId: company.id,
  });

  if (!data) notFound();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href={`/work/outcomes/${data.outcome.id}`}
          className="flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Outcome
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="truncate text-sm font-semibold text-neutral-100">Plan review</h1>
      </header>

      <div className="mx-auto w-full max-w-3xl p-6">
        <PlanReviewDashboard plan={data.plan} outcomeTitle={data.outcome.title} />
      </div>
    </div>
  );
}
