import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  GitBranch,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

const ANALYSIS_COLORS: Record<string, string> = {
  complete: "bg-emerald-950 text-emerald-400 border-emerald-900",
  pending: "bg-neutral-900 text-neutral-500 border-neutral-700",
  analyzing: "bg-blue-950 text-blue-400 border-blue-900",
  failed: "bg-red-950 text-red-400 border-red-900",
};

export default async function RepositoryDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    include: { workspaces: { select: { id: true } } },
  });
  if (!company) redirect("/onboarding");

  const workspaceIds = company.workspaces.map((w) => w.id);
  const repo = await prisma.repository.findFirst({
    where: { id, workspaceId: { in: workspaceIds } },
  });

  if (!repo) notFound();

  const techStack: string[] = JSON.parse(repo.techStack || "[]");
  const frameworks: string[] = JSON.parse(repo.frameworks || "[]");
  const dependencies: string[] = JSON.parse(repo.dependencies || "[]");
  const importantFiles: string[] = JSON.parse(repo.importantFiles || "[]");

  const StatusIcon = repo.analysisStatus === "complete" ? CheckCircle2 : Clock;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/repositories"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Repositories
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {repo.name}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-3xl">
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

        {/* Tech summary */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {repo.primaryLanguage && (
            <DetailCard label="Primary Language" value={repo.primaryLanguage} />
          )}
          {repo.fileCount != null && (
            <DetailCard label="File Count" value={repo.fileCount.toString()} />
          )}
          <DetailCard
            label="Analysis"
            value={
              repo.analysisStatus === "complete" ? "Complete" : "Pending"
            }
          />
        </section>

        {/* Tech stack */}
        {techStack.length > 0 && (
          <TagSection title="Tech Stack" tags={techStack} />
        )}

        {/* Frameworks */}
        {frameworks.length > 0 && (
          <TagSection title="Frameworks & Libraries" tags={frameworks} />
        )}

        {/* Dependencies */}
        {dependencies.length > 0 && (
          <TagSection title="Key Dependencies" tags={dependencies} />
        )}

        {/* Important files */}
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

        {/* Analysis notes */}
        {repo.analysisNotes && (
          <section>
            <SectionLabel>Analysis Notes</SectionLabel>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">
              {repo.analysisNotes}
            </p>
          </section>
        )}

        {/* Empty state */}
        {techStack.length === 0 &&
          frameworks.length === 0 &&
          dependencies.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-800 py-8 text-center">
              <p className="text-sm text-neutral-500">
                No intelligence data yet.
              </p>
              <p className="mt-0.5 text-xs text-neutral-700">
                Edit the repository to add tech stack, frameworks, and
                dependencies.
              </p>
            </div>
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
