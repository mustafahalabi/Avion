import { describe, expect, it } from "vitest";

import type { LiveNotification } from "./live-pipeline-data";
import {
  isToastableNotification,
  surfaceNotifications,
} from "./live-notification-surfacing";

const notif = (over: Partial<LiveNotification> = {}): LiveNotification => ({
  id: "n1",
  title: "Something happened",
  body: null,
  type: "decision",
  priority: "high",
  entityType: "task",
  entityId: "t1",
  actionUrl: "/work/tasks/t1",
  createdAt: new Date("2026-07-02T12:00:00Z"),
  ...over,
});

describe("isToastableNotification", () => {
  it("toasts only needs-you types", () => {
    expect(isToastableNotification("decision")).toBe(true);
    expect(isToastableNotification("blocker")).toBe(true);
    expect(isToastableNotification("alert")).toBe(true);
    expect(isToastableNotification("info")).toBe(false);
    expect(isToastableNotification("progress")).toBe(false);
    expect(isToastableNotification("warning")).toBe(false);
  });
});

describe("surfaceNotifications", () => {
  it("raises a toast for a new toastable notification", () => {
    const { toasts, seenIds } = surfaceNotifications(
      [notif({ id: "a", type: "blocker" })],
      new Set()
    );
    expect(toasts.map((t) => t.id)).toEqual(["a"]);
    expect(seenIds.has("a")).toBe(true);
  });

  it("does not toast non-toastable types but still marks them seen", () => {
    const { toasts, seenIds } = surfaceNotifications(
      [notif({ id: "a", type: "info" }), notif({ id: "b", type: "progress" })],
      new Set()
    );
    expect(toasts).toHaveLength(0);
    expect(seenIds.has("a")).toBe(true);
    expect(seenIds.has("b")).toBe(true);
  });

  it("dedups — an already-seen notification is not re-toasted", () => {
    const first = surfaceNotifications(
      [notif({ id: "a", type: "decision" })],
      new Set()
    );
    expect(first.toasts).toHaveLength(1);

    // Same notification arrives again on the next frame (e.g. reconnect).
    const second = surfaceNotifications(
      [notif({ id: "a", type: "decision" })],
      first.seenIds
    );
    expect(second.toasts).toHaveLength(0);
    expect(second.seenIds.has("a")).toBe(true);
  });

  it("seeding seenIds suppresses toasts for pre-existing unread events", () => {
    const seed = new Set(["a"]);
    const { toasts } = surfaceNotifications(
      [notif({ id: "a", type: "decision" }), notif({ id: "b", type: "alert" })],
      seed
    );
    // 'a' was already shown on the server render; only 'b' is new.
    expect(toasts.map((t) => t.id)).toEqual(["b"]);
  });

  it("only surfaces the newly-arrived toastable items across frames", () => {
    const frame1 = surfaceNotifications(
      [notif({ id: "a", type: "decision" })],
      new Set()
    );
    const frame2 = surfaceNotifications(
      [
        notif({ id: "b", type: "blocker" }),
        notif({ id: "a", type: "decision" }),
        notif({ id: "c", type: "info" }),
      ],
      frame1.seenIds
    );
    expect(frame2.toasts.map((t) => t.id)).toEqual(["b"]);
    expect(frame2.seenIds.has("c")).toBe(true);
  });

  it("does not mutate the incoming seen set", () => {
    const seed = new Set(["x"]);
    surfaceNotifications([notif({ id: "y", type: "decision" })], seed);
    expect([...seed]).toEqual(["x"]);
  });
});
