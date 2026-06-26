import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AddTaskForm } from "./add-task-form";

interface Props {
  params: Promise<{ id: string }>;
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

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    include: { employees: { select: { id: true, name: true } } },
  });
  if (!company) redirect("/onboarding");

  const workspace = await prisma.workspace.findFirst({
    where: { companyId: company.id },
  });

  const project = workspace
    ? await prisma.project.findFirst({
        where: { id, workspaceId: workspace.id },
        include: {
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
        },
      })
    : null;

  if (!project) notFound();

  const allTasks = project.features.flatMap((f) => f.tasks);
  const standaloneTasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      featureId: null,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      subtasks: { select: { id: true, completed: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const tasksDone = allTasks.filter((t) => t.status === "done").length;
  const progress =
    allTasks.length > 0
      ? Math.round((tasksDone / allTasks.length) * 100)
      : 0;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Work
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {project.name}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Project header */}
        <section>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-100">
                {project.name}
              </h2>
              {project.description && (
                <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
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

          {allTasks.length === 0 && standaloneTasks.length === 0 ? (
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
