/**
 * Conversation-scoped live activity for the chat surface (MUS-303) — pure layer.
 *
 * The chat thread reuses the company-wide Live SSE stream, but a CEO watching
 * one conversation only wants *that* outcome's work. This module holds the
 * scope type plus the pure filters the client uses to fold live pushes (stream
 * events + notifications) down to the conversation. It imports nothing
 * server-only, so the client bundle can use it directly. The DB readers that
 * produce a {@link ConversationScope} / seed live in `chat-activity-server.ts`.
 */

import type { LiveNotification } from "@/lib/live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";

/** The ids that make one conversation's work distinct from the rest. */
export interface ConversationScope {
  /** Outcomes born from this conversation's requests. */
  readonly outcomeIds: readonly string[];
  /** Tasks under those outcomes (directly or via their plan). */
  readonly taskIds: readonly string[];
  /** Runtime requests linked to this conversation's messages. */
  readonly requestIds: readonly string[];
}

/** Keeps only stream events belonging to one of the scope's outcomes. */
export function filterStreamToScope(
  stream: readonly TimelineItem[],
  outcomeIds: Iterable<string>
): TimelineItem[] {
  const set = new Set(outcomeIds);
  return stream.filter(
    (item) => item.workflowId != null && set.has(item.workflowId)
  );
}

/**
 * Unions a seed with live activity, deduped by id and sorted newest-last
 * (chronological, the order a chat reads top-to-bottom). The live copy of a
 * shared id wins (it's at least as fresh as the seed).
 */
export function mergeActivityById(
  seed: readonly TimelineItem[],
  live: readonly TimelineItem[]
): TimelineItem[] {
  const byId = new Map<string, TimelineItem>();
  for (const item of seed) byId.set(item.id, item);
  for (const item of live) byId.set(item.id, item);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/**
 * Keeps the "needs-you" notifications (decision / blocker) that belong to this
 * conversation — a request-scoped one for its requests, or a task-scoped one
 * for its tasks — so the interrupt lands inline in the right thread.
 */
export function filterConversationDecisions(
  notifications: readonly LiveNotification[],
  scope: ConversationScope
): LiveNotification[] {
  const requestIds = new Set(scope.requestIds);
  const taskIds = new Set(scope.taskIds);
  return notifications.filter((n) => {
    if (n.type !== "decision" && n.type !== "blocker") return false;
    if (!n.entityId) return false;
    if (n.entityType === "request") return requestIds.has(n.entityId);
    if (n.entityType === "task") return taskIds.has(n.entityId);
    return false;
  });
}
