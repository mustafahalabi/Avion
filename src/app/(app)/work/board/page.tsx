import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Circle,
  Clock,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PRIORITY_BG: Record<string, string> = {
  urgent: "bg-red-950/60 text-red-400 border-red-900/60",
  high: "bg-orange-950/60 text-orange-400 border-orange-900/60",
  medium: "bg-neutral-800 text-neutral-400 border-neutral-700",
  low: "bg-neutral-900 text-neutral-600 border-neutral-800",
};

type ColumnDef = {
  key: string;
  label: string;
  icon: React.ElementType;
  headerClass: string;
  countClass: string;
  collapsed?: boolean;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "todo",
    label: "To Do",
    icon: Circle,
    headerClass: "text-neutral-400",
    countClass: "bg-neutral-800 text-neutral-400",
  },
  {
    key: "in-progress",
    label: "In Progress",
    icon: Clock,
    headerClass: "text-blue-400",
    countClass: "bg-blue-950 text-blue-400",
  },
  {
    key: "in-review",
    label: "In Review",
    icon: AlertCircle,
    headerClass: "text-amber-400",
    countClass: "bg-amber-950 text-amber-400",
  },
  {
    key: "blocked",
    label: "Blocked",
    icon: AlertCircle,
    headerClass: "text-red-400",
    countClass: "bg-red-950 text-red-400",
  },
  {
    key: "done",
    label: "Done",
    icon: CheckCircle2,
    headerClass: "text-emerald-400",
    countClass: "bg-emerald-950 text-emerald-400",
    collapsed: true,
  },
];

type BoardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  feature: { project: { id: string; name: string } | null } | null;
};

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
  });
  if (!company) redirect("/onboarding");

  const tasks = await prisma.task.findMany({
    where: { companyId: company.id },
    include: {
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      feature: {
        select: {
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const grouped: Record<string, BoardTask[]> = Object.fromEntries(
    COLUMNS.map((col) => [
      col.key,
      tasks.filter((t: BoardTask) => t.status === col.key),
    ])
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-neutral-500" />
          <h1 className="text-sm font-semibold text-neutral-100">Board</h1>
        </div>

        {/* List | Board toggle */}
        <div className="flex items-center rounded-md border border-neutral-800 overflow-hidden">
          <Link
            href="/work"
            className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            List
          </Link>
          <span className="px-3 py-1.5 text-xs font-medium text-neutral-100 bg-neutral-800 cursor-default">
            Board
          </span>
        </div>
      </header>

      {/* Kanban columns */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4 min-h-0">
        {COLUMNS.map((col) => {
          const colTasks = grouped[col.key] ?? [];
          const Icon = col.icon;

          return (
            <div
              key={col.key}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-neutral-800 bg-neutral-950"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-800">
                <Icon
                  className={cn("h-3.5 w-3.5 shrink-0", col.headerClass)}
                />
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    col.headerClass
                  )}
                >
                  {col.label}
                </span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    col.countClass
                  )}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Column body */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {col.collapsed ? (
                  colTasks.length === 0 ? (
                    <EmptyColumn />
                  ) : (
                    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-4 text-center">
                      <p className="text-lg font-semibold text-emerald-400">
                        {colTasks.length}
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {colTasks.length === 1 ? "task" : "tasks"} completed
                      </p>
                    </div>
                  )
                ) : colTasks.length === 0 ? (
                  <EmptyColumn />
                ) : (
                  colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: BoardTask }) {
  const projectName =
    task.project?.name ?? task.feature?.project?.name ?? null;

  return (
    <Link
      href={`/work/tasks/${task.id}`}
      className="group flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
    >
      {/* Title */}
      <p className="text-[13px] font-medium text-neutral-200 leading-snug line-clamp-2">
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {projectName && (
          <span className="text-[10px] text-neutral-500 truncate max-w-[120px]">
            {projectName}
          </span>
        )}

        <span
          className={cn(
            "ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium",
            PRIORITY_BG[task.priority] ?? PRIORITY_BG["medium"]
          )}
        >
          {task.priority}
        </span>

        {task.assignee && task.assignee.name.length > 0 && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-semibold text-neutral-300 shrink-0"
            title={task.assignee.name}
          >
            {task.assignee.name[0].toUpperCase()}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyColumn() {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <p className="text-[11px] text-neutral-700">No tasks</p>
    </div>
  );
}
