import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { buildPlanningReviewUrl } from "@/lib/planning-review-view";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { GeneratePlanButton } from "./generate-plan-button";

const OUTCOME_STATUS_COLORS: Record<
  string,
  { border: string; bg: string; text: string; label: string }
> = {
  proposed: {
    border: "border-neutral-700",
    bg: "bg-neutral-800",
    text: "text-neutral-400",
    label: "Proposed",
  },
  analyzing: {
    border: "border-blue-900",
    bg: "bg-blue-950/30",
    text: "text-blue-400",
    label: "Analyzing",
  },
  planned: {
    border: "border-neutral-900",
    bg: "bg-neutral-950/20",
    text: "text-neutral-400",
    label: "Plan ready",
  },
  awaiting_approval: {
    border: "border-amber-900",
    bg: "bg-amber-950/20",
    text: "text-amber-400",
    label: "Awaiting approval",
  },
  approved: {
    border: "border-emerald-900",
    bg: "bg-emerald-950/20",
    text: "text-emerald-400",
    label: "Approved",
  },
  in_delivery: {
    border: "border-emerald-900",
    bg: "bg-emerald-950/10",
    text: "text-emerald-400",
    label: "In delivery",
  },
  completed: {
    border: "border-neutral-700",
    bg: "bg-neutral-900",
    text: "text-neutral-500",
    label: "Completed",
  },
  cancelled: {
    border: "border-neutral-800",
    bg: "bg-neutral-900",
    text: "text-neutral-600",
    label: "Cancelled",
  },
  failed: {
    border: "border-red-900",
    bg: "bg-red-950/20",
    text: "text-red-400",
    label: "Failed",
  },
};

const DRAFT_STATUS_COLORS: Record<string, string> = {
  draft: "text-neutral-400",
  reviewing: "text-amber-400",
  approved: "text-emerald-400",
  rejected: "text-red-400",
  applied: "text-emerald-500",
  failed: "text-red-400",
};

export default async function OutcomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const outcome = await prisma.outcome.findFirst({
    where: { id, companyId: company.id },
    include: {
      repository: { select: { id: true, name: true, primaryLanguage: true } },
      planningDrafts: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          title: true,
          summary: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!outcome) notFound();

  const planningTimeline = await prisma.timelineEntry.findMany({
    where: {
      OR: [
        { entityType: "outcome", entityId: outcome.id },
        ...(outcome.planningDrafts[0]
          ? [{ entityType: "planning_draft", entityId: outcome.planningDrafts[0].id }]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      eventType: true,
      summary: true,
      createdAt: true,
    },
  });

  const statusCfg =
    OUTCOME_STATUS_COLORS[outcome.status] ??
    OUTCOME_STATUS_COLORS["proposed"];
  const latestDraft = outcome.planningDrafts[0] ?? null;
  const canGeneratePlan = !latestDraft || latestDraft.status === "failed";

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
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {outcome.title}
        </h1>
      </header>

      <div className="flex flex-col gap-6 p-6">
        {/* Status badge */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5 self-start border px-2.5 py-1 text-[11px] font-medium",
            statusCfg.border,
            statusCfg.bg,
            statusCfg.text
          )}
        >
          {statusCfg.label}
        </div>

        {/* Title + description */}
        <section>
          <h2 className="text-lg font-semibold text-neutral-100">
            {outcome.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400 leading-relaxed">
            {outcome.rawRequest}
          </p>
        </section>

        {/* Metadata */}
        <section className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <MetaItem label="Priority" value={outcome.priority} />
          <MetaItem
            label="Submitted"
            value={new Date(outcome.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          {outcome.repository && (
            <MetaItem
              label="Repository"
              value={
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3 text-neutral-600" />
                  {outcome.repository.name}
                  {outcome.repository.primaryLanguage &&
                    ` · ${outcome.repository.primaryLanguage}`}
                </span>
              }
            />
          )}
        </section>

        {/* Planning draft */}
        <section>
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Planning Draft
          </h3>

          {latestDraft ? (
            <div className="border border-neutral-800 bg-neutral-900 px-4 py-4 shadow-[6px_6px_0_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-200 truncate">
                      {latestDraft.title}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-wider",
                        DRAFT_STATUS_COLORS[latestDraft.status] ??
                          "text-neutral-500"
                      )}
                    >
                      {latestDraft.status}
                    </span>
                  </div>
                  {latestDraft.summary && (
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                      {latestDraft.summary}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-neutral-700">
                    Version {latestDraft.version} ·{" "}
                    {new Date(latestDraft.updatedAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </p>
                </div>
                <Link
                  href={buildPlanningReviewUrl(latestDraft.id)}
                  className="inline-flex shrink-0 items-center border border-brand-500 bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110"
                >
                  Review plan
                </Link>
              </div>
              {latestDraft.status === "failed" && (
                <div className="mt-3 pt-3 border-t border-neutral-800">
                  <GeneratePlanButton outcomeId={outcome.id} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/50 px-4 py-6">
              <p className="mb-3 text-sm text-neutral-500">
                No planning draft yet. Generate a structured plan from this
                outcome for your review before any work begins.
              </p>
              <GeneratePlanButton outcomeId={outcome.id} />
            </div>
          )}

          {canGeneratePlan && latestDraft?.status !== "failed" && !latestDraft && null}
        </section>

        {planningTimeline.length > 0 && (
          <section>
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Planning Lifecycle
            </h3>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
              <div className="flex flex-col gap-3">
                {planningTimeline.map((entry) => (
                  <div key={entry.id} className="border-l border-neutral-700 pl-3">
                    <p className="text-xs text-neutral-300">{entry.summary}</p>
                    <p className="mt-1 text-[11px] text-neutral-600">
                      {entry.eventType.replace(/\./g, " ")} ·{" "}
                      {new Date(entry.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">
        {label}
      </span>
      <span className="text-xs text-neutral-300 capitalize">{value}</span>
    </div>
  );
}
