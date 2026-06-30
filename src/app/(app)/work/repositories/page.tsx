import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft, GitBranch, Plus, ChevronRight, CheckCircle2, Clock, Boxes } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { workspaceBadgeClasses } from "@/lib/workspace-badge";

const ANALYSIS_COLORS: Record<string, string> = {
  complete: "bg-emerald-950 text-emerald-400 border-emerald-900",
  pending: "bg-neutral-900 text-neutral-500 border-neutral-700",
  analyzing: "bg-blue-950 text-blue-400 border-blue-900",
  failed: "bg-red-950 text-red-400 border-red-900",
};

export default async function RepositoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: {
      workspaces: {
        include: {
          repositories: { orderBy: { updatedAt: "desc" } },
        },
      },
    },
  });

  if (!company) redirect("/onboarding");

  // Carry each repo's workspace down so rows can show a workspace badge.
  const repositories = company.workspaces.flatMap((w) =>
    w.repositories.map((r) => ({
      ...r,
      workspaceId: w.id,
      workspaceName: w.name,
    }))
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/work"
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Work
          </Link>
          <span className="text-neutral-700">/</span>
          <h1 className="text-sm font-semibold text-neutral-100">
            Repositories
          </h1>
        </div>
        <Link
          href="/work/repositories/new"
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add repository
        </Link>
      </header>

      <div className="flex flex-col gap-4 p-6">
        {repositories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-16 text-center">
            <GitBranch className="h-6 w-6 text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">
                No repositories
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Add a repository to start tracking your codebase.
              </p>
            </div>
            <Link
              href="/work/repositories/new"
              className="mt-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Add repository
            </Link>
          </div>
        ) : (
          repositories.map((repo) => {
            const techStack: string[] = JSON.parse(repo.techStack || "[]");
            const StatusIcon =
              repo.analysisStatus === "complete" ? CheckCircle2 : Clock;
            return (
              <Link
                key={repo.id}
                href={`/work/repositories/${repo.id}`}
                className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800">
                  <GitBranch className="h-4 w-4 text-neutral-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-200">
                      {repo.name}
                    </p>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        ANALYSIS_COLORS[repo.analysisStatus] ??
                          ANALYSIS_COLORS["pending"]
                      )}
                    >
                      <StatusIcon className="h-2.5 w-2.5" />
                      {repo.analysisStatus}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        workspaceBadgeClasses(repo.workspaceId)
                      )}
                    >
                      <Boxes className="h-2.5 w-2.5" />
                      {repo.workspaceName}
                    </span>
                  </div>
                  {repo.description && (
                    <p className="mt-0.5 text-xs text-neutral-500 truncate">
                      {repo.description}
                    </p>
                  )}
                  {techStack.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {techStack.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 border border-neutral-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
