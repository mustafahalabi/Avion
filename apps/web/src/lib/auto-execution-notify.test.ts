import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import { setupTestSchema, teardownTestSchema } from "@/lib/test-utils/pg-test-db";

// Real-Postgres coverage for the repository-blocked CEO notification (MUS-295):
// the driver hits the blocked path every tick, so the alert must be
// deduplicated to one unread notification per repo.

let prisma: typeof PrismaSingleton;
let schema: string;
let notifyRepositoryBlockedOnce: typeof import("./auto-execution-service").notifyRepositoryBlockedOnce;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("auto-execution-notify"));
  ({ notifyRepositoryBlockedOnce } = await import("./auto-execution-service"));
  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
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

describe("notifyRepositoryBlockedOnce (MUS-295)", () => {
  it("notifies the CEO on the first blocked tick and dedups the rest", async () => {
    await notifyRepositoryBlockedOnce("company-1", "repo-1", "blocked: no default branch");
    await notifyRepositoryBlockedOnce("company-1", "repo-1", "blocked: no default branch");
    await notifyRepositoryBlockedOnce("company-1", "repo-1", "blocked: no default branch");

    const notifications = await prisma.notification.findMany({
      where: { userId: "user-1", entityType: "repository", entityId: "repo-1" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("blocker");
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].actionUrl).toBe("/work/repositories/repo-1");
  });

  it("re-alerts once the CEO has cleared (read) the prior notification", async () => {
    await notifyRepositoryBlockedOnce("company-1", "repo-1", "blocked");
    await prisma.notification.updateMany({
      where: { userId: "user-1", entityType: "repository", entityId: "repo-1" },
      data: { read: true },
    });

    await notifyRepositoryBlockedOnce("company-1", "repo-1", "still blocked");

    const unread = await prisma.notification.findMany({
      where: { userId: "user-1", entityType: "repository", entityId: "repo-1", read: false },
    });
    expect(unread).toHaveLength(1);
  });

  it("falls back to the company entity + connections link when no repo is resolved", async () => {
    await notifyRepositoryBlockedOnce("company-1", null, "blocked: no repository configured");

    const n = await prisma.notification.findFirst({
      where: { userId: "user-1", entityType: "repository", entityId: "company-1" },
    });
    expect(n?.actionUrl).toBe("/connections");
  });
});
