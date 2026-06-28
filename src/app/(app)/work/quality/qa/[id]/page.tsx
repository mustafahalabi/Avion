import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { requiredChecksPassed } from "@/lib/qa-service";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QaVerdictForm } from "./qa-verdict-form";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending QA", color: "text-neutral-400", icon: Clock },
  passed: { label: "Passed", color: "text-emerald-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", icon: AlertCircle },
  blocked: { label: "Blocked", color: "text-amber-400", icon: XCircle },
  needs_clarification: {
    label: "Needs Clarification",
    color: "text-blue-400",
    icon: Clock,
  },
};

interface StoredCheck {
  label: string;
  passed: boolean;
  category?: string;
}

export default async function QaDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const qa = await prisma.qAResult.findFirst({
    where: { id, companyId: company.id },
  });
  if (!qa) notFound();

  const cfg = STATUS_CONFIG[qa.status] ?? STATUS_CONFIG["pending"];
  const Icon = cfg.icon;
  const isTerminal = ["passed", "failed", "blocked"].includes(qa.status);

  let parsedChecks: StoredCheck[] = [];
  try {
    parsedChecks = JSON.parse(qa.checks ?? "[]") as StoredCheck[];
  } catch {
    parsedChecks = [];
  }

  const allChecksPassed = requiredChecksPassed(qa.checks);
  const total = qa.passedCount + qa.failedCount;

  const task =
    qa.entityType === "task"
      ? await prisma.task.findUnique({
          where: { id: qa.entityId },
          select: { id: true, title: true, status: true },
        })
      : null;

  const approvedReview =
    task &&
    (await prisma.review.findFirst({
      where: {
        companyId: company.id,
        entityType: "task",
        entityId: task.id,
        status: "approved",
      },
      select: { id: true, title: true },
    }));

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/quality"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quality
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          QA Result
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-2xl">
        <section className="flex items-start gap-3">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
          <div>
            <p className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</p>
            <p className="mt-0.5 text-xs text-neutral-600 capitalize">
              {qa.entityType} QA
              {total > 0 && ` · ${qa.passedCount}/${total} checks passed`}
            </p>
          </div>
        </section>

        {task && (
          <section>
            <SectionLabel>Linked Task</SectionLabel>
            <Link
              href={`/work/tasks/${task.id}`}
              className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 transition-colors hover:border-neutral-700"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
              <p className="flex-1 text-sm text-neutral-300 truncate">{task.title}</p>
              <span className="text-xs capitalize text-neutral-600">{task.status}</span>
            </Link>
          </section>
        )}

        {approvedReview && (
          <section>
            <SectionLabel>Review Gate</SectionLabel>
            <Link
              href={`/work/quality/${approvedReview.id}`}
              className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3.5 py-2.5 transition-colors hover:border-emerald-800/50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <p className="flex-1 text-sm text-emerald-200 truncate">
                {approvedReview.title}
              </p>
              <span className="text-xs text-emerald-600">Approved</span>
            </Link>
          </section>
        )}

        {!approvedReview && task && !isTerminal && (
          <section className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-4 py-3">
            <p className="text-sm text-amber-200">
              QA cannot pass until the linked task has an approved review.
            </p>
          </section>
        )}

        {parsedChecks.length > 0 && (
          <section>
            <SectionLabel>Checklist</SectionLabel>
            <div className="mt-2 flex flex-col gap-1.5">
              {parsedChecks.map((check, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3.5 py-3",
                    check.passed
                      ? "border-emerald-900/30 bg-emerald-950/10"
                      : "border-red-900/30 bg-red-950/10"
                  )}
                >
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
                  <p className="text-sm text-neutral-300 leading-relaxed">{check.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {qa.notes && (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3">
            <SectionLabel>QA Notes</SectionLabel>
            <p className="mt-2 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {qa.notes}
            </p>
          </section>
        )}

        {!isTerminal && (
          <section>
            <SectionLabel>Submit QA Result</SectionLabel>
            <QaVerdictForm qaResultId={qa.id} allChecksPassed={allChecksPassed} />
          </section>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </h3>
  );
}
