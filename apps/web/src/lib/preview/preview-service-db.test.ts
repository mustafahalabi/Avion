import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "@/lib/prisma";
import type * as PreviewDbModule from "./preview-service-db";
import { setupTestSchema, teardownTestSchema } from "@/lib/test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let db: typeof PreviewDbModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  ({ prisma, schema } = await setupTestSchema("preview-service-db"));
  db = await import("./preview-service-db");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.workspace.create({
    data: { id: "ws-1", name: "Default", slug: "default", companyId: "company-1" },
  });
  await prisma.repository.create({
    data: { id: "repo-1", workspaceId: "ws-1", name: "app", url: "https://github.com/a/b" },
  });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "PreviewSession"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

function seed(overrides: Record<string, unknown> = {}) {
  return prisma.previewSession.create({
    data: {
      companyId: "company-1",
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      status: "queued",
      desiredState: "running",
      ...overrides,
    },
  });
}

describe("truncatePreviewLogs", () => {
  it("keeps the tail when over the cap", () => {
    const out = db.truncatePreviewLogs("abcdefgh", 3);
    expect(out).toContain("fgh");
    expect(out).toContain("truncated");
  });
  it("returns logs unchanged when under the cap", () => {
    expect(db.truncatePreviewLogs("abc", 10)).toBe("abc");
  });
});

describe("claimNextQueuedPreview", () => {
  it("claims the oldest queued preview and flips it to starting", async () => {
    const row = await seed();
    const claimed = await db.claimNextQueuedPreview({ host: "h:1", maxLifetimeSeconds: 3600 });

    expect(claimed?.id).toBe(row.id);
    expect(claimed?.status).toBe("starting");
    expect(claimed?.claimedByHost).toBe("h:1");
    expect(claimed?.startedAt).not.toBeNull();
    expect(claimed?.expiresAt).not.toBeNull();
  });

  it("only one of two concurrent claims wins the same row", async () => {
    await seed();
    const [a, b] = await Promise.all([
      db.claimNextQueuedPreview({ host: "h:1", maxLifetimeSeconds: 3600 }),
      db.claimNextQueuedPreview({ host: "h:2", maxLifetimeSeconds: 3600 }),
    ]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
  });

  it("returns null when nothing is queued", async () => {
    await seed({ status: "running" });
    const claimed = await db.claimNextQueuedPreview({ host: "h:1", maxLifetimeSeconds: 3600 });
    expect(claimed).toBeNull();
  });

  it("skips a superseded queued row (desiredState already stopped)", async () => {
    await seed({ status: "queued", desiredState: "stopped" });
    const claimed = await db.claimNextQueuedPreview({ host: "h:1", maxLifetimeSeconds: 3600 });
    expect(claimed).toBeNull();
  });
});

describe("reconcileOrphansOnStartup", () => {
  it("stops previews left active by a dead service and leaves terminal rows alone", async () => {
    const running = await seed({ status: "running", pid: null });
    const starting = await seed({ status: "starting", pid: null });
    const alreadyStopped = await seed({ status: "stopped" });

    const count = await db.reconcileOrphansOnStartup();
    expect(count).toBe(2);

    const r = await prisma.previewSession.findUnique({ where: { id: running.id } });
    const s = await prisma.previewSession.findUnique({ where: { id: starting.id } });
    const done = await prisma.previewSession.findUnique({ where: { id: alreadyStopped.id } });

    expect(r?.status).toBe("stopped");
    expect(r?.errorMessage).toContain("orphaned");
    expect(s?.status).toBe("stopped");
    expect(done?.status).toBe("stopped"); // untouched (was already stopped)
    expect(done?.errorMessage).toBeNull();
  });
});

describe("occupiedPorts", () => {
  it("returns only ports held by active previews", async () => {
    await seed({ status: "running", port: 4100 });
    await seed({ status: "stopped", port: 4101 });
    const ports = await db.occupiedPorts();
    expect([...ports]).toEqual([4100]);
  });
});
