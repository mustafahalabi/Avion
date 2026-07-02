import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
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
import { countPendingCheckpoints } from "@/lib/approval-checkpoints";
import { PlanningDashboardSections } from "@/components/planning/planning-dashboard-sections";

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
  const blockedTasks = allTasks.filter((t) => t.status === "blocked");

  // Fetch execution session counts and pending plan approvals in parallel
  const [recentEvents, executionCounts, pendingPlanCount, pendingPlans, approvedPlans, , pendingApprovalCount] =
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
      countPendingCheckpoints(company.id),
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

  // ── Derived display data ───────────────────────────────────────────────────
  const autonomyLevel = company.settings?.autonomyLevel ?? "assist";
  const autonomyBlurb: Record<string, string> = {
    manual: "Suggests only — you drive every step.",
    suggest: "Proposes plans and changes for approval.",
    assist: "Opens PRs, pauses for your review.",
    delegate: "Runs review & QA, escalates the rest.",
    autonomous: "Plans, builds, reviews, ships — hands-off.",
  };
  const workBars = [
    { label: "Done", value: taskStats.done },
    { label: "Active", value: taskStats.inProgress },
    { label: "Blocked", value: taskStats.blocked },
    {
      label: "To do",
      value: Math.max(
        0,
        taskStats.total - taskStats.done - taskStats.inProgress - taskStats.blocked
      ),
    },
  ];
  const workMax = Math.max(1, ...workBars.map((b) => b.value));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex h-[62px] shrink-0 items-center gap-4 px-6"
        style={{
          borderBottom: "1.5px solid var(--av-bd)",
          background: "var(--av-surface)",
        }}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", lineHeight: 1 }}>
            Overview
          </span>
          <span
            style={{
              fontFamily: "var(--av-mono)",
              fontSize: 10,
              letterSpacing: ".08em",
              color: "var(--av-muted)",
              textTransform: "uppercase",
            }}
          >
            {company.name} · v2
          </span>
        </div>
        <Link href="/inbox" className="av-btn av-btn--mono" style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> New
        </Link>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto p-7">
        {/* Setup banner — shown while company has no repositories */}
        {repositoryCount === 0 && (
          <Link
            href="/setup"
            className="av-card flex items-center justify-between gap-4 px-4 py-3"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <span style={{ width: 8, height: 8, background: "var(--av-accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 14 }}>
                Complete your company setup — connect a repository and configure your style.
              </span>
            </span>
            <span className="av-tag">Complete setup →</span>
          </Link>
        )}

        {/* Greeting */}
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 30, letterSpacing: "-.02em", lineHeight: 1 }}>
            {getGreeting()}, CEO.
          </h2>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--av-muted)" }}>
            {company.name} ·{" "}
            {isNewCompany
              ? "Ready for your first request."
              : company.runtimeRequests.length > 0
              ? `${company.runtimeRequests.length} active request${company.runtimeRequests.length === 1 ? "" : "s"} in motion.`
              : "No active requests."}
          </p>
        </div>

        {/* CEO request console */}
        <div className="av-card av-card--raised">
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1.5px solid var(--av-bd)",
              fontFamily: "var(--av-mono)",
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--av-muted)",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <span style={{ width: 8, height: 8, background: "var(--av-accent)" }} />
            CEO request
          </div>
          <form action="/inbox" className="flex items-center gap-3 p-[18px]">
            <span style={{ color: "var(--av-accent)", fontSize: 22, lineHeight: 1 }}>▷</span>
            <input
              name="prompt"
              className="av-input"
              placeholder="Describe an outcome — e.g. “add subscription billing”"
              style={{ fontSize: 16, border: "none", background: "transparent", padding: "6px 0" }}
            />
            <button type="submit" className="av-btn av-btn--mono" style={{ whiteSpace: "nowrap" }}>
              Send to company
            </button>
          </form>
        </div>

        {/* Pending approvals — autonomy-gated review/QA checkpoints awaiting the CEO */}
        {pendingApprovalCount > 0 && (
          <Link
            href="/inbox"
            className="av-card flex items-center justify-between gap-4 px-4 py-3.5"
            style={{ textDecoration: "none", color: "inherit", borderColor: "var(--av-accent)" }}
          >
            <span className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <span style={{ width: 8, height: 8, background: "var(--av-accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 14 }}>
                <strong style={{ color: "var(--av-accent)" }}>
                  {pendingApprovalCount} task{pendingApprovalCount === 1 ? "" : "s"}
                </strong>{" "}
                awaiting your review / QA approval
              </span>
            </span>
            <span
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--av-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--av-accent)" }}
            >
              Review in inbox <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}

        {/* Recommended next action */}
        {primaryAction && (
          <section>
            <SectionLabel>Recommended next action</SectionLabel>
            <div className="flex flex-col gap-2.5">
              <NextActionCard action={primaryAction} primary />
              {secondaryActions.map((action) => (
                <NextActionCard key={action.id} action={action} />
              ))}
            </div>
          </section>
        )}

        {/* Stat tiles */}
        <div className="av-stat-grid">
          <AvStat label="Active Employees" value={company._count.employees} caption="standing by" href="/company/employees" />
          <AvStat label="Active Projects" value={activeProjects} caption="in flight" href="/work/projects" />
          <AvStat label="Tasks in Progress" value={taskStats.inProgress} caption={`${taskStats.total} total`} href="/work" />
          <AvStat label="Memory Banks" value={company._count.memories} caption="lessons & standards" href="/memory" />
        </div>

        {/* Two-col: work status + autonomy & guardrails */}
        <div className="grid gap-[22px] lg:grid-cols-[1.6fr_1fr]" style={{ alignItems: "start" }}>
          {/* Work status */}
          <div className="av-card">
            <div className="av-card__head">
              <span>Work status</span>
              <span
                style={{ fontFamily: "var(--av-mono)", fontSize: 11, fontWeight: 400, color: "var(--av-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}
              >
                tasks · all time
              </span>
            </div>
            <div className="flex items-end gap-3 p-[18px]" style={{ height: 200 }}>
              {workBars.map((b) => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-2.5" style={{ height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontFamily: "var(--av-mono)", fontSize: 13 }}>{b.value}</span>
                  <div
                    style={{
                      width: "100%",
                      background: "var(--av-accent)",
                      height: `${Math.round((b.value / workMax) * 100)}%`,
                      minHeight: b.value > 0 ? 4 : 0,
                    }}
                  />
                  <span style={{ fontFamily: "var(--av-mono)", fontSize: 10, color: "var(--av-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomy & guardrails */}
          <div className="av-card">
            <div className="av-card__head">Autonomy &amp; guardrails</div>
            <div className="flex flex-col gap-3.5 p-[18px]">
              <Row>
                <span style={{ fontSize: 14 }}>Level</span>
                <span className="av-tag av-tag--accent">{autonomyLevel.toUpperCase()}</span>
              </Row>
              <p style={{ fontSize: 12.5, color: "var(--av-muted)", lineHeight: 1.35, marginTop: -6 }}>
                {autonomyBlurb[autonomyLevel] ?? autonomyBlurb.assist}
              </p>
              <div style={{ height: 1, background: "var(--av-hair)" }} />
              <GuardRow label="Protected paths" value="on ✓" />
              <GuardRow label="Protected branches" value="on ✓" />
              <GuardRow label="Force-push" value="blocked" />
            </div>
          </div>
        </div>

        {/* Planning approvals (kept — restyle is a follow-up) */}
        <PlanningDashboardSections pendingPlans={pendingPlans} approvedPlans={approvedPlans} />

        {/* Decisions awaiting approval */}
        {awaitingApproval.length > 0 && (
          <section>
            <SectionLabel>Decisions awaiting your approval · {awaitingApproval.length}</SectionLabel>
            <div className="av-card">
              {awaitingApproval.map((req, i) => (
                <Link
                  key={req.id}
                  href={`/inbox/requests/${req.id}`}
                  className="flex items-center gap-3.5 px-[18px] py-3.5"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    borderBottom: i < awaitingApproval.length - 1 ? "1px solid var(--av-hair)" : "none",
                  }}
                >
                  <span style={{ width: 8, height: 8, background: "var(--av-accent)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14 }} className="truncate">
                    {req.title}
                  </span>
                  <span style={{ fontFamily: "var(--av-mono)", fontSize: 10, letterSpacing: ".08em", padding: "4px 8px", background: "var(--av-hair)", textTransform: "uppercase" }}>
                    awaiting
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--av-muted)" }} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Risks & blockers */}
        {(blockedTasks.length > 0 || blockedRequests.length > 0) && (
          <section>
            <SectionLabel>Risks &amp; blockers · {blockedTasks.length + blockedRequests.length}</SectionLabel>
            <div className="av-card">
              {blockedRequests.map((req) => (
                <Link
                  key={req.id}
                  href={`/inbox/requests/${req.id}`}
                  className="flex items-center gap-3.5 px-[18px] py-3.5"
                  style={{ textDecoration: "none", color: "inherit", borderBottom: "1px solid var(--av-hair)" }}
                >
                  <span style={{ width: 8, height: 8, background: "var(--av-accent)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14 }} className="truncate">{req.title}</span>
                  <span style={{ fontFamily: "var(--av-mono)", fontSize: 10, letterSpacing: ".08em", padding: "4px 8px", border: "1px solid var(--av-bd)", textTransform: "uppercase" }}>
                    blocked
                  </span>
                </Link>
              ))}
              {blockedTasks.slice(0, 5).map((task, i) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3.5 px-[18px] py-3"
                  style={{ borderBottom: i < Math.min(blockedTasks.length, 5) - 1 ? "1px solid var(--av-hair)" : "none" }}
                >
                  <span style={{ width: 6, height: 6, background: "var(--av-accent)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--av-muted)" }} className="truncate">{task.title}</span>
                  <span style={{ fontFamily: "var(--av-mono)", fontSize: 10, letterSpacing: ".08em", padding: "4px 8px", background: "var(--av-hair)", textTransform: "uppercase" }}>
                    blocked
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent activity */}
        {recentEvents.length > 0 && (
          <section>
            <SectionLabel
              action={
                <Link href="/timeline" style={{ fontFamily: "var(--av-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--av-accent)", textDecoration: "none" }}>
                  View all →
                </Link>
              }
            >
              Recent activity
            </SectionLabel>
            <div className="av-card">
              {recentEvents.map((event, i) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3.5 px-[18px] py-3.5"
                  style={{ borderBottom: i < recentEvents.length - 1 ? "1px solid var(--av-hair)" : "none" }}
                >
                  <span
                    style={{
                      fontFamily: "var(--av-mono)",
                      fontSize: 10,
                      fontWeight: 500,
                      border: "1px solid var(--av-bd)",
                      padding: "4px 7px",
                      minWidth: 92,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                    className="shrink-0"
                  >
                    {(event.actor ?? event.type).slice(0, 14)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14 }} className="truncate">
                    {event.description}{" "}
                    <Link href={`/inbox/requests/${event.request.id}`} style={{ fontFamily: "var(--av-mono)", color: "var(--av-muted)", textDecoration: "none" }}>
                      {event.request.title}
                    </Link>
                  </span>
                  <span style={{ fontFamily: "var(--av-mono)", fontSize: 11, color: "var(--av-muted)", whiteSpace: "nowrap" }} className="shrink-0">
                    {shortTime(event.createdAt)}
                  </span>
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

function shortTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}

function GuardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
      <span style={{ color: "var(--av-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--av-mono)" }}>{value}</span>
    </div>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="mb-3 flex items-center justify-between"
      style={{ borderBottom: "1.5px solid var(--av-bd)", paddingBottom: 8 }}
    >
      <span
        style={{
          fontFamily: "var(--av-mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--av-muted)",
        }}
      >
        {children}
      </span>
      {action}
    </div>
  );
}

function AvStat({
  label,
  value,
  caption,
  href,
}: {
  label: string;
  value: number;
  caption?: string;
  href?: string;
}) {
  const inner = (
    <div className="av-stat" style={{ height: "100%" }}>
      <div className="av-stat__label">{label}</div>
      <div className="av-stat__val">{value}</div>
      {caption && <div className="av-stat__delta">{caption}</div>}
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function NextActionCard({
  action,
  primary = false,
}: {
  action: NextAction;
  primary?: boolean;
}) {
  return (
    <Link
      href={action.href}
      className={`av-card${primary ? " av-card--raised" : ""}`}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div className="flex items-start gap-3.5" style={{ padding: primary ? 18 : "14px 16px" }}>
        <span style={{ width: 8, height: 8, marginTop: 6, background: "var(--av-accent)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span style={{ fontWeight: 700, fontSize: primary ? 16 : 14, letterSpacing: "-.01em" }}>
              {action.title}
            </span>
            <span style={{ fontFamily: "var(--av-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--av-accent)" }}>
              {action.priority}
            </span>
          </div>
          <p style={{ marginTop: 4, fontSize: 13, color: "var(--av-muted)", lineHeight: 1.45 }}>
            {action.reason}
          </p>
          <span
            className="mt-2.5 inline-flex items-center gap-1.5"
            style={{ fontFamily: "var(--av-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}
          >
            {action.cta} <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
