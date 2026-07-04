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

// Planning event type strings, mirrored from `outcome-planning-lifecycle.ts`
// (which imports Prisma and can't be pulled into the client bundle). Keep in
// sync with `OUTCOME_PLANNING_EVENT_TYPES` there.
/** The live "drafting your plan…" heartbeat event type. */
export const PLANNING_PROGRESS_EVENT_TYPE = "plan.progress";
/** Planning events that END the drafting phase. */
const PLANNING_TERMINAL_TYPES: readonly string[] = [
  "plan.generated",
  "plan.approved",
  "plan.rejected",
  "work.created",
  "plan.failed",
];

/** Live state of an outcome whose plan is being drafted right now (Goal 2). */
export interface PlanningActivityState {
  /** The outcome currently drafting a plan. */
  readonly outcomeId: string;
  /** Latest phase line to show (e.g. "Drafting your plan…"). */
  readonly phase: string;
  /** When the drafting started — powers the "alive" elapsed timer. */
  readonly since: Date;
}

/**
 * Derives which in-scope outcomes are actively drafting a plan, from the live
 * activity stream. An outcome is "drafting" when it has at least one
 * {@link PLANNING_PROGRESS_EVENT_TYPE} event and NO terminal planning event that
 * is at least as new as its latest progress event. The returned `phase` is the
 * newest progress line (so the indicator advances as phases arrive).
 *
 * @param activity - Conversation-scoped activity items (already merged).
 * @param outcomeIds - The conversation's outcome ids.
 * @returns One state per outcome still drafting.
 */
export function derivePlanningActivity(
  activity: readonly TimelineItem[],
  outcomeIds: Iterable<string>
): PlanningActivityState[] {
  const set = new Set(outcomeIds);
  const byOutcome = new Map<
    string,
    { progress: TimelineItem[]; terminalAt: number | null }
  >();

  for (const item of activity) {
    const oid = item.workflowId;
    if (!oid || !set.has(oid)) continue;
    const entry = byOutcome.get(oid) ?? { progress: [], terminalAt: null };
    if (item.type === PLANNING_PROGRESS_EVENT_TYPE) {
      entry.progress.push(item);
    } else if (PLANNING_TERMINAL_TYPES.includes(item.type)) {
      const t = item.createdAt.getTime();
      entry.terminalAt = entry.terminalAt == null ? t : Math.max(entry.terminalAt, t);
    }
    byOutcome.set(oid, entry);
  }

  const states: PlanningActivityState[] = [];
  for (const [oid, entry] of byOutcome) {
    if (entry.progress.length === 0) continue;
    const sorted = [...entry.progress].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const latest = sorted[sorted.length - 1];
    // Terminal event at/after the newest progress → drafting is done.
    if (entry.terminalAt != null && entry.terminalAt >= latest.createdAt.getTime()) {
      continue;
    }
    states.push({
      outcomeId: oid,
      phase: latest.description,
      since: sorted[0].createdAt,
    });
  }
  return states;
}

/**
 * Removes the live planning heartbeats from a stream, so they drive the live
 * indicator but never clutter the permanent chat feed.
 */
export function stripPlanningProgress(
  activity: readonly TimelineItem[]
): TimelineItem[] {
  return activity.filter((item) => item.type !== PLANNING_PROGRESS_EVENT_TYPE);
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
