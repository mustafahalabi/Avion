import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as MemoryIngestionServiceModule from "./memory-ingestion-service";
import { setupTestSchema, teardownTestSchema } from "../test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof MemoryIngestionServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("memory-ingestion-service"));
  service = await import("./memory-ingestion-service");

  // Owner Users are required by the Company.ownerId foreign key (Postgres
  // enforces FKs, unlike the old SQLite test tables).
  await prisma.user.createMany({
    data: [
      { id: "user-1", email: "owner1@acme.test" },
      { id: "user-2", email: "owner2@other.test" },
    ],
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

async function seedSignals() {
  const findings = JSON.stringify([
    { severity: "blocker", description: "Add input validation on the API", actionable: true },
    { severity: "non_blocker", description: "Nit: rename helper", actionable: false },
  ]);

  await prisma.review.create({
    data: {
      id: "review-1",
      companyId: "company-1",
      title: "Review: feature X",
      entityType: "task",
      entityId: "task-1",
      status: "approved",
      verdict: "approved",
      notes: "Looks solid overall.",
      findings,
    },
  });

  await prisma.qAResult.create({
    data: {
      id: "qa-1",
      companyId: "company-1",
      entityType: "task",
      entityId: "task-1",
      status: "failed",
      passedCount: 2,
      failedCount: 1,
      notes: "Login regression on mobile.",
      checks: "[]",
    },
  });

  await prisma.release.create({
    data: {
      id: "release-1",
      companyId: "company-1",
      version: "v1.0.0",
      title: "GA",
      releaseNotes: "Initial public release with subscriptions.",
      status: "released",
      deploymentStatus: "succeeded",
      releasedAt: new Date(),
    },
  });
}

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "MemoryRecord"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Memory"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Release"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("memory-ingestion-service", () => {
  describe("ingestCompanyMemory", () => {
    it("writes one durable record per completed review, terminal QA, and shipped release", async () => {
      await seedSignals();

      const result = await service.ingestCompanyMemory("company-1");

      expect(result).toEqual({ written: 3, reviews: 1, qa: 1, releases: 1 });

      const records = await prisma.memoryRecord.findMany({
        select: {
          source: true,
          content: true,
          memory: { select: { category: true, title: true } },
        },
        orderBy: { source: "asc" },
      });
      expect(records).toHaveLength(3);

      const bySource = new Map(records.map((r) => [r.source, r]));

      const review = bySource.get("review:review-1");
      expect(review?.memory.category).toBe("review");
      expect(review?.memory.title).toBe("Review lessons");
      expect(review?.content).toContain("Add input validation on the API");

      const qa = bySource.get("qa:qa-1");
      expect(qa?.memory.category).toBe("qa");
      expect(qa?.memory.title).toBe("QA lessons");
      expect(qa?.content).toContain("2 passed, 1 failed");

      const release = bySource.get("release:release-1");
      expect(release?.memory.category).toBe("release");
      expect(release?.memory.title).toBe("Release lessons");
      expect(release?.content).toContain("v1.0.0");
    });

    it("is idempotent — a second run creates no new records", async () => {
      await seedSignals();

      const first = await service.ingestCompanyMemory("company-1");
      expect(first.written).toBe(3);

      const second = await service.ingestCompanyMemory("company-1");
      expect(second).toEqual({ written: 0, reviews: 0, qa: 0, releases: 0 });

      const records = await prisma.memoryRecord.findMany();
      expect(records).toHaveLength(3);

      const banks = await prisma.memory.findMany({ where: { companyId: "company-1" } });
      expect(banks).toHaveLength(3);
    });

    it("ignores pending reviews, pending QA, and unreleased releases", async () => {
      await prisma.review.create({
        data: {
          id: "review-pending",
          companyId: "company-1",
          title: "Pending review",
          entityType: "task",
          entityId: "task-2",
          status: "pending",
        },
      });
      await prisma.qAResult.create({
        data: {
          id: "qa-pending",
          companyId: "company-1",
          entityType: "task",
          entityId: "task-2",
          status: "pending",
          passedCount: 0,
          failedCount: 0,
          checks: "[]",
        },
      });
      await prisma.release.create({
        data: {
          id: "release-draft",
          companyId: "company-1",
          version: "v2.0.0-rc1",
          status: "draft",
          deploymentStatus: "not_started",
        },
      });

      const result = await service.ingestCompanyMemory("company-1");
      expect(result).toEqual({ written: 0, reviews: 0, qa: 0, releases: 0 });

      const records = await prisma.memoryRecord.findMany();
      expect(records).toHaveLength(0);
    });

    it("scopes ingestion to the requested company", async () => {
      await prisma.company.create({
        data: { id: "company-2", name: "Other", slug: "other", ownerId: "user-2" },
      });
      await seedSignals();

      const result = await service.ingestCompanyMemory("company-2");
      expect(result).toEqual({ written: 0, reviews: 0, qa: 0, releases: 0 });

      const records = await prisma.memoryRecord.findMany();
      expect(records).toHaveLength(0);

      await prisma.company.delete({ where: { id: "company-2" } });
    });
  });
});
