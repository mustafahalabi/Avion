import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ReviewVerdictForm } from "./review-verdict-form";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending Review", color: "text-neutral-400", icon: Clock },
  approved: { label: "Approved", color: "text-emerald-400", icon: CheckCircle2 },
  changes_requested: {
    label: "Changes Requested",
    color: "text-amber-400",
    icon: AlertCircle,
  },
  in_progress: { label: "In Progress", color: "text-blue-400", icon: Clock },
};

export default async function ReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const review = await prisma.review.findFirst({
    where: { id, companyId: company.id },
    include: {
      changeRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!review) notFound();

  const cfg = STATUS_CONFIG[review.status] ?? STATUS_CONFIG["pending"];
  const Icon = cfg.icon;
  const isTerminal = ["approved"].includes(review.status);

  // Try to find the linked task if entityType is "task"
  const task =
    review.entityType === "task"
      ? await prisma.task.findUnique({
          where: { id: review.entityId },
          select: { id: true, title: true, status: true },
        })
      : null;

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
          {review.title}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-2xl">
        {/* Status header */}
        <section className="flex items-start gap-3">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
          <div>
            <p className={cn("text-sm font-semibold", cfg.color)}>
              {cfg.label}
            </p>
            <p className="mt-0.5 text-xs text-neutral-600 capitalize">
              {review.entityType} review
              {review.reviewerId && ` · Reviewer: ${review.reviewerId}`}
            </p>
          </div>
        </section>

        {/* Linked entity */}
        {task && (
          <section>
            <SectionLabel>Linked Task</SectionLabel>
            <Link
              href={`/work/tasks/${task.id}`}
              className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 transition-colors hover:border-neutral-700"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
              <p className="flex-1 text-sm text-neutral-300 truncate">
                {task.title}
              </p>
              <span className="text-xs capitalize text-neutral-600">
                {task.status}
              </span>
            </Link>
          </section>
        )}

        {/* Verdict/notes */}
        {review.notes && (
          <section
            className={cn(
              "rounded-lg border px-4 py-3",
              review.status === "approved"
                ? "border-emerald-900/40 bg-emerald-950/10"
                : "border-amber-900/40 bg-amber-950/10"
            )}
          >
            <SectionLabel>Review Notes</SectionLabel>
            <p className="mt-2 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {review.notes}
            </p>
          </section>
        )}

        {/* Open change requests */}
        {review.changeRequests.filter((cr) => !cr.resolved).length > 0 && (
          <section>
            <SectionLabel>
              Open Change Requests ({review.changeRequests.filter((cr) => !cr.resolved).length})
            </SectionLabel>
            <div className="mt-2 flex flex-col gap-2">
              {review.changeRequests
                .filter((cr) => !cr.resolved)
                .map((cr) => (
                  <div
                    key={cr.id}
                    className="rounded-lg border border-amber-900/30 bg-amber-950/10 px-3.5 py-3"
                  >
                    <p className="text-sm text-amber-200 leading-relaxed">
                      {cr.reason}
                    </p>
                    {cr.requestedBy && (
                      <p className="mt-1 text-xs text-neutral-600">
                        Requested by {cr.requestedBy} ·{" "}
                        {new Date(cr.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Verdict form */}
        {!isTerminal && (
          <section>
            <SectionLabel>Submit Verdict</SectionLabel>
            <ReviewVerdictForm reviewId={review.id} />
          </section>
        )}

        {/* Resolved change requests */}
        {review.changeRequests.filter((cr) => cr.resolved).length > 0 && (
          <section>
            <SectionLabel>Resolved Changes</SectionLabel>
            <div className="mt-2 flex flex-col gap-1">
              {review.changeRequests
                .filter((cr) => cr.resolved)
                .map((cr) => (
                  <div
                    key={cr.id}
                    className="flex items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2.5"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <p className="text-xs text-neutral-600">{cr.reason}</p>
                  </div>
                ))}
            </div>
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
