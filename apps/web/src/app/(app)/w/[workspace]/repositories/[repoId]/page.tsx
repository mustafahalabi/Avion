import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getLatestRepositoryChangeIntelligence } from "@/lib/repository-change-intelligence";
import { getRepositoryIntelligenceView } from "@/lib/repository-intelligence-service";
import { getRepositoryValidationView } from "@/lib/repository-validation-service";
import { analyzeRepositoryFromGitHub } from "@/app/actions/repository";
import { RepositoryIntelligenceDashboard } from "@/components/repositories/repository-intelligence-dashboard";
import { RepositoryValidationPanel } from "@/components/repositories/repository-validation-panel";
import {
  RepositoryTabs,
  type RepositoryTab,
} from "@/app/(app)/work/repositories/[id]/repository-tabs";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  GitBranch,
  GitCompareArrows,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  LayoutGrid,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ workspace: string; repoId: string }>;
}

const ANALYSIS_COLORS: Record<string, string> = {
  complete: "bg-emerald-950 text-emerald-400 border-emerald-900",
  pending: "bg-neutral-900 text-neutral-500 border-neutral-700",
  analyzing: "bg-blue-950 text-blue-400 border-blue-900",
  failed: "bg-red-950 text-red-400 border-red-900",
};

const IMPACT_COLORS: Record<string, string> = {
  none: "bg-neutral-900 text-neutral-500 border-neutral-700",
  low: "bg-emerald-950 text-emerald-400 border-emerald-900",
  medium: "bg-amber-950 text-amber-400 border-amber-900",
  high: "bg-orange-950 text-orange-400 border-orange-900",
  critical: "bg-red-950 text-red-400 border-red-900",
};

function formatSnapshotDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function WorkspaceRepositoryDetailPage({ params }: Props) {
  const { workspace: slug, repoId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const workspace = await prisma.workspace.findFirst({
    where: { slug, companyId: company.id },
  });
  if (!workspace) notFound();

  const repo = await prisma.repository.findFirst({
    where: { id: repoId, workspaceId: workspace.id },
  });
  if (!repo) notFound();

  const changeIntelligence = await getLatestRepositoryChangeIntelligence({
    repositoryId: repo.id,
    companyId: company.id,
  });
  const intelligenceView = await getRepositoryIntelligenceView({
    repositoryId: repo.id,
    companyId: company.id,
  });
  const validationView = await getRepositoryValidationView({
    repositoryId: repo.id,
    companyId: company.id,
  });
  const comparison = changeIntelligence.comparison;
  const impact = changeIntelligence.impact;
  const comparisonResult = comparison && !("error" in comparison) ? comparison : null;
  const comparisonError = comparison && "error" in comparison ? comparison : null;
  const impactResult = impact && !("error" in impact) ? impact : null;
  const impactError = impact && "error" in impact ? impact : null;

  async function runAnalysis(formData: FormData) {
    "use server";

    await analyzeRepositoryFromGitHub(undefined, formData);
    revalidatePath(`/w/${slug}/repositories/${repoId}`);
  }

  const techStack: string[] = JSON.parse(repo.techStack || "[]");
  const frameworks: string[] = JSON.parse(repo.frameworks || "[]");
  const dependencies: string[] = JSON.parse(repo.dependencies || "[]");
  const importantFiles: string[] = JSON.parse(repo.importantFiles || "[]");

  const StatusIcon = repo.analysisStatus === "complete" ? CheckCircle2 : Clock;

  const hasNoIntelligence =
    techStack.length === 0 &&
    frameworks.length === 0 &&
    dependencies.length === 0;

  // ── Tab content (server-rendered; handed to the client tab shell) ──────────

  const overviewContent = (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {repo.primaryLanguage && (
          <DetailCard label="Primary Language" value={repo.primaryLanguage} />
        )}
        {repo.fileCount != null && (
          <DetailCard label="File Count" value={repo.fileCount.toString()} />
        )}
        <DetailCard
          label="Analysis"
          value={repo.analysisStatus === "complete" ? "Complete" : "Pending"}
        />
      </section>

      {techStack.length > 0 && (
        <TagSection title="Tech Stack" tags={techStack} />
      )}
      {frameworks.length > 0 && (
        <TagSection title="Frameworks & Libraries" tags={frameworks} />
      )}
      {dependencies.length > 0 && (
        <TagSection title="Key Dependencies" tags={dependencies} />
      )}

      {importantFiles.length > 0 && (
        <section>
          <SectionLabel>Important Files</SectionLabel>
          <div className="mt-3 flex flex-col gap-1.5">
            {importantFiles.map((file) => (
              <div
                key={file}
                className="flex items-center gap-2.5 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2"
              >
                <FileCode className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <span className="text-xs font-mono text-neutral-300">
                  {file}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasNoIntelligence && (
        <div className="rounded-lg border border-dashed border-neutral-800 py-8 text-center">
          <p className="text-sm text-neutral-500">No intelligence data yet.</p>
          <p className="mt-0.5 text-xs text-neutral-700">
            Run an analysis or edit the repository to add tech stack, frameworks,
            and dependencies.
          </p>
        </div>
      )}
    </div>
  );

  const changesContent = (
    <div className="flex flex-col gap-3">
      {repo.analysisNotes && (
        <section className="mb-2">
          <SectionLabel>Analysis Notes</SectionLabel>
          <p className="mt-2 text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">
            {repo.analysisNotes}
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Repository Change Intelligence</SectionLabel>
        <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] font-medium text-neutral-400">
          {changeIntelligence.snapshotCount} snapshots
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DetailCard
          label="Latest Snapshot"
          value={
            changeIntelligence.latestSnapshot
              ? `${changeIntelligence.latestSnapshot.status} · ${formatSnapshotDate(
                  changeIntelligence.latestSnapshot.createdAt
                )}`
              : "No snapshots"
          }
        />
        <DetailCard
          label="Comparison"
          value={
            comparisonResult
              ? comparisonResult.hasChanges
                ? "Changes detected"
                : "No changes"
              : comparisonError
                ? "Comparison failed"
                : "Needs two snapshots"
          }
        />
        <DetailCard
          label="Impact"
          value={impactResult ? impactResult.overallImpactLevel : "Unavailable"}
        />
      </div>

      <form
        action={runAnalysis}
        className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
      >
        <input type="hidden" name="repositoryId" value={repo.id} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Analyze repository
            </p>
            <p className="mt-1 truncate text-xs text-neutral-500">
              {repo.url
                ? `Clones ${repo.url} and analyzes its code.`
                : "Add a repository URL to enable analysis."}
            </p>
          </div>
          <button
            type="submit"
            disabled={!repo.url}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-4 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Analyze
          </button>
        </div>
      </form>

      {comparisonResult && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-start gap-3">
            <GitCompareArrows className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-200">
                {comparisonResult.summary}
              </p>
              {comparisonResult.affectedAreas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {comparisonResult.affectedAreas.map((area) => (
                    <span
                      key={area}
                      className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-400"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ChangeCount label="Files" value={comparisonResult.changeCounts.addedImportantFiles + comparisonResult.changeCounts.removedImportantFiles + comparisonResult.changeCounts.changedFiles} />
                <ChangeCount label="Routes" value={comparisonResult.changeCounts.addedRoutes + comparisonResult.changeCounts.removedRoutes + comparisonResult.changeCounts.changedRoutes} />
                <ChangeCount label="Risks" value={comparisonResult.changeCounts.newRisks + comparisonResult.changeCounts.resolvedRisks} />
              </div>
            </div>
          </div>
        </div>
      )}

      {comparisonError && (
        <InlineNotice icon="compare" tone="warning" title="Comparison unavailable">
          {comparisonError.reason}
        </InlineNotice>
      )}

      {impactResult && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <div>
                <p className="text-sm font-medium text-neutral-200">
                  {impactResult.summary}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Confidence: {impactResult.confidence}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-[11px] font-medium",
                IMPACT_COLORS[impactResult.overallImpactLevel] ?? IMPACT_COLORS.none
              )}
            >
              {impactResult.overallImpactLevel}
            </span>
          </div>

          {impactResult.affectedRoles.length > 0 && (
            <TagBlock title="Who should care" tags={impactResult.affectedRoles} />
          )}
          {impactResult.qaFocusAreas.length > 0 && (
            <TagBlock title="QA focus" tags={impactResult.qaFocusAreas} />
          )}
          {impactResult.recommendedActions.length > 0 && (
            <ListBlock
              title="Recommended Actions"
              items={impactResult.recommendedActions.map((action) => action.action)}
            />
          )}
          {impactResult.evidence.length > 0 && (
            <ListBlock title="Evidence" items={impactResult.evidence.slice(0, 8)} mono />
          )}
          {impactResult.releaseRisks.length > 0 && (
            <ListBlock title="Release Risks" items={impactResult.releaseRisks} />
          )}
        </div>
      )}

      {impactError && (
        <InlineNotice icon="impact" tone="warning" title="Impact unavailable">
          {impactError.reason}
        </InlineNotice>
      )}
    </div>
  );

  const tabIconClass = "h-3.5 w-3.5";
  const tabs: RepositoryTab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutGrid className={tabIconClass} />,
      content: overviewContent,
    },
  ];
  if (intelligenceView) {
    tabs.push({
      id: "intelligence",
      label: "Intelligence",
      icon: <Sparkles className={tabIconClass} />,
      content: <RepositoryIntelligenceDashboard intelligence={intelligenceView} />,
    });
  }
  if (validationView) {
    tabs.push({
      id: "validation",
      label: "Validation",
      icon: <ShieldCheck className={tabIconClass} />,
      content: <RepositoryValidationPanel assessment={validationView} />,
    });
  }
  tabs.push({
    id: "changes",
    label: "Changes & Analysis",
    icon: <GitCompareArrows className={tabIconClass} />,
    content: changesContent,
  });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <Breadcrumbs
          items={[
            { label: workspace.name, href: `/w/${workspace.slug}` },
            {
              label: "Repositories",
              href: `/w/${workspace.slug}/repositories`,
            },
            { label: repo.name },
          ]}
        />
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Header */}
        <section className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800">
            <GitBranch className="h-5 w-5 text-neutral-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-100">
                {repo.name}
              </h2>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  ANALYSIS_COLORS[repo.analysisStatus] ??
                    ANALYSIS_COLORS["pending"]
                )}
              >
                <StatusIcon className="h-2.5 w-2.5" />
                {repo.analysisStatus}
              </span>
            </div>
            {repo.description && (
              <p className="mt-1 text-sm text-neutral-400">{repo.description}</p>
            )}
            {repo.url && (
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {repo.url}
              </a>
            )}
          </div>
        </section>

        <RepositoryTabs tabs={tabs} />
      </div>
    </div>
  );
}

function ChangeCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-neutral-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-200">{value}</p>
    </div>
  );
}

function TagBlock({ title, tags }: { title: string; tags: readonly string[] }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-400"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListBlock({
  title,
  items,
  mono = false,
}: {
  title: string;
  items: readonly string[];
  mono?: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item}
            className={cn(
              "rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs leading-relaxed text-neutral-400",
              mono && "font-mono"
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineNotice({
  icon,
  tone,
  title,
  children,
}: {
  icon: "compare" | "impact";
  tone: "warning";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = icon === "compare" ? Route : AlertTriangle;

  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-3 rounded-lg border p-4",
        tone === "warning" && "border-amber-900 bg-amber-950/40"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div>
        <p className="text-sm font-medium text-amber-200">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-300/80">{children}</p>
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-neutral-200 truncate">
        {value}
      </p>
    </div>
  );
}

function TagSection({ title, tags }: { title: string; tags: string[] }) {
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
