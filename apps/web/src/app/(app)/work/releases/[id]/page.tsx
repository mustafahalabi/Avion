import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Rocket,
  FileText,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ReleaseChecklist } from "./release-checklist";
import { ReleaseNotesForm } from "./release-notes-form";
import { ReleaseButton } from "./release-button";
import { ReleaseTasksSection } from "./release-tasks-section";
import { CeoReleaseSummaryPanel } from "./ceo-release-summary-panel";
import { getCeoReleaseSummary } from "@/lib/release-summary-service";
import { ReleaseCandidateEvidence } from "./release-candidate-evidence";
import { parseReleaseCandidateMetadata } from "@/lib/release-candidate-service";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: "Draft", color: "text-neutral-500", icon: Circle },
  ready: { label: "Ready to Release", color: "text-emerald-400", icon: CheckCircle2 },
  released: { label: "Released", color: "text-emerald-400", icon: Rocket },
  cancelled: { label: "Cancelled", color: "text-neutral-700", icon: Circle },
  blocked: { label: "Blocked", color: "text-red-400", icon: AlertCircle },
};

const DEPLOY_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "text-neutral-600" },
  in_progress: { label: "Deploying…", color: "text-blue-400" },
  deployed: { label: "Deployed", color: "text-emerald-400" },
  failed: { label: "Failed", color: "text-red-400" },
  rolled_back: { label: "Rolled back", color: "text-amber-400" },
};

export default async function ReleaseDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const release = await prisma.release.findFirst({
    where: { id, companyId: company.id },
  });
  if (!release) notFound();

  let releaseTaskIds: string[] = [];
  try { releaseTaskIds = JSON.parse(release.taskIds); } catch { releaseTaskIds = []; }

  const [releasedTasks, availableTasks] = await Promise.all([
    releaseTaskIds.length > 0
      ? prisma.task.findMany({
          where: { id: { in: releaseTaskIds }, companyId: company.id },
          select: { id: true, title: true, status: true, priority: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: {
        companyId: company.id,
        id: { notIn: releaseTaskIds },
        status: { in: ["done", "in-review"] },
      },
      select: { id: true, title: true, status: true, priority: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const cfg = STATUS_CONFIG[release.status] ?? STATUS_CONFIG["draft"];
  const StatusIcon = cfg.icon;
  const deployInfo = DEPLOY_LABELS[release.deploymentStatus] ?? DEPLOY_LABELS["not_started"];
  const isReleased = release.status === "released";

  let checklist: { id: string; label: string; checked: boolean }[] = [];
  try {
    checklist = JSON.parse(release.checklist);
  } catch {}

  const readyCount = checklist.filter((c) => c.checked).length;
  const allReady = readyCount === checklist.length && checklist.length > 0;
  const candidateMetadata = parseReleaseCandidateMetadata(release.description);

  const ceoSummary = await getCeoReleaseSummary(company.id, release.id);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/releases"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Releases
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-xs font-mono font-semibold text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
          {release.version}
        </span>
        {release.title && (
          <>
            <span className="text-neutral-700">/</span>
            <h1 className="text-sm font-semibold text-neutral-100 truncate">
              {release.title}
            </h1>
          </>
        )}
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Status */}
        <section className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusIcon className={cn("h-4 w-4 shrink-0", cfg.color)} />
            <div>
              <p className={cn("text-sm font-semibold", cfg.color)}>
                {cfg.label}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Deployment: <span className={deployInfo.color}>{deployInfo.label}</span>
                {release.releasedAt && (
                  <span className="ml-2 text-neutral-700">
                    ·{" "}
                    {new Date(release.releasedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
          {!isReleased && allReady && (
            <ReleaseButton releaseId={release.id} />
          )}
        </section>

        {/* Description / candidate evidence */}
        {candidateMetadata ? (
          <ReleaseCandidateEvidence description={release.description} />
        ) : release.description ? (
          <section>
            <SectionLabel>Description</SectionLabel>
            <p className="mt-2 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {release.description}
            </p>
          </section>
        ) : null}

        {/* Readiness checklist */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>
              <ShieldCheck className="inline-block h-3.5 w-3.5 mr-1.5 mb-0.5" />
              Release Readiness ({readyCount}/{checklist.length})
            </SectionLabel>
            {allReady && (
              <span className="text-xs font-medium text-emerald-400">
                All checks passed
              </span>
            )}
          </div>
          {!isReleased ? (
            <ReleaseChecklist
              releaseId={release.id}
              initialChecklist={checklist}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="text-sm text-neutral-500">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tasks in this release */}
        {!isReleased && (
          <section>
            <ReleaseTasksSection
              releaseId={release.id}
              releasedTasks={releasedTasks}
              availableTasks={availableTasks}
            />
          </section>
        )}
        {isReleased && releasedTasks.length > 0 && (
          <section>
            <SectionLabel>Tasks Included</SectionLabel>
            <div className="mt-2 flex flex-col gap-1">
              {releasedTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="flex-1 text-sm text-neutral-300 truncate">{t.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CEO release summary */}
        {ceoSummary && (
          <CeoReleaseSummaryPanel markdown={ceoSummary.markdown} />
        )}

        {/* Release notes */}
        <section>
          <SectionLabel>
            <FileText className="inline-block h-3.5 w-3.5 mr-1.5 mb-0.5" />
            Release Notes
          </SectionLabel>
          {!isReleased ? (
            <ReleaseNotesForm
              releaseId={release.id}
              initialNotes={release.releaseNotes ?? ""}
              initialRollback={release.rollbackPlan ?? ""}
            />
          ) : (
            <div className="mt-2 flex flex-col gap-4">
              {release.releaseNotes ? (
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {release.releaseNotes}
                </p>
              ) : (
                <p className="text-sm text-neutral-600">No release notes.</p>
              )}
            </div>
          )}
        </section>

        {/* Rollback plan */}
        {release.rollbackPlan && (
          <section className="rounded-lg border border-amber-900/30 bg-amber-950/10 px-4 py-3">
            <SectionLabel>Rollback Plan</SectionLabel>
            <p className="mt-2 text-sm text-amber-200 leading-relaxed whitespace-pre-wrap">
              {release.rollbackPlan}
            </p>
          </section>
        )}

        {/* Post-release */}
        {isReleased && (
          <section className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-4 py-3">
            <SectionLabel>Post-Release</SectionLabel>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
              {release.postReleaseNotes ?? "Monitor application health and error rates for 24 hours following release."}
            </p>
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
