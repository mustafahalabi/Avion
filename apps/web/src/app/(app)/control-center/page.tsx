import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  ChevronRight,
  Clock,
  Layers,
  Plug,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeNextActions,
  type NextAction,
} from "@/lib/next-action-recommendation";
import {
  countPendingPlanningDrafts,
  getPlanningLifecycleTimeline,
} from "@/lib/outcome-planning-lifecycle";
import { listPendingCheckpoints } from "@/lib/approval-checkpoints";
import { detectStuckWork } from "@/lib/stuck-work-detector";
import { listProviderConnections } from "@/lib/provider-connection-service";
import {
  PROVIDER_DEFS,
  computeProviderCardState,
} from "@/lib/provider-card-state";
import { buildControlCenterViewModel } from "@/lib/control-center-view-model";
import { loadLivePipeline } from "@/lib/live-pipeline-data";
import { AttentionPanel } from "./attention-panel";
import { ActivityPanel } from "@/components/control-center/activity-panel";
import { LivePipelineWidget } from "@/components/control-center/live-pipeline-widget";
import type { TimelineItem } from "@/components/timeline-entry";

export default async function ControlCenterPage() {
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
                  tasks: {
                    select: { id: true, status: true, title: true },
                  },
                },
              },
              tasks: { select: { id: true, status: true, title: true } },
            },
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
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
  };
  const projects = company.workspaces.flatMap((w) => w.projects);
  const activeProjects = projects.filter(
    (p) => p.status === "active" || p.status === "planning"
  ).length;

  const awaitingApproval = company.runtimeRequests.filter(
    (r) => r.status === "awaiting_approval"
  );
  const blockedRequests = company.runtimeRequests.filter(
    (r) => r.status === "blocked"
  );
  const blockedTasks = allTasks.filter((t) => t.status === "blocked");

  const [
    stuckWork,
    pendingCheckpoints,
    executionCounts,
    connections,
    planningTimeline,
    recentEvents,
    pendingPlanCount,
    livePipeline,
  ] = await Promise.all([
    detectStuckWork({ companyId: company.id }),
    listPendingCheckpoints(company.id),
    prisma.executionSession.groupBy({
      by: ["status"],
      where: { companyId: company.id },
      _count: { id: true },
    }),
    listProviderConnections(company.id),
    getPlanningLifecycleTimeline(company.id, 12),
    prisma.runtimeEvent.findMany({
      where: { request: { companyId: company.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { request: { select: { id: true, title: true } } },
    }),
    countPendingPlanningDrafts(company.id),
    // Compact live board for the home-screen widget — no stream / done items.
    loadLivePipeline(company.id, { streamLimit: 1, doneLimit: 0 }),
  ]);

  const execByStatus = Object.fromEntries(
    executionCounts.map((r) => [r.status, r._count.id])
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

  const vm = buildControlCenterViewModel({
    primaryAction,
    secondaryActions,
    pendingCheckpoints,
    stuckWork: stuckWork.items,
    awaitingApprovalRequests: awaitingApproval.map((r) => ({
      id: r.id,
      title: r.title,
    })),
    blockedRequests: blockedRequests.map((r) => ({
      id: r.id,
      title: r.title,
    })),
    companyState: {
      activeEmployees: company._count.employees,
      activeProjects,
      tasksInProgress: taskStats.inProgress,
      blockedTasks: blockedTasks.length,
      openRequests: company.runtimeRequests.length,
      memoryBanks: company._count.memories,
    },
    providers: PROVIDER_DEFS.map((def) => {
      const connection =
        connections.find((c) => c.provider === def.id) ?? null;
      return { def, state: computeProviderCardState(connection) };
    }),
  });

  const activityItems: TimelineItem[] = [
    ...recentEvents.map((event) => ({
      id: `runtime-${event.id}`,
      createdAt: event.createdAt,
      description: event.description,
      contextHref: `/inbox/requests/${event.request.id}`,
      contextLabel: event.request.title,
      type: event.type,
    })),
    ...planningTimeline.map((event) => ({
      id: `planning-${event.id}`,
      createdAt: event.createdAt,
      description: event.summary,
      contextHref: event.href,
      contextLabel: event.outcomeTitle ?? "Outcome planning",
      type: event.eventType,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">
          Control Center
        </h1>
        <Link
          href="/inbox"
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          <Activity className="h-3.5 w-3.5" />
          Open inbox
        </Link>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Greeting */}
        <section>
          <h2 className="text-xl font-semibold text-neutral-100">
            {getGreeting()}, CEO.
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {company.name} ·{" "}
            {vm.attentionCount > 0
              ? `${vm.attentionCount} item${vm.attentionCount === 1 ? "" : "s"} need${vm.attentionCount === 1 ? "s" : ""} your attention.`
              : "Everything is on track."}
          </p>
        </section>

        {/* Recommended next action */}
        {vm.primaryAction && (
          <section>
            <SectionHeader
              label="Recommended Next Action"
              icon={<Zap className="h-3.5 w-3.5 text-neutral-400" />}
            />
            <div className="flex flex-col gap-2">
              <NextActionCard action={vm.primaryAction} primary />
              {vm.secondaryActions.map((action) => (
                <NextActionCard key={action.id} action={action} />
              ))}
            </div>
          </section>
        )}

        {/* Live pipeline — watch work move in real time (streams over SSE) */}
        <LivePipelineWidget initial={livePipeline} />

        {/* Needs attention */}
        <section>
          <SectionHeader
            label="Needs Your Attention"
            icon={<ShieldAlert className="h-3.5 w-3.5 text-amber-400" />}
            count={vm.attentionCount}
          />
          <AttentionPanel items={vm.attention} />
        </section>

        {/* Company state */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Active Employees"
            value={vm.companyState.activeEmployees}
            icon={<Users className="h-3.5 w-3.5" />}
            href="/company/employees"
          />
          <StatCard
            label="Active Projects"
            value={vm.companyState.activeProjects}
            icon={<Layers className="h-3.5 w-3.5" />}
            href="/work/projects"
          />
          <StatCard
            label="Tasks in Progress"
            value={vm.companyState.tasksInProgress}
            icon={<Clock className="h-3.5 w-3.5" />}
            href="/work"
          />
          <StatCard
            label="Blocked Tasks"
            value={vm.companyState.blockedTasks}
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            href="/work"
          />
          <StatCard
            label="Open Requests"
            value={vm.companyState.openRequests}
            icon={<Activity className="h-3.5 w-3.5" />}
            href="/inbox"
          />
          <StatCard
            label="Memory Banks"
            value={vm.companyState.memoryBanks}
            icon={<BookOpen className="h-3.5 w-3.5" />}
            href="/memory"
          />
        </section>

        {/* Provider health */}
        <section>
          <SectionHeader
            label="Integration Health"
            icon={<Plug className="h-3.5 w-3.5 text-neutral-400" />}
            href="/integrations"
            hrefLabel="Manage"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            {vm.providerHealth.map((provider) => (
              <Link
                key={provider.id}
                href="/integrations"
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3 transition-colors hover:border-neutral-700"
              >
                <span className="text-sm font-medium text-neutral-200">
                  {provider.name}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      provider.healthy ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  />
                  {provider.statusLabel}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <ActivityPanel items={activityItems} viewAllHref="/timeline" />
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
  const colors = PRIORITY_COLORS[action.priority] ?? PRIORITY_COLORS["low"];

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
