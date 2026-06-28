import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as QaServiceModule from "./qa-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof QaServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `qa-service-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./qa-service");

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
    CREATE TABLE IF NOT EXISTS "Task" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "companyId" TEXT NOT NULL,
      "projectId" TEXT,
      "featureId" TEXT,
      "sprintId" TEXT,
      "assigneeId" TEXT,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'todo',
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "estimate" REAL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Task_companyId_id_key" ON "Task"("companyId", "id")`
  );

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
    CREATE TABLE IF NOT EXISTS "ChangeRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "reviewId" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "requestedBy" TEXT,
      "resolution" TEXT,
      "resolved" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ChangeRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CREATE TABLE IF NOT EXISTS "TimelineEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "summary" TEXT,
      "actorId" TEXT,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-2','Other','other','user-2',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Task" ("id","title","companyId","status","createdAt","updatedAt")
    VALUES ('task-1','Implement feature X','company-1','in-review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Review" ("id","companyId","title","entityType","entityId","status","verdict","createdAt","updatedAt")
    VALUES ('review-1','company-1','Review: feature X','task','task-1','approved','approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ChangeRequest"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "status" = 'in-review', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'task-1'`
  );
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

async function createQa(
  overrides: {
    companyId?: string;
    entityId?: string;
    status?: string;
    checks?: string;
  } = {}
) {
  const checks =
    overrides.checks ??
    JSON.stringify([
      { label: "AC met: user can sign in", passed: true },
      { label: "Validation passes: npm run test", passed: true },
    ]);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "QAResult" ("id","companyId","entityType","entityId","status","checks","passedCount","failedCount","createdAt","updatedAt")
    VALUES (
      'qa-1',
      '${overrides.companyId ?? "company-1"}',
      'task',
      '${overrides.entityId ?? "task-1"}',
      '${overrides.status ?? "pending"}',
      '${checks.replace(/'/g, "''")}',
      2,
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);
}

describe("qa-service", () => {
  describe("recordQaResult — passed", () => {
    it("sets QA status to passed and moves task to done", async () => {
      await createQa();
      await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "passed",
        notes: "All checks verified.",
      });

      const qa = await prisma.qAResult.findUnique({ where: { id: "qa-1" } });
      expect(qa?.status).toBe("passed");
      expect(qa?.notes).toBe("All checks verified.");

      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("done");
    });

    it("creates a timeline entry with qa_passed event type", async () => {
      await createQa();
      const result = await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "passed",
        notes: null,
      });

      const entry = await prisma.timelineEntry.findUnique({
        where: { id: result.timelineEntryId },
      });
      expect(entry?.eventType).toBe("qa_passed");
      expect(entry?.entityId).toBe("task-1");
    });

    it("blocks completion when required checks failed", async () => {
      await createQa({
        checks: JSON.stringify([
          { label: "AC met: user can sign in", passed: true },
          { label: "Validation passes: npm run test", passed: false },
        ]),
      });

      await expect(
        service.recordQaResult({
          companyId: "company-1",
          qaResultId: "qa-1",
          verdict: "passed",
          notes: null,
        })
      ).rejects.toThrow(/completion blocked/i);

      const qa = await prisma.qAResult.findUnique({ where: { id: "qa-1" } });
      expect(qa?.status).toBe("pending");

      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("in-review");
    });
  });

  describe("recordQaResult — failed", () => {
    it("sets QA status to failed and returns task to in-progress", async () => {
      await createQa();
      await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "failed",
        notes: "Login flow broken on mobile.",
        findings: [
          {
            severity: "blocker",
            description: "Mobile login fails",
            actionable: true,
          },
        ],
      });

      const qa = await prisma.qAResult.findUnique({ where: { id: "qa-1" } });
      expect(qa?.status).toBe("failed");

      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("in-progress");
    });

    it("creates actionable ChangeRequests from blocker findings", async () => {
      await createQa();
      const result = await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "failed",
        notes: "Two blockers found.",
        findings: [
          {
            severity: "blocker",
            description: "Regression in checkout",
            actionable: true,
          },
          {
            severity: "blocker",
            description: "Missing error state",
            actionable: true,
          },
        ],
      });

      expect(result.changeRequestIds).toHaveLength(2);
      const crs = await prisma.changeRequest.findMany({
        where: { reviewId: "review-1" },
      });
      expect(crs.every((cr) => cr.reason.startsWith("[QA]"))).toBe(true);
    });

    it("stores findings in checks JSON", async () => {
      await createQa();
      await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "failed",
        notes: null,
        findings: [
          {
            severity: "blocker",
            description: "Broken redirect",
            actionable: true,
          },
        ],
      });

      const qa = await prisma.qAResult.findUnique({ where: { id: "qa-1" } });
      const checks = JSON.parse(qa?.checks ?? "[]") as Array<{ label: string; passed: boolean }>;
      expect(checks.some((c) => c.label === "Broken redirect" && !c.passed)).toBe(true);
    });

    it("creates a timeline entry with qa_failed event type", async () => {
      await createQa();
      const result = await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "failed",
        notes: "Failed validation.",
      });

      const entry = await prisma.timelineEntry.findUnique({
        where: { id: result.timelineEntryId },
      });
      expect(entry?.eventType).toBe("qa_failed");
    });
  });

  describe("recordQaResult — blocked", () => {
    it("sets QA status to blocked and moves task to blocked", async () => {
      await createQa();
      await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "blocked",
        notes: "Staging environment unavailable.",
      });

      const qa = await prisma.qAResult.findUnique({ where: { id: "qa-1" } });
      expect(qa?.status).toBe("blocked");

      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("blocked");
    });

    it("creates a timeline entry with qa_blocked event type", async () => {
      await createQa();
      const result = await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "blocked",
        notes: null,
      });

      const entry = await prisma.timelineEntry.findUnique({
        where: { id: result.timelineEntryId },
      });
      expect(entry?.eventType).toBe("qa_blocked");
    });
  });

  describe("safety", () => {
    it("throws when QA result does not exist", async () => {
      await expect(
        service.recordQaResult({
          companyId: "company-1",
          qaResultId: "nonexistent",
          verdict: "passed",
          notes: null,
        })
      ).rejects.toThrow(/not found/i);
    });

    it("throws when QA result belongs to a different company", async () => {
      await createQa({ companyId: "company-1" });
      await expect(
        service.recordQaResult({
          companyId: "company-2",
          qaResultId: "qa-1",
          verdict: "passed",
          notes: null,
        })
      ).rejects.toThrow(/not found/i);
    });

    it("throws when QA result is already passed", async () => {
      await createQa({ status: "passed" });
      await expect(
        service.recordQaResult({
          companyId: "company-1",
          qaResultId: "qa-1",
          verdict: "failed",
          notes: "Too late.",
        })
      ).rejects.toThrow(/already passed/i);
    });
  });
});
