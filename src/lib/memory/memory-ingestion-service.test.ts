import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as MemoryIngestionServiceModule from "./memory-ingestion-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof MemoryIngestionServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `memory-ingestion-service-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("../prisma");
  prisma = prismaModule.prisma;
  service = await import("./memory-ingestion-service");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Review" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "entityType" TEXT NOT NULL DEFAULT 'task',
      "entityId" TEXT NOT NULL,
      "reviewerId" TEXT,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "verdict" TEXT,
      "notes" TEXT,
      "changeRequestNotes" TEXT,
      "findings" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QAResult" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL DEFAULT 'task',
      "entityId" TEXT NOT NULL,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "passedCount" INTEGER NOT NULL DEFAULT 0,
      "failedCount" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT,
      "checks" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Release" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "version" TEXT NOT NULL,
      "title" TEXT,
      "description" TEXT,
      "releaseNotes" TEXT,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "deploymentStatus" TEXT NOT NULL DEFAULT 'not_started',
      "checklist" TEXT NOT NULL DEFAULT '[]',
      "taskIds" TEXT NOT NULL DEFAULT '[]',
      "rollbackPlan" TEXT,
      "postReleaseNotes" TEXT,
      "releasedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Memory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "summary" TEXT,
      "category" TEXT NOT NULL DEFAULT 'company',
      "ownerType" TEXT,
      "ownerId" TEXT,
      "tags" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Memory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MemoryRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "memoryId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "source" TEXT,
      "confidence" REAL NOT NULL DEFAULT 1.0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "MemoryRecord_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

async function seedSignals() {
  const findings = JSON.stringify([
    { severity: "blocker", description: "Add input validation on the API", actionable: true },
    { severity: "non_blocker", description: "Nit: rename helper", actionable: false },
  ]);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Review" ("id","companyId","title","entityType","entityId","status","verdict","notes","findings","createdAt","updatedAt")
    VALUES (
      'review-1','company-1','Review: feature X','task','task-1','approved','approved',
      'Looks solid overall.',
      '${findings.replace(/'/g, "''")}',
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "QAResult" ("id","companyId","entityType","entityId","status","passedCount","failedCount","notes","checks","createdAt","updatedAt")
    VALUES (
      'qa-1','company-1','task','task-1','failed',2,1,'Login regression on mobile.','[]',
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Release" ("id","companyId","version","title","releaseNotes","status","deploymentStatus","releasedAt","createdAt","updatedAt")
    VALUES (
      'release-1','company-1','v1.0.0','GA','Initial public release with subscriptions.','released','succeeded',
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
  `);
}

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "MemoryRecord"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Memory"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Release"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    rmSync(dbPath, { force: true });
  } catch {
    /* ignore */
  }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
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
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Review" ("id","companyId","title","entityType","entityId","status","createdAt","updatedAt")
        VALUES ('review-pending','company-1','Pending review','task','task-2','pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "QAResult" ("id","companyId","entityType","entityId","status","passedCount","failedCount","checks","createdAt","updatedAt")
        VALUES ('qa-pending','company-1','task','task-2','pending',0,0,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Release" ("id","companyId","version","status","deploymentStatus","createdAt","updatedAt")
        VALUES ('release-draft','company-1','v2.0.0-rc1','draft','not_started',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `);

      const result = await service.ingestCompanyMemory("company-1");
      expect(result).toEqual({ written: 0, reviews: 0, qa: 0, releases: 0 });

      const records = await prisma.memoryRecord.findMany();
      expect(records).toHaveLength(0);
    });

    it("scopes ingestion to the requested company", async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
        VALUES ('company-2','Other','other','user-2',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `);
      await seedSignals();

      const result = await service.ingestCompanyMemory("company-2");
      expect(result).toEqual({ written: 0, reviews: 0, qa: 0, releases: 0 });

      const records = await prisma.memoryRecord.findMany();
      expect(records).toHaveLength(0);

      await prisma.$executeRawUnsafe(`DELETE FROM "Company" WHERE "id" = 'company-2'`);
    });
  });
});
