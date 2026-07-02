import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import {
  Boxes,
  Plus,
  ChevronRight,
  Layers,
  FolderGit2,
} from "lucide-react";
import Link from "next/link";
import { workspaceBadgeClasses } from "@/lib/workspace-badge";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ workspace: string }>;
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-950 text-emerald-400 border-emerald-900",
  planning: "bg-blue-950 text-blue-400 border-blue-900",
  paused: "bg-amber-950 text-amber-400 border-amber-900",
  done: "bg-neutral-900 text-neutral-500 border-neutral-700",
  cancelled: "bg-neutral-900 text-neutral-600 border-neutral-800",
};

export default async function WorkspaceHubPage({ params }: Props) {
  const { workspace: slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const workspace = await prisma.workspace.findFirst({
    where: { slug, companyId: company.id },
    include: {
      repositories: { orderBy: { updatedAt: "desc" } },
      projects: {
        orderBy: { updatedAt: "desc" },
        include: {
          repository: { select: { id: true, name: true } },
          features: { include: { tasks: { select: { status: true } } } },
          tasks: { select: { status: true } },
        },
      },
    },
  });
  if (!workspace) notFound();

  const accent = workspaceBadgeClasses(workspace.id);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <Breadcrumbs items={[{ label: workspace.name }]} />
        <Link
          href={`/w/${workspace.slug}/repositories`}
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          <FolderGit2 className="h-3.5 w-3.5" />
          All repositories
        </Link>
      </header>

      <div className="flex flex-col gap-8 p-6">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              accent
            )}
          >
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-100">
              {workspace.name}
            </h2>
            {workspace.description && (
              <p className="mt-1 text-sm text-neutral-500">
                {workspace.description}
              </p>
            )}
          </div>
        </div>

        {/* Repositories */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <FolderGit2 className="h-4 w-4 text-neutral-500" />
              Repositories
              <span className="text-xs font-normal text-neutral-600">
                {workspace.repositories.length}
              </span>
            </h3>
            <Link
              href={`/work/repositories/new?workspace=${workspace.id}`}
              className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add repository
            </Link>
          </div>
          {workspace.repositories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-6 text-center text-xs text-neutral-600">
              No repositories in this workspace yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {workspace.repositories.map((repo) => (
                <Link
                  key={repo.id}
                  href={`/w/${workspace.slug}/repositories/${repo.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                >
                  <FolderGit2 className="h-4 w-4 shrink-0 text-neutral-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-200">
                      {repo.name}
                    </p>
                    {repo.url && (
                      <p className="mt-0.5 truncate text-[11px] text-neutral-600">
                        {repo.url}
                      </p>
                    )}
                  </div>
                  {repo.primaryLanguage && (
                    <span className="shrink-0 text-[10px] text-neutral-600">
                      {repo.primaryLanguage}
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-700 transition-colors group-hover:text-neutral-500" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Projects */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <Layers className="h-4 w-4 text-neutral-500" />
              Projects
              <span className="text-xs font-normal text-neutral-600">
                {workspace.projects.length}
              </span>
            </h3>
            {workspace.repositories.length > 0 && (
              <Link
                href={`/work/projects/new?repository=${workspace.repositories[0].id}`}
                className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
              >
                <Plus className="h-3.5 w-3.5" />
                New project
              </Link>
            )}
          </div>
          {workspace.projects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-6 text-center text-xs text-neutral-600">
              {workspace.repositories.length === 0
                ? "Add a repository first, then create a project that targets it."
                : "No projects in this workspace yet."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {workspace.projects.map((project) => {
                const tasks = [
                  ...project.features.flatMap((f) => f.tasks),
                  ...project.tasks,
                ];
                const done = tasks.filter((t) => t.status === "done").length;
                const progress =
                  tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
                return (
                  <Link
                    key={project.id}
                    href={`/w/${workspace.slug}/projects/${project.id}`}
                    className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-neutral-200">
                          {project.name}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                            PROJECT_STATUS_COLORS[project.status] ??
                              PROJECT_STATUS_COLORS["active"]
                          )}
                        >
                          {project.status}
                        </span>
                        {project.repository && (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-500">
                            <FolderGit2 className="h-3 w-3" />
                            {project.repository.name}
                          </span>
                        )}
                      </div>
                      {tasks.length > 0 ? (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
                            <div
                              className="h-1.5 rounded-full bg-emerald-600 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[10px] text-neutral-500">
                            {done}/{tasks.length} tasks
                          </span>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-neutral-600">
                          No tasks yet
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 transition-colors group-hover:text-neutral-500" />
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
