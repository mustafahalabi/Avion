import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import { setupTestSchema, teardownTestSchema } from "@/lib/test-utils/pg-test-db";

// Real-Postgres coverage for the notification slice of the live payload
// (MUS-302): the app-wide "needs-you" channel and the notifications folded into
// the full pipeline both read through `loadLiveNotifications` / `loadLivePipeline`.

let prisma: typeof PrismaSingleton;
let schema: string;
let loadLiveNotifications: typeof import("./live-pipeline-data").loadLiveNotifications;
let loadLivePipeline: typeof import("./live-pipeline-data").loadLivePipeline;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("live-notifications"));
  ({ loadLiveNotifications, loadLivePipeline } = await import(
    "./live-pipeline-data"
  ));

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.user.create({ data: { id: "user-2", email: "other@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "Notification"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

async function seedNotification(over: {
  id: string;
  userId?: string;
  type?: string;
  read?: boolean;
  createdAt?: Date;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      id: over.id,
      userId: over.userId ?? "user-1",
      title: `Notification ${over.id}`,
      type: over.type ?? "decision",
      read: over.read ?? false,
      createdAt: over.createdAt ?? new Date(),
    },
  });
}

describe("loadLiveNotifications", () => {
  it("returns only the caller's unread notifications, newest first", async () => {
    await seedNotification({ id: "a", createdAt: new Date("2026-07-01T10:00:00Z") });
    await seedNotification({ id: "b", createdAt: new Date("2026-07-02T10:00:00Z") });
    await seedNotification({ id: "c", read: true });
    await seedNotification({ id: "d", userId: "user-2" });

    const payload = await loadLiveNotifications("user-1");

    expect(payload.notifications.map((n) => n.id)).toEqual(["b", "a"]);
    expect(payload.unreadNotificationCount).toBe(2);
    expect(payload.notifications[0]!.createdAt).toBeInstanceOf(Date);
  });

  it("counts all unread even when the list is capped by the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await seedNotification({
        id: `n${i}`,
        createdAt: new Date(`2026-07-0${i + 1}T10:00:00Z`),
      });
    }

    const payload = await loadLiveNotifications("user-1", 2);

    expect(payload.notifications).toHaveLength(2);
    // True count reflects everything unread, not just the returned slice.
    expect(payload.unreadNotificationCount).toBe(5);
  });

  it("returns an empty payload for a user with no unread notifications", async () => {
    await seedNotification({ id: "read-1", read: true });

    const payload = await loadLiveNotifications("user-1");

    expect(payload.notifications).toEqual([]);
    expect(payload.unreadNotificationCount).toBe(0);
  });
});

describe("loadLivePipeline notification folding", () => {
  it("folds the caller's unread notifications into the pipeline when userId is set", async () => {
    await seedNotification({ id: "a", type: "blocker" });

    const withUser = await loadLivePipeline("company-1", { userId: "user-1" });
    expect(withUser.notifications.map((n) => n.id)).toEqual(["a"]);
    expect(withUser.unreadNotificationCount).toBe(1);
  });

  it("omits notifications for board-only seeds (no userId)", async () => {
    await seedNotification({ id: "a" });

    const boardOnly = await loadLivePipeline("company-1");
    expect(boardOnly.notifications).toEqual([]);
    expect(boardOnly.unreadNotificationCount).toBe(0);
  });
});
