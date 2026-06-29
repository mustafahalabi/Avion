import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Layers,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Plus,
  ChevronRight,
  Target,
  GitBranch,
  ShieldCheck,
  PackageCheck,
  ClipboardList,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  todo: { label: "To Do", icon: Circle, className: "text-neutral-500" },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    className: "text-blue-400",
  },
  "in-review": {
    label: "In Review",
    icon: AlertCircle,
    className: "text-amber-400",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    className: "text-emerald-400",
  },
  blocked: { label: "Blocked", icon: AlertCircle, className: "text-red-400" },
  cancelled: {
    label: "Cancelled",
    icon: Circle,
    className: "text-neutral-600",
  },
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-950 text-emerald-400 border-emerald-900",
  planning: "bg-blue-950 text-blue-400 border-blue-900",
  paused: "bg-amber-950 text-amber-400 border-amber-900",
  done: "bg-neutral-900 text-neutral-500 border-neutral-700",
  cancelled: "bg-neutral-900 text-neutral-600 border-neutral-800",
};

export default async function WorkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
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
              tasks: { select: { id: true, status: true } },
              _count: { select: { features: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
      tasks: {
        where: { status: { in: ["in-progress", "todo"] } },
        include: {
          assignee: { select: { id: true, name: true } },
          feature: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!company) redirect("/onboarding");

  const projects = company.workspaces.flatMap((w) => w.projects);

  const allTasks = company.workspaces.flatMap((w) =>
    w.projects.flatMap((p) => [
      ...p.features.flatMap((f) => f.tasks),
      ...p.tasks,
    ])
  );
  const taskCounts = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === "done").length,
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
    todo: allTasks.filter((t) => t.status === "todo").length,
    blocked: allTasks.filter((t) => t.status === "blocked").length,
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Work</h1>
        <div className="flex items-center gap-2">
          {/* List | Board toggle */}
          <div className="flex items-center rounded-md border border-neutral-800 overflow-hidden">
            <span className="px-3 py-1.5 text-xs font-medium text-neutral-100 bg-neutral-800 cursor-default">
              List
            </span>
            <Link
              href="/work/board"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              <LayoutGrid className="h-3 w-3" />
              Board
            </Link>
          </div>
          <Link
            href="/work/projects/new"
            className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Summary stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Projects" value={projects.length} />
          <StatCard
            label="In Progress"
            value={taskCounts.inProgress}
            highlight="blue"
          />
          <StatCard
            label="Blocked"
            value={taskCounts.blocked}
            highlight={taskCounts.blocked > 0 ? "red" : undefined}
          />
          <StatCard
            label="Done"
            value={taskCounts.done}
            highlight="green"
          />
        </section>

        {/* Quick links */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-neutral-200">
            Sections
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <QuickLink
              href="/work/outcomes"
              icon={Target}
              label="Outcomes"
              description="CEO goals and plans"
              accent="violet"
            />
            <QuickLink
              href="/work/projects"
              icon={ClipboardList}
              label="Projects"
              description="Active work streams"
              accent="blue"
            />
            <QuickLink
              href="/work/quality"
              icon={ShieldCheck}
              label="Reviews & QA"
              description="Review and QA sessions"
              accent="amber"
            />
            <QuickLink
              href="/work/releases"
              icon={PackageCheck}
              label="Releases"
              description="Release candidates"
              accent="emerald"
            />
            <QuickLink
              href="/work/repositories"
              icon={GitBranch}
              label="Repositories"
              description="Connected repositories"
              accent="neutral"
            />
          </div>
        </section>

        {/* Projects */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-200">Projects</h2>
            <Link
              href="/work/projects"
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              View all
            </Link>
          </div>

          {projects.length === 0 ? (
            <EmptyProjects />
          ) : (
            <div className="grid gap-2">
              {projects.slice(0, 6).map((project) => {
                const tasks = [
                  ...project.features.flatMap((f) => f.tasks),
                  ...project.tasks,
                ];
                const done = tasks.filter((t) => t.status === "done").length;
                const progress =
                  tasks.length > 0
                    ? Math.round((done / tasks.length) * 100)
                    : 0;
                return (
                  <Link
                    key={project.id}
                    href={`/work/projects/${project.id}`}
                    className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-200 truncate">
                          {project.name}
                        </p>
                        <Badge
                          className={cn(
                            "shrink-0 px-1.5 text-[10px]",
                            PROJECT_STATUS_COLORS[project.status] ??
                              PROJECT_STATUS_COLORS["active"]
                          )}
                        >
                          {project.status}
                        </Badge>
                      </div>
                      {tasks.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
                            <div
                              className="h-1.5 rounded-full bg-emerald-600 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[10px] text-neutral-500">
                            {done}/{tasks.length}
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Active tasks */}
        {company.tasks.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-200">
                Active Tasks
              </h2>
            </div>
            <div className="grid gap-1.5">
              {company.tasks.map((task) => {
                const cfg =
                  STATUS_CONFIG[task.status] ?? STATUS_CONFIG["todo"];
                const Icon = cfg.icon;
                return (
                  <Link
                    key={task.id}
                    href={`/work/tasks/${task.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm hover:border-neutral-800 hover:bg-neutral-900 transition-colors"
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        cfg.className
                      )}
                    />
                    <span className="flex-1 truncate text-neutral-300">
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={task.status} dot={false} />
                      {task.feature?.project?.name && (
                        <span className="text-xs text-neutral-600 truncate max-w-[100px]">
                          {task.feature.project.name}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-medium text-neutral-300">
                          {task.assignee.name[0]}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "blue" | "green" | "red";
}) {
  const valueClass =
    highlight === "blue"
      ? "text-blue-400"
      : highlight === "green"
        ? "text-emerald-400"
        : highlight === "red" && value > 0
          ? "text-red-400"
          : "text-neutral-200";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums",
          valueClass
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-12 text-center">
      <Layers className="h-6 w-6 text-neutral-600" />
      <div>
        <p className="text-sm font-medium text-neutral-400">No projects yet</p>
        <p className="mt-0.5 text-xs text-neutral-600">
          Create a project to start tracking work.
        </p>
      </div>
      <Link
        href="/work/projects/new"
        className="mt-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
      >
        Create your first project
      </Link>
    </div>
  );
}

const QUICK_LINK_ACCENT: Record<
  string,
  { icon: string; border: string; bg: string }
> = {
  violet: {
    icon: "text-violet-400",
    border: "border-violet-900/40 hover:border-violet-800/60",
    bg: "hover:bg-violet-950/10",
  },
  blue: {
    icon: "text-blue-400",
    border: "border-blue-900/40 hover:border-blue-800/60",
    bg: "hover:bg-blue-950/10",
  },
  amber: {
    icon: "text-amber-400",
    border: "border-amber-900/40 hover:border-amber-800/60",
    bg: "hover:bg-amber-950/10",
  },
  emerald: {
    icon: "text-emerald-400",
    border: "border-emerald-900/40 hover:border-emerald-800/60",
    bg: "hover:bg-emerald-950/10",
  },
  neutral: {
    icon: "text-neutral-400",
    border: "border-neutral-800 hover:border-neutral-700",
    bg: "hover:bg-neutral-900",
  },
};

function QuickLink({
  href,
  icon: Icon,
  label,
  description,
  accent = "neutral",
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  accent?: keyof typeof QUICK_LINK_ACCENT;
}) {
  const colors = QUICK_LINK_ACCENT[accent] ?? QUICK_LINK_ACCENT["neutral"];
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-neutral-900 px-3.5 py-3 transition-colors",
        colors.border,
        colors.bg
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", colors.icon)} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        <p className="mt-0.5 text-[11px] text-neutral-500 truncate">
          {description}
        </p>
      </div>
    </Link>
  );
}
