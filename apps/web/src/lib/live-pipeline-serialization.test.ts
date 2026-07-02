import { describe, expect, it } from "vitest";

import { buildLifecycleBoard, type WorkItemInput } from "./work-lifecycle";
import type { LiveNotification, LivePipeline } from "./live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";
import {
  parseLiveNotifications,
  parseLivePipeline,
  serializeLiveNotifications,
  serializeLivePipeline,
} from "./live-pipeline-serialization";

const task = (over: Partial<WorkItemInput>): WorkItemInput => ({
  id: "t1",
  title: "Login screen",
  kind: "task",
  href: "/work/tasks/t1",
  updatedAt: new Date("2026-06-30T12:00:00Z"),
  ...over,
});

const streamItem = (over: Partial<TimelineItem> = {}): TimelineItem => ({
  id: "e1",
  type: "executing",
  description: "Agent pushed feat/login",
  contextLabel: "Login",
  contextHref: "/inbox/requests/r1",
  createdAt: new Date("2026-06-30T11:59:00Z"),
  ...over,
});

const notification = (
  over: Partial<LiveNotification> = {}
): LiveNotification => ({
  id: "n1",
  title: "Decision needed: login approach",
  body: "Password or magic link?",
  type: "decision",
  priority: "high",
  entityType: "request",
  entityId: "r1",
  actionUrl: "/inbox/requests/r1",
  createdAt: new Date("2026-06-30T11:58:00Z"),
  ...over,
});

const pipeline = (): LivePipeline => ({
  board: buildLifecycleBoard([
    task({ id: "a", taskStatus: "in-progress", sessionStatus: "running" }),
    task({ id: "b", taskStatus: "in-review", prStatus: "open", prNumber: 12 }),
    task({ id: "c", taskStatus: "done", prStatus: "merged" }),
  ]),
  stream: [streamItem()],
  notifications: [notification()],
  unreadNotificationCount: 1,
});

describe("serializeLivePipeline / parseLivePipeline", () => {
  it("round-trips a pipeline, reviving Date fields as real Dates", () => {
    const original = pipeline();
    const revived = parseLivePipeline(serializeLivePipeline(original));

    // Structurally equal (Vitest compares Dates by value).
    expect(revived).toEqual(original);

    const item = revived.board.columns
      .flatMap((c) => c.items)
      .find((i) => i.id === "a")!;
    expect(item.updatedAt).toBeInstanceOf(Date);
    expect(item.updatedAt.getTime()).toBe(
      new Date("2026-06-30T12:00:00Z").getTime()
    );
    expect(revived.stream[0]!.createdAt).toBeInstanceOf(Date);
  });

  it("preserves derived board counts across the wire", () => {
    const revived = parseLivePipeline(serializeLivePipeline(pipeline()));
    expect(revived.board.activeCount).toBe(2); // building + review
    expect(revived.board.liveCount).toBe(1);
    expect(revived.board.stageCounts.done).toBe(1);
  });

  it("is deterministic — identical pipelines serialize identically", () => {
    expect(serializeLivePipeline(pipeline())).toBe(
      serializeLivePipeline(pipeline())
    );
  });

  it("changes the serialization when any item advances a stage", () => {
    const before = serializeLivePipeline(pipeline());
    const after = serializeLivePipeline({
      ...pipeline(),
      board: buildLifecycleBoard([
        // task "a" has moved running → in-review (building → review).
        task({ id: "a", taskStatus: "in-review", prStatus: "open" }),
        task({ id: "b", taskStatus: "in-review", prStatus: "open", prNumber: 12 }),
        task({ id: "c", taskStatus: "done", prStatus: "merged" }),
      ]),
    });
    expect(after).not.toBe(before);
  });

  it("round-trips notifications, reviving createdAt as a real Date", () => {
    const revived = parseLivePipeline(serializeLivePipeline(pipeline()));
    expect(revived.unreadNotificationCount).toBe(1);
    expect(revived.notifications).toHaveLength(1);
    const n = revived.notifications[0]!;
    expect(n.createdAt).toBeInstanceOf(Date);
    expect(n.createdAt.getTime()).toBe(
      new Date("2026-06-30T11:58:00Z").getTime()
    );
    expect(n.type).toBe("decision");
  });

  it("changes the serialization when a new notification arrives", () => {
    const before = serializeLivePipeline(pipeline());
    const after = serializeLivePipeline({
      ...pipeline(),
      notifications: [notification({ id: "n2" }), notification()],
      unreadNotificationCount: 2,
    });
    expect(after).not.toBe(before);
  });

  it("tolerates a board-only frame missing the notification fields", () => {
    // An older/board-only serialization won't carry the notification slice.
    const wire = JSON.stringify({
      board: buildLifecycleBoard([task({ id: "a" })]),
      stream: [],
    });
    const revived = parseLivePipeline(wire);
    expect(revived.notifications).toEqual([]);
    expect(revived.unreadNotificationCount).toBe(0);
  });
});

describe("serializeLiveNotifications / parseLiveNotifications", () => {
  it("round-trips the notifications-only payload", () => {
    const payload = {
      notifications: [notification(), notification({ id: "n2", type: "blocker" })],
      unreadNotificationCount: 5,
    };
    const revived = parseLiveNotifications(serializeLiveNotifications(payload));
    expect(revived.unreadNotificationCount).toBe(5);
    expect(revived.notifications).toHaveLength(2);
    expect(revived.notifications[0]!.createdAt).toBeInstanceOf(Date);
    expect(revived.notifications[1]!.type).toBe("blocker");
  });

  it("is deterministic for identical payloads (usable as a change signal)", () => {
    const payload = { notifications: [notification()], unreadNotificationCount: 1 };
    expect(serializeLiveNotifications(payload)).toBe(
      serializeLiveNotifications(payload)
    );
  });

  it("degrades a malformed frame to an empty payload", () => {
    const revived = parseLiveNotifications("{}");
    expect(revived.notifications).toEqual([]);
    expect(revived.unreadNotificationCount).toBe(0);
  });
});
