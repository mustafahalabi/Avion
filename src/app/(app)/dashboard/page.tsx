import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  ChevronRight,
  Plus,
  Users,
  Layers,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const RUNTIME_STATUS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  intake: {
    label: "Intake",
    color: "text-blue-400",
    icon: Circle,
  },
  planning: {
    label: "Planning",
    color: "text-violet-400",
    icon: Clock,
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    color: "text-amber-400",
    icon: AlertCircle,
  },
  executing: {
    label: "Executing",
    color: "text-emerald-400",
    icon: Clock,
  },
  in_review: {
    label: "In Review",
    color: "text-amber-400",
    icon: Clock,
  },
  in_qa: {
    label: "In QA",
    color: "text-purple-400",
    icon: Clock,
  },
  complete: {
    label: "Complete",
    color: "text-emerald-400",
    icon: CheckCircle2,
  },
  blocked: {
    label: "Blocked",
    color: "text-red-400",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-neutral-600",
    icon: Circle,
  },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    include: {
      settings: true,
      _count: {
        select: {
          employees: { where: { status: "active" } },
          tasks: true,
          memories: true,
        },
      },
      runtimeRequests: {
        where: {
          status: {
            notIn: ["complete", "cancelled"],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      },
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
          },
        },
      },
    },
  });

  if (!company) redirect("/onboarding");

  const allTasks = company.workspaces.flatMap((w) =>
    w.projects.flatMap((p) => p.features.flatMap((f) => f.tasks))
  );
  const taskStats = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === "done").length,
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
    blocked: allTasks.filter((t) => t.status === "blocked").length,
  };
  const projects = company.workspaces.flatMap((w) => w.projects);
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "planning").length;

  const companyName = company.name;
  const greeting = getGreeting();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Dashboard</h1>
        <Link
          href="/inbox"
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Submit request
        </Link>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Greeting */}
        <section>
          <h2 className="text-xl font-semibold text-neutral-100">
            {greeting}, CEO.
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {companyName} is{" "}
            {company.runtimeRequests.length > 0
              ? `handling ${company.runtimeRequests.length} active request${company.runtimeRequests.length === 1 ? "" : "s"}`
              : "ready for your next request"}
            .
          </p>
        </section>

        {/* Company health stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Active Employees"
            value={company._count.employees}
            icon={<Users className="h-3.5 w-3.5" />}
            href="/company/employees"
          />
          <StatCard
            label="Active Projects"
            value={activeProjects}
            icon={<Layers className="h-3.5 w-3.5" />}
            href="/work/projects"
          />
          <StatCard
            label="Tasks in Progress"
            value={taskStats.inProgress}
            icon={<Clock className="h-3.5 w-3.5" />}
            href="/work"
          />
          <StatCard
            label="Memory Banks"
            value={company._count.memories}
            icon={<BookOpen className="h-3.5 w-3.5" />}
            href="/memory"
          />
        </section>

        {/* Active requests */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">
              Active Requests
            </h3>
            <Link
              href="/inbox"
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              View all
            </Link>
          </div>

          {company.runtimeRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-10 text-center">
              <Circle className="h-5 w-5 text-neutral-600" />
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  No active requests
                </p>
                <p className="mt-0.5 text-xs text-neutral-700">
                  Submit a request to put your company to work.
                </p>
              </div>
              <Link
                href="/inbox"
                className="mt-1 flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Submit request
              </Link>
            </div>
          ) : (
            <div className="grid gap-2">
              {company.runtimeRequests.map((req) => {
                const cfg =
                  RUNTIME_STATUS[req.status] ?? RUNTIME_STATUS["intake"];
                const Icon = cfg.icon;
                return (
                  <Link
                    key={req.id}
                    href={`/inbox/requests/${req.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">
                        {req.title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        {cfg.label}
                        {req.assignedTo && ` · ${req.assignedTo}`}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Work summary */}
        {taskStats.total > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-200">
                Work Overview
              </h3>
              <Link
                href="/work"
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Open work
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="In Progress"
                value={taskStats.inProgress}
                color="text-blue-400"
              />
              <MiniStat
                label="Blocked"
                value={taskStats.blocked}
                color={taskStats.blocked > 0 ? "text-red-400" : "text-neutral-400"}
              />
              <MiniStat
                label="Done"
                value={taskStats.done}
                color="text-emerald-400"
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3 transition-colors hover:border-neutral-700">
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-200">
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}
