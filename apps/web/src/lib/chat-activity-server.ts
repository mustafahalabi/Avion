/**
 * Conversation-scoped live activity for the chat surface (MUS-303) — DB layer.
 *
 * Server-only readers that resolve a conversation to its
 * {@link ConversationScope} and load the authoritative activity seed for the
 * thread. The pure filters the client applies to live pushes live in the
 * client-safe `chat-activity.ts`; this module imports Prisma and must never be
 * pulled into a client bundle.
 */

import { prisma } from "@/lib/prisma";
import type { ConversationScope } from "@/lib/chat-activity";
import type { TimelineItem } from "@/components/timeline-entry";

const EMPTY_SCOPE: ConversationScope = {
  outcomeIds: [],
  taskIds: [],
  requestIds: [],
};

/** Fallback human label for a timeline event with no stored summary. */
function humanizeEventType(eventType: string): string {
  const spaced = eventType.replace(/[_.]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Resolves a conversation to the outcome / task / request ids that scope its
 * live activity. Empty when the conversation has no request yet (a brand-new
 * thread before its first message becomes a request).
 */
export async function resolveConversationScope(
  companyId: string,
  conversationId: string
): Promise<ConversationScope> {
  const linked = await prisma.message.findMany({
    where: { conversationId, requestId: { not: null } },
    select: { requestId: true },
  });
  const requestIds = [
    ...new Set(
      linked.map((m) => m.requestId).filter((id): id is string => Boolean(id))
    ),
  ];
  if (requestIds.length === 0) return EMPTY_SCOPE;

  const outcomes = await prisma.outcome.findMany({
    where: { companyId, runtimeRequestId: { in: requestIds } },
    select: { id: true },
  });
  const outcomeIds = outcomes.map((o) => o.id);
  if (outcomeIds.length === 0) return { outcomeIds, taskIds: [], requestIds };

  const tasks = await prisma.task.findMany({
    where: {
      companyId,
      OR: [
        { outcomeId: { in: outcomeIds } },
        { planningDraft: { outcomeId: { in: outcomeIds } } },
      ],
    },
    select: { id: true },
  });

  return { outcomeIds, taskIds: tasks.map((t) => t.id), requestIds };
}

/**
 * Loads the authoritative activity seed for a conversation — its outcome,
 * planning-draft, and task timeline events — as {@link TimelineItem}s tagged
 * with their workflow (outcome) id, newest first. This is the complete thread
 * history (not starved by other outcomes competing for the company-wide
 * stream's cap); live pushes are merged on top client-side.
 */
export async function loadConversationActivity(
  companyId: string,
  scope: ConversationScope,
  limit = 40
): Promise<TimelineItem[]> {
  if (scope.outcomeIds.length === 0 && scope.taskIds.length === 0) return [];

  const [outcomes, drafts, tasks] = await Promise.all([
    prisma.outcome.findMany({
      where: { companyId, id: { in: [...scope.outcomeIds] } },
      select: { id: true, title: true },
    }),
    scope.outcomeIds.length
      ? prisma.planningDraft.findMany({
          where: { companyId, outcomeId: { in: [...scope.outcomeIds] } },
          select: { id: true, outcomeId: true },
        })
      : Promise.resolve([]),
    scope.taskIds.length
      ? prisma.task.findMany({
          where: { companyId, id: { in: [...scope.taskIds] } },
          select: {
            id: true,
            title: true,
            outcomeId: true,
            planningDraft: { select: { outcomeId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const outcomeTitleById = new Map(outcomes.map((o) => [o.id, o.title]));
  const draftOutcomeById = new Map(drafts.map((d) => [d.id, d.outcomeId]));
  const draftIds = drafts.map((d) => d.id);
  const taskTitleById = new Map(tasks.map((t) => [t.id, t.title]));
  const taskOutcomeById = new Map(
    tasks.map((t) => [t.id, t.outcomeId ?? t.planningDraft?.outcomeId ?? null])
  );

  const entries = await prisma.timelineEntry.findMany({
    where: {
      OR: [
        { entityType: "outcome", entityId: { in: [...scope.outcomeIds] } },
        { entityType: "planning_draft", entityId: { in: draftIds } },
        { entityType: "task", entityId: { in: [...scope.taskIds] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      eventType: true,
      summary: true,
      createdAt: true,
    },
  });

  return entries.map((entry) => {
    if (entry.entityType === "task") {
      const outcomeId = taskOutcomeById.get(entry.entityId) ?? null;
      return {
        id: `task-${entry.id}`,
        type: entry.eventType,
        description: entry.summary ?? humanizeEventType(entry.eventType),
        contextLabel: taskTitleById.get(entry.entityId) ?? "Task",
        contextHref: `/work/tasks/${entry.entityId}`,
        createdAt: entry.createdAt,
        workflowId: outcomeId,
      };
    }
    const outcomeId =
      entry.entityType === "outcome"
        ? entry.entityId
        : draftOutcomeById.get(entry.entityId) ?? null;
    return {
      id: `${entry.entityType}-${entry.id}`,
      type: entry.eventType,
      description: entry.summary ?? humanizeEventType(entry.eventType),
      contextLabel: outcomeId
        ? outcomeTitleById.get(outcomeId) ?? "Outcome"
        : "Outcome",
      contextHref: outcomeId ? `/work/outcomes/${outcomeId}` : "/work/outcomes",
      createdAt: entry.createdAt,
      workflowId: outcomeId,
    };
  });
}
