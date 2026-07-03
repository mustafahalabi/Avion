import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Target, Plus, ChevronRight, GitBranch } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  proposed: { label: "Proposed", color: "text-neutral-400", dot: "bg-neutral-600" },
  analyzing: { label: "Analyzing", color: "text-blue-400", dot: "bg-blue-500" },
  planned: { label: "Plan ready", color: "text-neutral-400", dot: "bg-neutral-500" },
  awaiting_approval: { label: "Awaiting approval", color: "text-amber-400", dot: "bg-amber-500" },
  approved: { label: "Approved", color: "text-emerald-400", dot: "bg-emerald-500" },
  in_delivery: { label: "In delivery", color: "text-emerald-400", dot: "bg-emerald-500" },
  completed: { label: "Completed", color: "text-neutral-500", dot: "bg-neutral-600" },
  cancelled: { label: "Cancelled", color: "text-neutral-700", dot: "bg-neutral-800" },
  failed: { label: "Failed", color: "text-red-400", dot: "bg-red-500" },
};

const DRAFT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft plan",
  reviewing: "In review",
  approved: "Plan approved",
  rejected: "Plan rejected",
  applied: "Plan applied",
  failed: "Plan failed",
};

export default async function OutcomesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const outcomes = await prisma.outcome.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      repository: { select: { name: true, primaryLanguage: true } },
      planningDrafts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { status: true },
      },
      _count: { select: { tasks: true } },
    },
  });

  const stats = {
    total: outcomes.length,
    open: outcomes.filter(
      (o) => !["completed", "cancelled", "failed"].includes(o.status)
    ).length,
    inDelivery: outcomes.filter((o) => o.status === "in_delivery").length,
    completed: outcomes.filter((o) => o.status === "completed").length,
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/work"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Work
          </Link>
          <span className="text-neutral-700">/</span>
          <h1 className="text-sm font-semibold text-neutral-100">Outcomes</h1>
        </div>
        <Link
          href="/work/outcomes/new"
          className="inline-flex items-center gap-1.5 border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" />
          New outcome
        </Link>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Stats */}
        {outcomes.length > 0 && (
          <section className="grid grid-cols-4 gap-3">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Open" value={stats.open} />
            <StatCard
              label="In delivery"
              value={stats.inDelivery}
              color="text-emerald-400"
            />
            <StatCard
              label="Completed"
              value={stats.completed}
              color="text-neutral-400"
            />
          </section>
        )}

        {/* Outcome list */}
        {outcomes.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
              <Target className="h-5 w-5 text-neutral-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-300">
                No outcomes yet
              </p>
              <p className="mt-1 text-xs text-neutral-600 max-w-xs">
                Describe what you want built. Avion will generate a
                structured plan for your review before any work begins.
              </p>
            </div>
            <Link
              href="/work/outcomes/new"
              className="inline-flex items-center gap-1.5 border border-brand-500 bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <Plus className="h-3 w-3" />
              Submit first outcome
            </Link>
          </div>
        ) : (
          <section>
            <div className="flex flex-col gap-2">
              {outcomes.map((outcome) => {
                const cfg =
                  STATUS_CONFIG[outcome.status] ?? STATUS_CONFIG["proposed"];
                const draftStatus = outcome.planningDrafts[0]?.status;

                return (
                  <Link
                    key={outcome.id}
                    href={`/work/outcomes/${outcome.id}`}
                    className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-200 truncate">
                          {outcome.title}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-600">
                        <span className={cn("font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        {draftStatus && DRAFT_STATUS_LABELS[draftStatus] && (
                          <span> · {DRAFT_STATUS_LABELS[draftStatus]}</span>
                        )}
                        {outcome._count.tasks > 0 && (
                          <span> · {outcome._count.tasks} tasks</span>
                        )}
                        {outcome.repository && (
                          <span className="inline-flex items-center gap-1">
                            {" "}·{" "}
                            <GitBranch className="h-3 w-3 text-neutral-700" />
                            {outcome.repository.name}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[10px] capitalize text-neutral-600">
                        {outcome.priority}
                      </span>
                      <span className="text-[10px] text-neutral-700">
                        {new Date(outcome.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-neutral-200",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}
