import { describe, expect, it } from "vitest";

import type { LiveNotification } from "@/lib/live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";
import {
  derivePlanningActivity,
  filterConversationDecisions,
  filterStreamToScope,
  mergeActivityById,
  stripPlanningProgress,
  PLANNING_PROGRESS_EVENT_TYPE,
  type ConversationScope,
} from "./chat-activity";

const item = (over: Partial<TimelineItem> = {}): TimelineItem => ({
  id: "e1",
  type: "qa_passed",
  description: "QA passed 4/5",
  contextLabel: "Login",
  contextHref: "/work/tasks/t1",
  createdAt: new Date("2026-07-02T12:00:00Z"),
  workflowId: "o1",
  ...over,
});

const notif = (over: Partial<LiveNotification> = {}): LiveNotification => ({
  id: "n1",
  title: "Decision needed",
  body: null,
  type: "decision",
  priority: "high",
  entityType: "request",
  entityId: "r1",
  actionUrl: "/inbox/requests/r1",
  createdAt: new Date("2026-07-02T12:00:00Z"),
  ...over,
});

const scope: ConversationScope = {
  outcomeIds: ["o1"],
  taskIds: ["t1"],
  requestIds: ["r1"],
};

describe("filterStreamToScope", () => {
  it("keeps only events whose workflow is in scope", () => {
    const kept = filterStreamToScope(
      [
        item({ id: "a", workflowId: "o1" }),
        item({ id: "b", workflowId: "o2" }),
        item({ id: "c", workflowId: null }),
        item({ id: "d", workflowId: undefined }),
      ],
      scope.outcomeIds
    );
    expect(kept.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("mergeActivityById", () => {
  it("unions seed + live, dedups by id, sorts chronologically", () => {
    const seed = [
      item({ id: "a", createdAt: new Date("2026-07-02T10:00:00Z") }),
      item({ id: "b", createdAt: new Date("2026-07-02T11:00:00Z") }),
    ];
    const live = [
      item({ id: "b", createdAt: new Date("2026-07-02T11:00:00Z"), description: "fresher" }),
      item({ id: "c", createdAt: new Date("2026-07-02T12:00:00Z") }),
    ];
    const merged = mergeActivityById(seed, live);
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c"]);
    // The live copy of the shared id wins.
    expect(merged.find((i) => i.id === "b")!.description).toBe("fresher");
  });

  it("returns an empty array for empty inputs", () => {
    expect(mergeActivityById([], [])).toEqual([]);
  });
});

describe("filterConversationDecisions", () => {
  it("keeps request-scoped decisions/blockers for this conversation", () => {
    const kept = filterConversationDecisions(
      [
        notif({ id: "a", entityType: "request", entityId: "r1" }),
        notif({ id: "b", entityType: "request", entityId: "rX" }),
        notif({ id: "c", entityType: "task", entityId: "t1", type: "blocker" }),
      ],
      scope
    );
    expect(kept.map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("drops non-decision types and unscoped entities", () => {
    const kept = filterConversationDecisions(
      [
        notif({ id: "a", type: "info", entityType: "request", entityId: "r1" }),
        notif({ id: "b", type: "progress", entityType: "task", entityId: "t1" }),
        notif({ id: "c", type: "decision", entityType: "task", entityId: "tX" }),
        notif({ id: "d", type: "decision", entityType: "request", entityId: null }),
      ],
      scope
    );
    expect(kept).toHaveLength(0);
  });
});

const progress = (over: Partial<TimelineItem> = {}): TimelineItem =>
  item({ type: PLANNING_PROGRESS_EVENT_TYPE, ...over });

describe("derivePlanningActivity", () => {
  it("reports an outcome as drafting from its latest progress heartbeat", () => {
    const states = derivePlanningActivity(
      [
        progress({
          id: "p1",
          description: "Reviewing your request…",
          createdAt: new Date("2026-07-02T12:00:00Z"),
        }),
        progress({
          id: "p2",
          description: "Drafting your plan…",
          createdAt: new Date("2026-07-02T12:00:30Z"),
        }),
      ],
      scope.outcomeIds
    );
    expect(states).toHaveLength(1);
    // Latest phase wins (it advances) but `since` is the first heartbeat.
    expect(states[0]).toMatchObject({
      outcomeId: "o1",
      phase: "Drafting your plan…",
      since: new Date("2026-07-02T12:00:00Z"),
    });
  });

  it("stops drafting once a terminal planning event lands", () => {
    const states = derivePlanningActivity(
      [
        progress({ id: "p1", createdAt: new Date("2026-07-02T12:00:00Z") }),
        item({
          id: "g1",
          type: "plan.generated",
          description: "Plan ready",
          createdAt: new Date("2026-07-02T12:01:00Z"),
        }),
      ],
      scope.outcomeIds
    );
    expect(states).toHaveLength(0);
  });

  it("keeps drafting when a stale terminal precedes a fresh re-plan", () => {
    const states = derivePlanningActivity(
      [
        item({
          id: "g0",
          type: "plan.rejected",
          createdAt: new Date("2026-07-02T11:00:00Z"),
        }),
        progress({
          id: "p1",
          description: "Re-drafting…",
          createdAt: new Date("2026-07-02T12:00:00Z"),
        }),
      ],
      scope.outcomeIds
    );
    expect(states.map((s) => s.outcomeId)).toEqual(["o1"]);
    expect(states[0].phase).toBe("Re-drafting…");
  });

  it("ignores outcomes out of scope and those with no progress", () => {
    const states = derivePlanningActivity(
      [
        progress({ id: "p1", workflowId: "oX" }),
        item({ id: "q", type: "qa_passed", workflowId: "o1" }),
      ],
      scope.outcomeIds
    );
    expect(states).toHaveLength(0);
  });
});

describe("stripPlanningProgress", () => {
  it("removes only the planning heartbeats, keeping real activity", () => {
    const kept = stripPlanningProgress([
      progress({ id: "p1" }),
      item({ id: "a", type: "plan.generated" }),
      item({ id: "b", type: "pr_merged" }),
    ]);
    expect(kept.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
