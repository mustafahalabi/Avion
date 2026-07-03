import { prisma } from "@/lib/prisma";
import {
  buildOutcomePlanningUrl,
  getPendingPlanningDrafts,
  getPlanningLifecycleTimeline,
} from "@/lib/outcome-planning-lifecycle";
import { buildLifecycleBoard, type LifecycleBoard, type WorkItemInput } from "@/lib/work-lifecycle";
import type { TimelineItem } from "@/components/timeline-entry";

/**
 * A single unread notification, folded into the live payload so a "needs-you"
 * event (decision / blocker / alert) can surface to the CEO the moment it's
 * written — without a page load. Mirrors the `Notification` row's public fields;
 * `createdAt` is a real `Date` (revived across the wire like the board's dates).
 */
export interface LiveNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly type: string;
  readonly priority: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly actionUrl: string | null;
  readonly createdAt: Date;
}

/** The user-scoped notification slice of the live payload. */
export interface LiveNotificationsPayload {
  /** Recent unread notifications, newest first (capped). */
  readonly notifications: readonly LiveNotification[];
  /** True count of all unread notifications (may exceed the capped list). */
  readonly unreadNotificationCount: number;
}

/**
 * The full payload behind the Live view: the lifecycle board (work grouped by
 * stage), the recent activity stream, and — when loaded for a specific user —
 * that user's unread notifications. Both the dedicated `/work/live` page and the
 * Control Center widget render the board/stream from this, so the two never
 * drift; the notification fields power the app-wide live toast + unread badge.
 */
export interface LivePipeline extends LiveNotificationsPayload {
  readonly board: LifecycleBoard;
  readonly stream: readonly TimelineItem[];
}

export interface LoadLivePipelineOptions {
  /** Recent activity events to include in the live stream. Default 24. */
  readonly streamLimit?: number;
  /** Items listed in the terminal "done" column. Default 8. */
  readonly doneLimit?: number;
  /**
   * When provided, the caller's unread notifications are folded into the
   * payload (and into the change-detection hash). Omitted for board-only seeds
   * — those get an empty notification slice.
   */
  readonly userId?: string;
  /** Max unread notifications to include. Default {@link DEFAULT_NOTIFICATION_LIMIT}. */
  readonly notificationLimit?: number;
}

/** Default cap on unread notifications folded into the live payload. */
export const DEFAULT_NOTIFICATION_LIMIT = 20;

const EMPTY_NOTIFICATIONS: LiveNotificationsPayload = {
  notifications: [],
  unreadNotificationCount: 0,
};

/**
 * Loads a user's unread notifications and true unread count for the live
 * payload. Pure DB read, ordered newest-first and capped. Used both on its own
 * (the app-wide notifications-only SSE channel) and folded into
 * {@link loadLivePipeline}.
 */
export async function loadLiveNotifications(
  userId: string,
  limit: number = DEFAULT_NOTIFICATION_LIMIT
): Promise<LiveNotificationsPayload> {
  const [notifications, unreadNotificationCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        priority: true,
        entityType: true,
        entityId: true,
        actionUrl: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { notifications, unreadNotificationCount };
}

/** Tasks in these states never appear on the board. */
const HIDDEN_TASK_STATUSES: readonly string[] = ["cancelled"];

/** Fallback human label for a timeline event with no stored summary. */
function humanizeEventType(eventType: string): string {
  const spaced = eventType.replace(/[_.]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function parseFilesChangedCount(filesChanged: string | null | undefined): number {
  if (!filesChanged) return 0;
  try {
    const parsed = JSON.parse(filesChanged) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Picks the most-recent row per key from a list already ordered newest-first.
 */
function latestByKey<T>(rows: readonly T[], keyOf: (row: T) => string | null): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

/**
 * Loads and assembles the Live pipeline for a company.
 *
 * Tasks are joined in-memory with their latest execution session, code review,
 * and QA result, then mapped into pure {@link WorkItemInput}s and grouped into
 * the lifecycle board. Pending plan drafts are surfaced as upstream "planning"
 * items so the CEO sees a request the moment it lands — before any task exists.
 *
 * When `options.userId` is set, that user's unread notifications are folded in
 * so a single stream carries both the board and the "needs-you" events.
 *
 * @param companyId - The company to load.
 * @param options - Stream / done-column caps and optional notification scope.
 * @returns The board, the recent activity stream, and unread notifications.
 */
export async function loadLivePipeline(
  companyId: string,
  options: LoadLivePipelineOptions = {}
): Promise<LivePipeline> {
  const streamLimit = options.streamLimit ?? 24;
  const doneLimit = options.doneLimit ?? 8;
  const notificationLimit = options.notificationLimit ?? DEFAULT_NOTIFICATION_LIMIT;

  const tasks = await prisma.task.findMany({
    where: { companyId, status: { notIn: [...HIDDEN_TASK_STATUSES] } },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      assignee: { select: { name: true } },
      project: { select: { name: true } },
      feature: {
        select: { title: true, project: { select: { name: true } } },
      },
      // The outcome a task belongs to is its "workflow" on the Live graph —
      // directly for hand-seeded tasks, or via its plan for AI-planned ones.
      outcome: { select: { id: true, title: true } },
      planningDraft: { select: { outcome: { select: { id: true, title: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const taskIds = tasks.map((t) => t.id);

  const [
    sessions,
    reviews,
    qaResults,
    pendingPlans,
    runtimeEvents,
    planningTimeline,
    notificationsPayload,
    taskTimelineEvents,
  ] = await Promise.all([
      taskIds.length
        ? prisma.executionSession.findMany({
            where: { companyId, taskId: { in: taskIds } },
            orderBy: { createdAt: "desc" },
            select: {
              taskId: true,
              status: true,
              agentType: true,
              prStatus: true,
              prNumber: true,
              prUrl: true,
              mergeStatus: true,
              branchName: true,
              filesChanged: true,
              startedAt: true,
              completedAt: true,
            },
          })
        : Promise.resolve([]),
      taskIds.length
        ? prisma.review.findMany({
            where: { companyId, entityType: "task", entityId: { in: taskIds } },
            orderBy: { createdAt: "desc" },
            select: { entityId: true, status: true },
          })
        : Promise.resolve([]),
      taskIds.length
        ? prisma.qAResult.findMany({
            where: { companyId, entityType: "task", entityId: { in: taskIds } },
            orderBy: { createdAt: "desc" },
            select: {
              entityId: true,
              status: true,
              passedCount: true,
              failedCount: true,
            },
          })
        : Promise.resolve([]),
      getPendingPlanningDrafts(companyId),
      prisma.runtimeEvent.findMany({
        where: { request: { companyId } },
        orderBy: { createdAt: "desc" },
        take: streamLimit,
        include: { request: { select: { id: true, title: true } } },
      }),
      getPlanningLifecycleTimeline(companyId, streamLimit),
      options.userId
        ? loadLiveNotifications(options.userId, notificationLimit)
        : Promise.resolve(EMPTY_NOTIFICATIONS),
      taskIds.length
        ? prisma.timelineEntry.findMany({
            where: { entityType: "task", entityId: { in: taskIds } },
            orderBy: { createdAt: "desc" },
            take: streamLimit,
            select: {
              id: true,
              entityId: true,
              eventType: true,
              summary: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const sessionByTask = latestByKey(sessions, (s) => s.taskId);
  const reviewByTask = latestByKey(reviews, (r) => r.entityId);
  const qaByTask = latestByKey(qaResults, (q) => q.entityId);

  // Total time on task = sum of every session's active span (a task may have
  // several sessions from retries/rework). A still-running session counts up to
  // now; the live timer on the card ticks past this snapshot between pushes.
  const now = Date.now();
  const activeMsByTask = new Map<string, number>();
  for (const s of sessions) {
    if (!s.taskId || !s.startedAt) continue;
    const end = s.completedAt ? s.completedAt.getTime() : now;
    const span = Math.max(0, end - s.startedAt.getTime());
    activeMsByTask.set(s.taskId, (activeMsByTask.get(s.taskId) ?? 0) + span);
  }

  const taskInputs: WorkItemInput[] = tasks.map((t) => {
    const session = sessionByTask.get(t.id);
    const review = reviewByTask.get(t.id);
    const qa = qaByTask.get(t.id);
    const context =
      t.project?.name ?? t.feature?.project?.name ?? t.feature?.title ?? null;
    const workflow = t.outcome ?? t.planningDraft?.outcome ?? null;

    return {
      id: t.id,
      title: t.title,
      kind: "task",
      href: `/work/tasks/${t.id}`,
      updatedAt: t.updatedAt,
      context,
      workflowId: workflow?.id ?? null,
      workflowTitle: workflow?.title ?? null,
      assigneeName: t.assignee?.name ?? null,
      taskStatus: t.status,
      sessionStatus: session?.status ?? null,
      prStatus: session?.prStatus ?? null,
      prNumber: session?.prNumber ?? null,
      prUrl: session?.prUrl ?? null,
      mergeStatus: session?.mergeStatus ?? null,
      reviewStatus: review?.status ?? null,
      qaStatus: qa?.status ?? null,
      qaPassedCount: qa?.passedCount ?? null,
      qaFailedCount: qa?.failedCount ?? null,
      branchName: session?.branchName ?? null,
      filesChangedCount: parseFilesChangedCount(session?.filesChanged),
      agentType: session?.agentType ?? null,
      sessionStartedAt: session?.startedAt ?? null,
      sessionCompletedAt: session?.completedAt ?? null,
      totalActiveMs: activeMsByTask.get(t.id) ?? null,
    };
  });

  const planInputs: WorkItemInput[] = pendingPlans.map((p) => ({
    id: `plan-${p.planningDraftId}`,
    title: p.planTitle || p.outcomeTitle,
    kind: "plan",
    href: buildOutcomePlanningUrl(p.outcomeId),
    updatedAt: p.updatedAt,
    context: p.outcomeTitle,
    planStatus: p.status,
    workflowId: p.outcomeId,
    workflowTitle: p.outcomeTitle,
  }));

  const board = buildLifecycleBoard([...planInputs, ...taskInputs], { doneLimit });

  // Map each task to its outcome ("workflow") + title so task-scoped events can
  // be tagged and labelled for the conversation-scoped chat feed.
  const taskWorkflowById = new Map<string, string | null>();
  const taskTitleById = new Map<string, string>();
  for (const t of tasks) {
    const workflow = t.outcome ?? t.planningDraft?.outcome ?? null;
    taskWorkflowById.set(t.id, workflow?.id ?? null);
    taskTitleById.set(t.id, t.title);
  }

  const stream: TimelineItem[] = [
    ...runtimeEvents.map((event) => ({
      id: `runtime-${event.id}`,
      createdAt: event.createdAt,
      description: event.description,
      contextHref: `/inbox/requests/${event.request.id}`,
      contextLabel: event.request.title,
      type: event.type,
      workflowId: null,
    })),
    ...planningTimeline.map((event) => ({
      id: `planning-${event.id}`,
      createdAt: event.createdAt,
      description: event.summary,
      contextHref: event.href,
      contextLabel: event.outcomeTitle ?? "Outcome planning",
      type: event.eventType,
      workflowId: event.outcomeId,
    })),
    // Task-scoped milestones (pr_merged, qa_passed, review_approved, …) —
    // previously excluded from the timeline; surfaced here so the chat can show
    // work streaming through build → PR → review → QA → merge.
    ...taskTimelineEvents.map((event) => ({
      id: `task-${event.id}`,
      createdAt: event.createdAt,
      description: event.summary ?? humanizeEventType(event.eventType),
      contextHref: `/work/tasks/${event.entityId}`,
      contextLabel: taskTitleById.get(event.entityId) ?? "Task",
      type: event.eventType,
      workflowId: taskWorkflowById.get(event.entityId) ?? null,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, streamLimit);

  return {
    board,
    stream,
    notifications: notificationsPayload.notifications,
    unreadNotificationCount: notificationsPayload.unreadNotificationCount,
  };
}
