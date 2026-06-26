import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft, Layers, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-950 text-emerald-400 border-emerald-900",
  planning: "bg-blue-950 text-blue-400 border-blue-900",
  paused: "bg-amber-950 text-amber-400 border-amber-900",
  done: "bg-neutral-900 text-neutral-500 border-neutral-700",
  cancelled: "bg-neutral-900 text-neutral-600 border-neutral-800",
};

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    include: {
      workspaces: {
        include: {
          projects: {
            include: {
              features: {
                include: {
                  tasks: { select: { id: true, status: true } },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  if (!company) redirect("/onboarding");

  const projects = company.workspaces.flatMap((w) => w.projects);

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
          <h1 className="text-sm font-semibold text-neutral-100">Projects</h1>
        </div>
        <Link
          href="/work/projects/new"
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
      </header>

      <div className="flex flex-col gap-4 p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-16 text-center">
            <Layers className="h-6 w-6 text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">
                No projects yet
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Create a project to start organizing work.
              </p>
            </div>
            <Link
              href="/work/projects/new"
              className="mt-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Create project
            </Link>
          </div>
        ) : (
          projects.map((project) => {
            const tasks = project.features.flatMap((f) => f.tasks);
            const done = tasks.filter((t) => t.status === "done").length;
            const progress =
              tasks.length > 0
                ? Math.round((done / tasks.length) * 100)
                : 0;
            return (
              <Link
                key={project.id}
                href={`/work/projects/${project.id}`}
                className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-200 truncate">
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
                  </div>
                  {project.description && (
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-1">
                      {project.description}
                    </p>
                  )}
                  {tasks.length > 0 ? (
                    <div className="mt-2.5 flex items-center gap-2">
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
                    <p className="mt-2 text-[11px] text-neutral-600">
                      No tasks yet
                    </p>
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
