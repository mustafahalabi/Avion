import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const REVIEW_STATUS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending", color: "text-neutral-500", icon: Clock },
  approved: { label: "Approved", color: "text-emerald-400", icon: CheckCircle2 },
  changes_requested: {
    label: "Changes Requested",
    color: "text-amber-400",
    icon: AlertCircle,
  },
  in_progress: { label: "In Progress", color: "text-blue-400", icon: Clock },
};

const QA_STATUS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending", color: "text-neutral-500", icon: Clock },
  passed: { label: "Passed", color: "text-emerald-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", icon: XCircle },
  blocked: { label: "Blocked", color: "text-amber-400", icon: AlertCircle },
  needs_clarification: { label: "Needs Clarification", color: "text-blue-400", icon: Clock },
  in_progress: { label: "In Progress", color: "text-blue-400", icon: Clock },
};

export default async function QualityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const [reviews, qaResults] = await Promise.all([
    prisma.review.findMany({
      where: { companyId: company.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { changeRequests: { where: { resolved: false } } },
    }),
    prisma.qAResult.findMany({
      where: { companyId: company.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  // Resolve real task titles for the QA rows so they read "Login screen"
  // instead of an opaque "Task 3f9a2b1c".
  const qaTaskIds = qaResults
    .filter((q) => q.entityType === "task")
    .map((q) => q.entityId);
  const qaTasks = qaTaskIds.length
    ? await prisma.task.findMany({
        where: { companyId: company.id, id: { in: qaTaskIds } },
        select: { id: true, title: true },
      })
    : [];
  const taskTitleById = new Map(qaTasks.map((t) => [t.id, t.title]));

  const reviewStats = {
    total: reviews.length,
    pending: reviews.filter((r) => r.status === "pending").length,
    approved: reviews.filter((r) => r.status === "approved").length,
    changesRequested: reviews.filter((r) => r.status === "changes_requested").length,
  };

  const qaStats = {
    total: qaResults.length,
    passed: qaResults.filter((q) => q.status === "passed").length,
    failed: qaResults.filter((q) => q.status === "failed").length,
    pending: qaResults.filter((q) => q.status === "pending").length,
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
          <h1 className="text-sm font-semibold text-neutral-100">Quality</h1>
        </div>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Reviews" value={reviewStats.total} />
          <MiniStat label="Approved" value={reviewStats.approved} color="text-emerald-400" />
          <MiniStat label="Changes" value={reviewStats.changesRequested} color={reviewStats.changesRequested > 0 ? "text-amber-400" : "text-neutral-400"} />
          <MiniStat label="QA Passed" value={qaStats.passed} color="text-emerald-400" />
        </section>

        {/* Reviews */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">Reviews</h3>
          </div>

          {reviews.length === 0 ? (
            <EmptyQuality
              title="No reviews yet"
              body="Reviews are created from task detail pages when work is ready for review."
              icon={<ShieldCheck className="h-5 w-5 text-neutral-700" />}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {reviews.map((review) => {
                const cfg = REVIEW_STATUS[review.status] ?? REVIEW_STATUS["pending"];
                const Icon = cfg.icon;
                const hasOpenChanges = review.changeRequests.length > 0;

                return (
                  <Link
                    key={review.id}
                    href={`/work/quality/${review.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">
                        {review.title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        <span className={cn("font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        <span className="capitalize"> · {review.entityType}</span>
                        {hasOpenChanges && (
                          <span className="text-amber-600">
                            {" "}· {review.changeRequests.length} open change{review.changeRequests.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* QA Results */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">QA Results</h3>
          </div>

          {qaResults.length === 0 ? (
            <EmptyQuality
              title="No QA results yet"
              body="QA results are created from task detail pages when work moves to validation."
              icon={<CheckCircle2 className="h-5 w-5 text-neutral-700" />}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {qaResults.map((qa) => {
                const cfg = QA_STATUS[qa.status] ?? QA_STATUS["pending"];
                const Icon = cfg.icon;
                const total = qa.passedCount + qa.failedCount;

                return (
                  <Link
                    key={qa.id}
                    href={`/work/quality/qa/${qa.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">
                        {taskTitleById.get(qa.entityId) ?? (
                          <>
                            QA · <span className="capitalize">{qa.entityType}</span>{" "}
                            <span className="font-mono text-xs text-neutral-600">
                              {qa.entityId.slice(0, 8)}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        <span className={cn("font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        {total > 0 && (
                          <span>
                            {" "}· {qa.passedCount}/{total} checks passed
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniStat({
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

function EmptyQuality({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-10 text-center">
      {icon}
      <div>
        <p className="text-sm font-medium text-neutral-500">{title}</p>
        <p className="mt-0.5 text-xs text-neutral-700 max-w-xs">{body}</p>
      </div>
    </div>
  );
}
