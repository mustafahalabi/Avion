import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ShieldCheck,
  GitBranch,
  GitPullRequest,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PriorityBadge, AdapterBadge, adapterLabel } from "@/components/ui/badge";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { StatusDot, isTaskStatus } from "@/components/ui/status-indicator";
import { TaskStatusSelect } from "./task-status-select";
import { TaskBriefSection } from "./task-brief-section";
import { ReviewBriefSection } from "./review-brief-section";
import { ExecutionResultForm } from "./execution-result-form";
import { ExecutionAuditTrail } from "./execution-audit-trail";
import { generateReviewBrief } from "@/lib/review-brief";
import { extractPlanningTaskPayload } from "@/lib/implementation-brief";
import { GithubWorkflowProgress } from "@/components/github-workflow-progress";
import { TaskRepositoryContextPanel } from "@/components/task-repository-context-panel";
import { buildGithubWorkflowPhaseStates } from "@/lib/github-workflow-status";
import {
  buildTaskRepositoryContext,
  pickTaskRepository,
} from "@/lib/task-repository-context";

interface Props {
  params: Promise<{ id: string }>;
}

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
  blocked: {
    label: "Blocked",
    icon: AlertCircle,
    className: "text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: Circle,
    className: "text-neutral-600",
  },
};

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  // Leaf select for a repository row (matches TaskRepositoryRow). Reused for the
  // project's explicit link and the workspace "first repo" fallback, on both the
  // direct project AND the feature's project.
  const repoFields = {
    id: true,
    name: true,
    url: true,
    primaryLanguage: true,
    frameworks: true,
    techStack: true,
    importantFiles: true,
    analysisStatus: true,
  } as const;
  const repoSourceSelect = {
    repository: { select: repoFields },
    workspace: {
      select: {
        repositories: {
          take: 1,
          orderBy: { updatedAt: "desc" as const },
          select: repoFields,
        },
      },
    },
  };

  const task = await prisma.task.findFirst({
    where: { id, companyId: company.id },
    include: {
      assignee: {
        select: { id: true, name: true, role: { select: { name: true } } },
      },
      // AI-planned tasks attach to a feature (no direct project), so the repo must
      // also be resolvable via the feature's project — otherwise the panel wrongly
      // reads "No repository attached" (see pickTaskRepository precedence).
      feature: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true, ...repoSourceSelect } },
        },
      },
      project: { select: { id: true, name: true, ...repoSourceSelect } },
      planningDraft: { select: { generatedTasks: true } },
    },
  });

  if (!task) notFound();

  // Fetch prepared session (for brief display), active session (for result ingestion),
  // and latest completed session (for branch/PR info display) in parallel.
  const [
    latestPreparedSession,
    activeSession,
    latestCompletedSession,
    latestSession,
    auditSession,
  ] = await Promise.all([
    // Latest prepared execution session — surfaces an existing brief without regenerating.
    prisma.executionSession.findFirst({
      where: { companyId: company.id, taskId: id, status: "prepared" },
      orderBy: { createdAt: "desc" },
      select: { taskBrief: true },
    }),
    // Latest active session (prepared or running) — shown when agent has the brief
    // but has not yet reported back.
    prisma.executionSession.findFirst({
      where: {
        companyId: company.id,
        taskId: id,
        status: { in: ["prepared", "running"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        branchName: true,
        baseBranch: true,
        commitSha: true,
        prUrl: true,
        prNumber: true,
        prStatus: true,
        mergeStatus: true,
      },
    }),
    // Latest completed session — surfaces branch/PR info and review brief data.
    prisma.executionSession.findFirst({
      where: {
        companyId: company.id,
        taskId: id,
        status: { in: ["completed", "failed", "needs_clarification"] },
      },
      orderBy: { completedAt: "desc" },
      select: {
        branchName: true,
        baseBranch: true,
        commitSha: true,
        prUrl: true,
        prNumber: true,
        prStatus: true,
        mergeStatus: true,
        resultSummary: true,
        filesChanged: true,
        validationOutput: true,
      },
    }),
    prisma.executionSession.findFirst({
      where: { companyId: company.id, taskId: id },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        branchName: true,
        baseBranch: true,
        prStatus: true,
        mergeStatus: true,
      },
    }),
    // Latest session with the fields needed for the CEO audit trail.
    prisma.executionSession.findFirst({
      where: { companyId: company.id, taskId: id },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        filesChanged: true,
        validationOutput: true,
        resultSummary: true,
        errorMessage: true,
        commitSha: true,
        prUrl: true,
        prNumber: true,
      },
    }),
  ]);

  // Generate review brief when a completed session exists.
  let reviewBrief: string | null = null;
  if (latestCompletedSession) {
    const taskPayload = extractPlanningTaskPayload(
      task.planningDraft?.generatedTasks ?? null,
      task.planItemId ?? null
    );
    const acceptanceCriteria: string[] =
      taskPayload?.acceptanceCriteria
        ? [...taskPayload.acceptanceCriteria]
        : task.description
        ? [task.description]
        : [];

    let filesChanged: string[] = [];
    try {
      filesChanged = JSON.parse(latestCompletedSession.filesChanged ?? "[]") as string[];
    } catch {
      filesChanged = [];
    }

    reviewBrief = generateReviewBrief({
      task: {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        acceptanceCriteria,
      },
      session: {
        resultSummary: latestCompletedSession.resultSummary ?? null,
        filesChanged,
        validationOutput: latestCompletedSession.validationOutput ?? null,
        branchName: latestCompletedSession.branchName ?? null,
        baseBranch: latestCompletedSession.baseBranch ?? null,
        commitSha: latestCompletedSession.commitSha ?? null,
        prUrl: latestCompletedSession.prUrl ?? null,
        prNumber: latestCompletedSession.prNumber ?? null,
        prStatus: latestCompletedSession.prStatus ?? null,
      },
    });
  }

  // Quality gate: find latest review and QA for this task
  const [latestReview, latestQA] = await Promise.all([
    prisma.review.findFirst({
      where: { companyId: company.id, entityType: "task", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.qAResult.findFirst({
      where: { companyId: company.id, entityType: "task", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Every session for this task → total time on task (a task may span retries /
  // rework), which agent ran each, and how long. The real duration is
  // completedAt − startedAt; a running session counts up to now.
  const allSessions = await prisma.executionSession.findMany({
    where: { companyId: company.id, taskId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      agentType: true,
      status: true,
      startedAt: true,
      completedAt: true,
    },
  });
  const nowMs = Date.now();
  const sessionSpanMs = (s: {
    startedAt: Date | null;
    completedAt: Date | null;
    status: string;
  }): number => {
    if (!s.startedAt) return 0;
    const end = s.completedAt
      ? s.completedAt.getTime()
      : s.status === "running"
      ? nowMs
      : s.startedAt.getTime();
    return Math.max(0, end - s.startedAt.getTime());
  };
  const totalActiveMs = allSessions.reduce((sum, s) => sum + sessionSpanMs(s), 0);
  const hasRunningSession = allSessions.some((s) => s.status === "running");
  // For a live-ticking total: bank the finished sessions' time, then let the
  // open session count up from its start. (Sessions are created atomically, so
  // at most one runs at a time — MUS-294.)
  const runningSession = allSessions.find(
    (s) => s.status === "running" && s.startedAt,
  );
  const bankedMs = allSessions
    .filter((s) => s.status !== "running")
    .reduce((sum, s) => sum + sessionSpanMs(s), 0);
  const latestAgentType =
    allSessions.length > 0 ? allSessions[allSessions.length - 1].agentType : null;

  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG["todo"];
  const Icon = cfg.icon;

  const attachedRepository = pickTaskRepository({
    projectRepository: task.project?.repository ?? null,
    featureProjectRepository: task.feature?.project?.repository ?? null,
    projectWorkspaceRepositories: task.project?.workspace?.repositories ?? null,
    featureProjectWorkspaceRepositories:
      task.feature?.project?.workspace?.repositories ?? null,
  });
  const repositoryContext = buildTaskRepositoryContext({
    taskId: task.id,
    taskTitle: task.title,
    branchName: latestSession?.branchName ?? null,
    baseBranch: latestSession?.baseBranch ?? null,
    repository: attachedRepository,
  });
  const workflowPhases = buildGithubWorkflowPhaseStates({
    taskStatus: task.status,
    sessionStatus: latestSession?.status ?? null,
    prStatus: latestSession?.prStatus ?? latestCompletedSession?.prStatus ?? null,
    mergeStatus:
      latestSession?.mergeStatus ?? latestCompletedSession?.mergeStatus ?? null,
    reviewStatus: latestReview?.status ?? null,
  });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        {(() => {
          const project = task.feature?.project ?? task.project;
          if (project) {
            return (
              <>
                <Link
                  href={`/work/projects/${project.id}`}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {project.name}
                </Link>
                <span className="text-neutral-700">/</span>
              </>
            );
          }
          return (
            <>
              <Link
                href="/work"
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Work
              </Link>
              <span className="text-neutral-700">/</span>
            </>
          );
        })()}
        <StatusDot
          status={isTaskStatus(task.status) ? task.status : "todo"}
          size="xs"
          className="shrink-0"
        />
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {task.title}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6">
        <section>
          <SectionLabel>GitHub Workflow</SectionLabel>
          <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-4">
            <GithubWorkflowProgress phases={workflowPhases} />
          </div>
        </section>

        {/* Time on task — total across sessions, which agent, and per-session spans */}
        {allSessions.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <SectionLabel>Time on task</SectionLabel>
              {latestAgentType && <AdapterBadge agentType={latestAgentType} />}
            </div>
            <div className="mt-3 border border-neutral-800 bg-neutral-900">
              <div className="flex items-end justify-between border-b border-neutral-800 px-4 py-3.5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    Total{hasRunningSession ? " so far" : ""} · {allSessions.length}{" "}
                    session{allSessions.length === 1 ? "" : "s"}
                  </p>
                  {runningSession?.startedAt ? (
                    <ElapsedTime
                      baseMs={bankedMs}
                      startedAt={runningSession.startedAt}
                      mode="clock"
                      className="mt-1 block text-2xl font-bold text-brand-400"
                    />
                  ) : (
                    <ElapsedTime
                      ms={totalActiveMs}
                      mode="clock"
                      className="mt-1 block text-2xl font-bold text-brand-400"
                    />
                  )}
                </div>
                {hasRunningSession && (
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-brand-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                    running
                  </span>
                )}
              </div>
              <ul>
                {allSessions.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 border-b border-neutral-800/60 px-4 py-2.5 last:border-b-0"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                      #{i + 1}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      {adapterLabel(s.agentType)}
                    </span>
                    <span className="text-xs capitalize text-neutral-500">
                      {s.status.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto">
                      {s.status === "running" && s.startedAt ? (
                        <ElapsedTime
                          startedAt={s.startedAt}
                          className="text-xs font-semibold text-brand-400"
                        />
                      ) : (
                        <ElapsedTime ms={sessionSpanMs(s)} className="text-xs text-neutral-400" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <TaskRepositoryContextPanel context={repositoryContext} />

        {/* Title + status */}
        <section className="flex items-start gap-3">
          <Icon
            className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.className)}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-neutral-100">
              {task.title}
            </h2>
            {task.feature && (
              <p className="mt-0.5 text-xs text-neutral-600">
                in {task.feature.title}
              </p>
            )}
          </div>
        </section>

        {/* Description */}
        {task.description && (
          <section>
            <SectionLabel>Description</SectionLabel>
            <p className="mt-2 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </section>
        )}

        {/* Details */}
        <section>
          <SectionLabel>Details</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DetailCard label="Status">
              <TaskStatusSelect taskId={task.id} current={task.status} />
            </DetailCard>
            <DetailCard label="Priority">
              <PriorityBadge priority={task.priority} />
            </DetailCard>
            <DetailCard label="Assignee">
              {task.assignee ? (
                <Link
                  href={`/company/employees/${task.assignee.id}`}
                  className="text-sm font-medium text-neutral-200 hover:text-neutral-100 transition-colors"
                >
                  {task.assignee.name}
                </Link>
              ) : (
                <span className="text-sm text-neutral-600">Unassigned</span>
              )}
            </DetailCard>
          </div>
        </section>

        {/* Branch & PR */}
        {(() => {
          const session = activeSession ?? latestCompletedSession;
          if (!session?.branchName) return null;
          const prStatusColors: Record<string, string> = {
            open: "text-emerald-400",
            merged: "text-neutral-400",
            closed: "text-neutral-500",
            draft: "text-neutral-500",
          };
          return (
            <section>
              <SectionLabel>Branch &amp; Pull Request</SectionLabel>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Branch
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-neutral-200 truncate">
                      {session.branchName}
                    </p>
                    {session.baseBranch && (
                      <p className="text-[11px] text-neutral-600">
                        from <span className="font-mono">{session.baseBranch}</span>
                      </p>
                    )}
                    {session.commitSha && (
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-600">
                        {session.commitSha.slice(0, 7)}
                      </p>
                    )}
                  </div>
                </div>
                {session.prUrl ? (
                  <a
                    href={session.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3 transition-colors hover:border-neutral-700"
                  >
                    <GitPullRequest
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        session.prStatus
                          ? (prStatusColors[session.prStatus] ?? "text-neutral-500")
                          : "text-neutral-500"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-200 truncate">
                        {session.prNumber ? `PR #${session.prNumber}` : "Pull Request"}
                      </p>
                      {session.prStatus && (
                        <p
                          className={cn(
                            "text-[11px] font-medium capitalize",
                            prStatusColors[session.prStatus] ?? "text-neutral-500"
                          )}
                        >
                          {session.prStatus}
                          {session.mergeStatus && session.mergeStatus !== "merged"
                            ? ` · ${session.mergeStatus}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
                    <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                    <p className="text-xs text-neutral-600">No pull request yet</p>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Execution audit trail (MUS-215) */}
        {auditSession && <ExecutionAuditTrail session={auditSession} />}

        {/* Quality gate */}
        {(latestReview || latestQA) && (
          <section>
            <SectionLabel>Quality</SectionLabel>
            <div className="mt-3 flex flex-col gap-2">
              {latestReview && (
                <Link
                  href={`/work/quality/${latestReview.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3 transition-colors hover:border-neutral-700"
                >
                  <ShieldCheck
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      latestReview.status === "approved"
                        ? "text-emerald-400"
                        : latestReview.status === "changes_requested"
                        ? "text-amber-400"
                        : "text-neutral-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-300">
                      Review: {latestReview.title}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] font-medium capitalize",
                        latestReview.status === "approved"
                          ? "text-emerald-400"
                          : latestReview.status === "changes_requested"
                          ? "text-amber-400"
                          : "text-neutral-600"
                      )}
                    >
                      {latestReview.status.replace(/_/g, " ")}
                    </p>
                  </div>
                </Link>
              )}
              {latestQA && (
                <Link
                  href={`/work/quality/qa/${latestQA.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3 transition-colors hover:border-neutral-700"
                >
                  <CheckCircle2
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      latestQA.status === "passed"
                        ? "text-emerald-400"
                        : latestQA.status === "failed"
                        ? "text-red-400"
                        : latestQA.status === "blocked"
                        ? "text-amber-400"
                        : "text-neutral-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-300">
                      QA Result
                    </p>
                    <p
                      className={cn(
                        "text-[11px] font-medium capitalize",
                        latestQA.status === "passed"
                          ? "text-emerald-400"
                          : latestQA.status === "failed"
                          ? "text-red-400"
                          : latestQA.status === "blocked"
                          ? "text-amber-400"
                          : "text-neutral-600"
                      )}
                    >
                      {latestQA.status.replace(/_/g, " ")}
                      {latestQA.passedCount + latestQA.failedCount > 0 &&
                        ` · ${latestQA.passedCount}/${latestQA.passedCount + latestQA.failedCount} checks`}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Claude Implementation Brief */}
        <TaskBriefSection
          taskId={task.id}
          taskStatus={task.status}
          existingBrief={latestPreparedSession?.taskBrief ?? null}
        />

        {/* Codex Review Brief */}
        {reviewBrief && <ReviewBriefSection brief={reviewBrief} />}

        {/* Execution Result Ingestion */}
        {activeSession && (
          <section>
            <SectionLabel>Record Execution Result</SectionLabel>
            <p className="mt-1 mb-3 text-xs text-neutral-600">
              Session{" "}
              <code className="rounded bg-neutral-800 px-1 text-neutral-500">
                {activeSession.status}
              </code>{" "}
              — paste the agent result when it completes.
            </p>
            <ExecutionResultForm sessionId={activeSession.id} taskId={task.id} />
          </section>
        )}

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </h3>
  );
}

function DetailCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
