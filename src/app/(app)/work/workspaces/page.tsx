import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft, Boxes, Plus, ChevronRight, Layers, FolderGit2 } from "lucide-react";
import Link from "next/link";
import { listWorkspacesWithCounts } from "@/lib/workspace-service";
import { workspaceBadgeClasses } from "@/lib/workspace-badge";
import { cn } from "@/lib/utils";

export default async function WorkspacesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const workspaces = await listWorkspacesWithCounts(company.id);

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
          <h1 className="text-sm font-semibold text-neutral-100">Workspaces</h1>
        </div>
        <Link
          href="/work/workspaces/new"
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New workspace
        </Link>
      </header>

      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-neutral-500">
          A workspace groups related repositories and the projects that build
          them — e.g. a product, system, or area.
        </p>

        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-16 text-center">
            <Boxes className="h-6 w-6 text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">
                No workspaces yet
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Create a workspace to group your repositories and projects.
              </p>
            </div>
            <Link
              href="/work/workspaces/new"
              className="mt-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              New workspace
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/work/workspaces/${ws.id}`}
                className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    workspaceBadgeClasses(ws.id)
                  )}
                >
                  <Boxes className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-200 truncate">
                    {ws.name}
                  </p>
                  {ws.description && (
                    <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">
                      {ws.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {ws.projectCount}{" "}
                      {ws.projectCount === 1 ? "project" : "projects"}
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderGit2 className="h-3 w-3" />
                      {ws.repoCount} {ws.repoCount === 1 ? "repo" : "repos"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
