import { getCurrentUser } from "@/lib/current-user";
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
  Zap,
  TrendingUp,
  Activity,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import {
  computeNextActions,
  type NextAction,
} from "@/lib/next-action-recommendation";
import {
  countPendingPlanningDrafts,
  getPendingPlanningDrafts,
  getPlanningLifecycleTimeline,
  getRecentlyApprovedPlanningDrafts,
} from "@/lib/outcome-planning-lifecycle";
import { PlanningDashboardSections } from "@/components/planning/planning-dashboard-sections";

const RUNTIME_STATUS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  intake: { label: "Intake", color: "text-blue-400", icon: Circle },
  planning: { label: "Planning", color: "text-violet-400", icon: Clock },
  awaiting_approval: {
    label: "Awaiting Approval",
    color: "text-amber-400",
    icon: AlertCircle,
  },
  executing: { label: "Executing", color: "text-emerald-400", icon: Clock },
  in_review: { label: "In Review", color: "text-amber-400", icon: Clock },
  in_qa: { label: "In QA", color: "text-purple-400", icon: Clock },
  complete: { label: "Complete", color: "text-emerald-400", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "text-red-400", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-neutral-600", icon: Circle },
};

const DEPT_COLORS: Record<string, string> = {
  executive: "bg-violet-500",
  product: "bg-blue-500",
  engineering: "bg-emerald-500",
  quality: "bg-amber-500",
  operations: "bg-rose-500",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: {
      settings: true,
      _count: {
        select: {
          employees: { where: { status: "active" } },
          memories: true,
        },
      },
      runtimeRequests: {
        where: { status: { notIn: ["complete", "cancelled"] } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
      workspaces: {
        include: {
          _count: { select: { repositories: true } },
          projects: {
            include: {
              features: {
                include: {
                  tasks: { select: { id: true, status: true, title: true, assigneeId: true } },
                },
              },
              tasks: { select: { id: true, status: true, title: true, assigneeId: true } },
            },
          },
        },
      },
      employees: {
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
        take: 14,
        include: {
          department: { select: { name: true, slug: true } },
          role: { select: { name: true } },
          assignedTasks: {
            where: { status: { in: ["in-progress", "blocked"] } },
            select: { id: true, title: true, status: true },
            take: 2,
          },
        },
      },
    },
  });

  if (!company) redirect("/onboarding");

  const allTasks = company.workspaces.flatMap((w) =>
    w.projects.flatMap((p) => [
      ...p.features.flatMap((f) => f.tasks),
      ...p.tasks,
    ])
  );
  const taskStats = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === "done").length,
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
    blocked: allTasks.filter((t) => t.status === "blocked").length,
  };
  const projects = company.workspaces.flatMap((w) => w.projects);
  const activeProjects = projects.filter(
    (p) => p.status === "active" || p.status === "planning"
  ).length;
  const repositoryCount = company.workspaces.reduce(
    (n, w) => n + (w._count?.repositories ?? 0),
    0
  );

  const awaitingApproval = company.runtimeRequests.filter(
    (r) => r.status === "awaiting_approval"
  );
  const blockedRequests = company.runtimeRequests.filter(
    (r) => r.status === "blocked"
  );
  const otherActive = company.runtimeRequests.filter(
    (r) => !["awaiting_approval", "blocked"].includes(r.status)
  );
  const blockedTasks = allTasks.filter((t) => t.status === "blocked");

  // Fetch execution session counts and pending plan approvals in parallel
  const [recentEvents, executionCounts, pendingPlanCount, pendingPlans, approvedPlans, planningTimeline] =
    await Promise.all([
      prisma.runtimeEvent.findMany({
        where: { request: { companyId: company.id } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { request: { select: { id: true, title: true } } },
      }),
      prisma.executionSession.groupBy({
        by: ["status"],
        where: { companyId: company.id },
        _count: { id: true },
      }),
      countPendingPlanningDrafts(company.id),
      getPendingPlanningDrafts(company.id),
      getRecentlyApprovedPlanningDrafts(company.id),
      getPlanningLifecycleTimeline(company.id, 8),
    ]);

  const execByStatus = Object.fromEntries(
    executionCounts.map((r) => [r.status, r._count.id])
  );

  const employeesWithWork = company.employees.filter(
    (e) => e.assignedTasks.length > 0
  );
  const idleEmployees = company.employees.filter(
    (e) => e.assignedTasks.length === 0
  );

  const isNewCompany =
    company.runtimeRequests.length === 0 &&
    allTasks.length === 0 &&
    recentEvents.length === 0;

  const { primary: primaryAction, secondary: secondaryActions } =
    computeNextActions({
      pendingPlanApprovalCount: pendingPlanCount,
      awaitingApprovalRequestCount: awaitingApproval.length,
      failedExecutionCount: execByStatus["failed"] ?? 0,
      needsClarificationCount: execByStatus["needs_clarification"] ?? 0,
      blockedTaskCount: blockedTasks.length,
      blockedRequestCount: blockedRequests.length,
      readyExecutionCount:
        (execByStatus["queued"] ?? 0) + (execByStatus["prepared"] ?? 0),
      runningExecutionCount: execByStatus["running"] ?? 0,
      activeRequestCount: company.runtimeRequests.length,
      isNewCompany,
    });

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

      <div className="flex flex-col gap-8 p-6 max-w-4xl">
        {/* Setup banner — shown while company has no repositories */}
        {repositoryCount === 0 && (
          <section className="flex items-center justify-between gap-4 rounded-lg border border-violet-900/40 bg-violet-950/10 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              <p className="text-sm text-neutral-300 truncate">
                Complete your company setup — connect a repository and configure
                your company style.
              </p>
            </div>
            <Link
              href="/setup"
              className="shrink-0 rounded-md border border-violet-800/60 bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-950/60 transition-colors"
            >
              Complete setup
            </Link>
          </section>
        )}

        {/* Greeting */}
        <section>
          <h2 className="text-xl font-semibold text-neutral-100">
            {getGreeting()}, CEO.
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {company.name} ·{" "}
            {isNewCompany
              ? "Ready for your first request."
              : company.runtimeRequests.length > 0
              ? `${company.runtimeRequests.length} active request${company.runtimeRequests.length === 1 ? "" : "s"} in motion.`
              : "No active requests."}
          </p>
        </section>

        {/* Recommended next action — surfaced early as the primary CEO signal */}
        {primaryAction && (
          <section>
            <SectionHeader
              label="Recommended Next Action"
              icon={<Zap className="h-3.5 w-3.5 text-violet-400" />}
            />
            <div className="flex flex-col gap-2">
              <NextActionCard action={primaryAction} primary />
              {secondaryActions.map((action) => (
                <NextActionCard key={action.id} action={action} />
              ))}
            </div>
          </section>
        )}

        {/* New company getting started */}
        {isNewCompany && (
          <section className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/50 px-6 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800">
                <Zap className="h-5 w-5 text-neutral-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-200">
                  Your company is ready.
                </p>
                <p className="mt-1 text-xs text-neutral-500 max-w-sm">
                  {company._count.employees} employees are standing by. Submit
                  your first request to set the company in motion.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link
                  href="/inbox"
                  className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Submit first request
                </Link>
                <Link
                  href="/company"
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Meet the team
                </Link>
              </div>
            </div>
          </section>
        )}

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

        <PlanningDashboardSections
          pendingPlans={pendingPlans}
          approvedPlans={approvedPlans}
        />

        {/* Decisions awaiting approval */}
        {awaitingApproval.length > 0 && (
          <section>
            <SectionHeader
              label="Decisions Awaiting Your Approval"
              icon={<AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
              count={awaitingApproval.length}
            />
            <div className="grid gap-2">
              {awaitingApproval.map((req) => (
                <Link
                  key={req.id}
                  href={`/inbox/requests/${req.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-amber-900/40 bg-amber-950/10 px-4 py-3 transition-colors hover:border-amber-800/60 hover:bg-amber-950/20"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-200 truncate">
                      {req.title}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-600">
                      Awaiting approval
                      {req.assignedTo && ` · ${req.assignedTo}`}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-amber-800 group-hover:text-amber-600 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Risks and blockers */}
        {(blockedTasks.length > 0 || blockedRequests.length > 0) && (
          <section>
            <SectionHeader
              label="Risks & Blockers"
              icon={<ShieldAlert className="h-3.5 w-3.5 text-red-400" />}
              count={blockedTasks.length + blockedRequests.length}
            />
            <div className="grid gap-2">
              {blockedRequests.map((req) => (
                <Link
                  key={req.id}
                  href={`/inbox/requests/${req.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-red-900/40 bg-red-950/10 px-4 py-3 transition-colors hover:border-red-800/60 hover:bg-red-950/20"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-200 truncate">
                      {req.title}
                    </p>
                    <p className="mt-0.5 text-xs text-red-600">
                      Request blocked
                      {req.assignedTo && ` · ${req.assignedTo}`}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-red-900 group-hover:text-red-700 transition-colors" />
                </Link>
              ))}
              {blockedTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg border border-red-900/30 bg-red-950/5 px-4 py-2.5"
                >
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  <p className="flex-1 min-w-0 text-sm text-neutral-400 truncate">
                    {task.title}
                  </p>
                  <StatusBadge status="blocked" dot={false} />
                </div>
              ))}
              {blockedTasks.length > 4 && (
                <Link
                  href="/work"
                  className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors pl-1"
                >
                  +{blockedTasks.length - 4} more blocked tasks →
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Active requests */}
        {otherActive.length > 0 && (
          <section>
            <SectionHeader
              label="Active Requests"
              icon={<Activity className="h-3.5 w-3.5 text-neutral-400" />}
              href="/inbox"
              hrefLabel="View all"
            />
            <div className="grid gap-2">
              {otherActive.slice(0, 5).map((req) => {
                const cfg = RUNTIME_STATUS[req.status] ?? RUNTIME_STATUS["intake"];
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
                        <span className={cn("font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        {req.assignedTo && ` · ${req.assignedTo}`}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state for requests */}
        {!isNewCompany && company.runtimeRequests.length === 0 && (
          <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-8 text-center">
            <Circle className="h-5 w-5 text-neutral-700" />
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
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Submit request
            </Link>
          </section>
        )}

        {/* Employee activity */}
        {company.employees.length > 0 && (
          <section>
            <SectionHeader
              label="Employee Activity"
              icon={<Users className="h-3.5 w-3.5 text-neutral-400" />}
              href="/company/employees"
              hrefLabel="View all"
            />
            {employeesWithWork.length === 0 ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-5 text-center">
                <p className="text-xs text-neutral-600">
                  No employees have active tasks assigned.{" "}
                  <Link
                    href="/work"
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    Assign tasks in Work →
                  </Link>
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {employeesWithWork.slice(0, 6).map((emp) => {
                  const deptSlug = emp.department?.slug ?? "";
                  const dotColor = DEPT_COLORS[deptSlug] ?? "bg-neutral-600";
                  return (
                    <Link
                      key={emp.id}
                      href={`/company/employees/${emp.id}`}
                      className="group flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                    >
                      <div
                        className={cn(
                          "mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white",
                          dotColor
                        )}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-200">
                          {emp.name}
                        </p>
                        <p className="text-[11px] text-neutral-600 truncate">
                          {emp.role?.name ?? emp.department?.name}
                        </p>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {emp.assignedTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-1.5"
                            >
                              <div
                                className={cn(
                                  "h-1 w-1 shrink-0 rounded-full",
                                  task.status === "blocked"
                                    ? "bg-red-500"
                                    : "bg-emerald-500"
                                )}
                              />
                              <p className="text-[11px] text-neutral-500 truncate">
                                {task.title}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {idleEmployees.length > 0 && employeesWithWork.length > 0 && (
              <p className="mt-2 text-[11px] text-neutral-700 pl-0.5">
                {idleEmployees.length} employee{idleEmployees.length === 1 ? "" : "s"} with no assigned tasks.
              </p>
            )}
          </section>
        )}

        {/* Planning lifecycle timeline */}
        {planningTimeline.length > 0 && (
          <section>
            <SectionHeader
              label="Outcome Planning Activity"
              icon={<TrendingUp className="h-3.5 w-3.5 text-neutral-400" />}
            />
            <div className="flex flex-col">
              {planningTimeline.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    {i < planningTimeline.length - 1 && (
                      <div
                        className="w-px flex-1 bg-neutral-800 mt-1 mb-1"
                        style={{ minHeight: "16px" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-3">
                    <p className="text-xs text-neutral-400 leading-relaxed">{event.summary}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-700">
                      <Link
                        href={event.href}
                        className="truncate hover:text-neutral-500 transition-colors"
                      >
                        {event.outcomeTitle ?? "View outcome"}
                      </Link>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0 capitalize">
                        {event.eventType.replace(/\./g, " ")}
                      </span>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">
                        {new Date(event.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent timeline */}
        {recentEvents.length > 0 && (
          <section>
            <SectionHeader
              label="Recent Company Timeline"
              icon={<TrendingUp className="h-3.5 w-3.5 text-neutral-400" />}
            />
            <div className="flex flex-col">
              {recentEvents.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
                    {i < recentEvents.length - 1 && (
                      <div className="w-px flex-1 bg-neutral-800 mt-1 mb-1" style={{ minHeight: "16px" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-3">
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {event.description}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-700">
                      <Link
                        href={`/inbox/requests/${event.request.id}`}
                        className="truncate hover:text-neutral-500 transition-colors"
                      >
                        {event.request.title}
                      </Link>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">
                        {new Date(event.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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

function SectionHeader({
  label,
  icon,
  count,
  href,
  hrefLabel,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium text-neutral-200">{label}</h3>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
            {count}
          </span>
        )}
      </div>
      {href && hrefLabel && (
        <Link
          href={href}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

const PRIORITY_COLORS: Record<
  string,
  { border: string; bg: string; dot: string; label: string }
> = {
  urgent: {
    border: "border-amber-900/50",
    bg: "bg-amber-950/10",
    dot: "bg-amber-400",
    label: "text-amber-400",
  },
  high: {
    border: "border-red-900/40",
    bg: "bg-red-950/5",
    dot: "bg-red-400",
    label: "text-red-400",
  },
  medium: {
    border: "border-blue-900/40",
    bg: "bg-blue-950/5",
    dot: "bg-blue-400",
    label: "text-blue-400",
  },
  low: {
    border: "border-neutral-800",
    bg: "bg-neutral-900",
    dot: "bg-neutral-600",
    label: "text-neutral-500",
  },
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function NextActionCard({
  action,
  primary = false,
}: {
  action: NextAction;
  primary?: boolean;
}) {
  const colors =
    PRIORITY_COLORS[action.priority] ?? PRIORITY_COLORS["low"];

  return (
    <Link
      href={action.href}
      className={cn(
        "group flex items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors hover:brightness-110",
        colors.border,
        colors.bg,
        primary && "py-4"
      )}
    >
      <div className="mt-1.5 flex shrink-0 flex-col items-center gap-1.5">
        <div className={cn("h-2 w-2 rounded-full", colors.dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={cn(
              "font-semibold text-neutral-100",
              primary ? "text-sm" : "text-[13px]"
            )}
          >
            {action.title}
          </p>
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider",
              colors.label
            )}
          >
            {action.priority}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 text-neutral-400",
            primary ? "text-xs" : "text-[11px]"
          )}
        >
          {action.reason}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">
            {action.cta}
            <ChevronRight className="h-3 w-3" />
          </span>
          <span className="text-[10px] text-neutral-700">
            {CONFIDENCE_LABELS[action.confidence]}
          </span>
        </div>
      </div>
    </Link>
  );
}
