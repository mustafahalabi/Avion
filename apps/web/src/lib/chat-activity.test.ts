import { describe, expect, it } from "vitest";

import type { LiveNotification } from "@/lib/live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";
import {
  filterConversationDecisions,
  filterStreamToScope,
  mergeActivityById,
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
