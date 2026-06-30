import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Boxes,
  FolderGit2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { workspaceBadgeClasses } from "@/lib/workspace-badge";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { AddTaskForm } from "@/app/(app)/work/projects/[id]/add-task-form";
import { GeneratedWorkTraceBanner } from "@/components/planning/generated-work-trace-banner";

interface Props {
  params: Promise<{ workspace: string; projectId: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string; bg: string }
> = {
  todo: {
    label: "To Do",
    icon: Circle,
    className: "text-neutral-500",
    bg: "bg-neutral-900 text-neutral-500 border-neutral-700",
  },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    className: "text-blue-400",
    bg: "bg-blue-950 text-blue-400 border-blue-900",
  },
  "in-review": {
    label: "In Review",
    icon: AlertCircle,
    className: "text-amber-400",
    bg: "bg-amber-950 text-amber-400 border-amber-900",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    className: "text-emerald-400",
    bg: "bg-emerald-950 text-emerald-400 border-emerald-900",
  },
  blocked: {
    label: "Blocked",
    icon: AlertCircle,
    className: "text-red-400",
    bg: "bg-red-950 text-red-400 border-red-900",
  },
  cancelled: {
    label: "Cancelled",
    icon: Circle,
    className: "text-neutral-600",
    bg: "bg-neutral-900 text-neutral-600 border-neutral-800",
  },
};

export default async function WorkspaceProjectDetailPage({ params }: Props) {
  const { workspace: slug, projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { employees: { select: { id: true, name: true } } },
  });
  if (!company) redirect("/onboarding");

  const workspace = await prisma.workspace.findFirst({
    where: { slug, companyId: company.id },
  });
  if (!workspace) notFound();

  // Resolve the project by id and verify it belongs to this workspace.
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id, companyId: company.id },
    include: {
      repository: {
        select: { id: true, name: true, url: true, analysisStatus: true },
      },
      outcome: { select: { id: true, title: true } },
      features: {
        include: {
          tasks: {
            include: {
              assignee: { select: { id: true, name: true } },
              subtasks: { select: { id: true, completed: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        where: { featureId: null },
        include: {
          assignee: { select: { id: true, name: true } },
          subtasks: { select: { id: true, completed: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  const featureTasks = project.features.flatMap((f) => f.tasks);
  const allTasks = [...featureTasks, ...project.tasks];

  const tasksDone = allTasks.filter((t) => t.status === "done").length;
  const progress =
    allTasks.length > 0
      ? Math.round((tasksDone / allTasks.length) * 100)
      : 0;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <Breadcrumbs
          items={[
            { label: workspace.name, href: `/w/${workspace.slug}` },
            { label: "Projects", href: `/w/${workspace.slug}/projects` },
            { label: project.name },
          ]}
        />
      </header>

      <div className="flex flex-col gap-8 p-6">
        <GeneratedWorkTraceBanner
          outcomeId={project.outcomeId}
          outcomeTitle={project.outcome?.title ?? null}
          planningDraftId={project.planningDraftId}
        />

        {/* Project header */}
        <section>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-100">
                {project.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/w/${workspace.slug}`}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                    workspaceBadgeClasses(workspace.id)
                  )}
                >
                  <Boxes className="h-3 w-3" />
                  {workspace.name}
                </Link>
                {project.repository ? (
                  <Link
                    href={`/w/${workspace.slug}/repositories/${project.repository.id}`}
                    className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-neutral-300 hover:border-neutral-600 hover:text-neutral-100 transition-colors"
                  >
                    <FolderGit2 className="h-3 w-3" />
                    {project.repository.name}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-amber-900/50 bg-amber-950/20 px-2 py-0.5 text-[11px] font-medium text-amber-500/90">
                    <FolderGit2 className="h-3 w-3" />
                    No repository linked
                  </span>
                )}
              </div>
              {project.description && (
                <p className="mt-2 text-sm text-neutral-400 max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium bg-neutral-900 text-neutral-400 border-neutral-700">
              {project.status}
            </span>
          </div>

          {allTasks.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 max-w-xs rounded-full bg-neutral-800">
                <div
                  className="h-1.5 rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500">
                {tasksDone}/{allTasks.length} tasks complete
              </span>
            </div>
          )}
        </section>

        {/* Tasks */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">Tasks</h3>
          </div>

          {allTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-800 py-8 text-center">
              <p className="text-sm text-neutral-500">No tasks yet</p>
              <p className="mt-0.5 text-xs text-neutral-700">
                Add a task below to start tracking work.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {allTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}

          {/* Add task form */}
          <div className="mt-4">
            <AddTaskForm
              projectId={project.id}
              employees={company.employees}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function TaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee: { id: string; name: string } | null;
    subtasks: { id: string; completed: boolean }[];
  };
}) {
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG["todo"];
  const Icon = cfg.icon;
  const subtasksDone = task.subtasks.filter((s) => s.completed).length;

  return (
    <Link
      href={`/work/tasks/${task.id}`}
      className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 hover:border-neutral-800 hover:bg-neutral-900 transition-colors"
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.className)} />
      <span className="flex-1 text-sm text-neutral-300 truncate">
        {task.title}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {task.subtasks.length > 0 && (
          <span className="text-[11px] text-neutral-600">
            {subtasksDone}/{task.subtasks.length}
          </span>
        )}
        <span
          className={cn(
            "text-[11px] font-medium",
            PRIORITY_COLORS[task.priority] ?? "text-neutral-500"
          )}
        >
          {task.priority}
        </span>
        {task.assignee && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-medium text-neutral-300">
            {task.assignee.name[0]}
          </span>
        )}
      </div>
    </Link>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-neutral-400",
  low: "text-neutral-600",
};
