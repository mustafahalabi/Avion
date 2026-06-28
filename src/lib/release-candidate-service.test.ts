import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ReleaseCandidateServiceModule from "./release-candidate-service";

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof ReleaseCandidateServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `release-candidate-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./release-candidate-service");

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
    CREATE TABLE IF NOT EXISTS "ExecutionSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "taskId" TEXT,
      "projectId" TEXT,
      "repositoryId" TEXT,
      "employeeId" TEXT,
      "planningDraftId" TEXT,
      "agentType" TEXT NOT NULL DEFAULT 'claude_code',
      "status" TEXT NOT NULL DEFAULT 'queued',
      "taskBrief" TEXT,
      "resultSummary" TEXT,
      "filesChanged" TEXT NOT NULL DEFAULT '[]',
      "validationOutput" TEXT,
      "errorMessage" TEXT,
      "branchName" TEXT,
      "baseBranch" TEXT,
      "commitSha" TEXT,
      "prUrl" TEXT,
      "prNumber" INTEGER,
      "prStatus" TEXT,
      "mergeStatus" TEXT,
      "startedAt" DATETIME,
      "completedAt" DATETIME,
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
    INSERT INTO "Task" ("id","title","companyId","status","outcomeId","createdAt","updatedAt")
    VALUES ('task-eligible','Eligible task','company-1','done','outcome-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Task" ("id","title","companyId","status","createdAt","updatedAt")
    VALUES ('task-inprogress','In progress task','company-1','in-progress',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Task" ("id","title","companyId","status","createdAt","updatedAt")
    VALUES ('task-no-qa','Done without QA','company-1','done',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Review" ("id","companyId","title","entityType","entityId","status","verdict","createdAt","updatedAt")
    VALUES ('review-eligible','company-1','Review eligible','task','task-eligible','approved','approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Review" ("id","companyId","title","entityType","entityId","status","verdict","createdAt","updatedAt")
    VALUES ('review-no-qa','company-1','Review no QA','task','task-no-qa','approved','approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "QAResult" ("id","companyId","entityType","entityId","status","passedCount","failedCount","checks","createdAt","updatedAt")
    VALUES ('qa-eligible','company-1','task','task-eligible','passed',3,0,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionSession" ("id","companyId","taskId","status","branchName","baseBranch","prUrl","prNumber","prStatus","validationOutput","filesChanged","completedAt","createdAt","updatedAt")
    VALUES ('session-1','company-1','task-eligible','completed','feature/task-eligible','master','https://github.com/org/repo/pull/42',42,'open','482 tests passed','["src/a.ts"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Release"`);
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

describe("release-candidate-service", () => {
  describe("assessTaskReleaseEligibility", () => {
    it("returns eligible for done task with approved review and passed QA", async () => {
      const result = await service.assessTaskReleaseEligibility("company-1", "task-eligible");
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it("rejects in-progress tasks", async () => {
      const result = await service.assessTaskReleaseEligibility("company-1", "task-inprogress");
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/done/i);
    });

    it("rejects done tasks without passed QA", async () => {
      const result = await service.assessTaskReleaseEligibility("company-1", "task-no-qa");
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/passed QA/i);
    });

    it("rejects unknown tasks", async () => {
      const result = await service.assessTaskReleaseEligibility("company-1", "missing");
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/not found/i);
    });
  });

  describe("createReleaseCandidate", () => {
    it("creates a release with eligible tasks and metadata", async () => {
      const result = await service.createReleaseCandidate({
        companyId: "company-1",
        version: "v2.0.0-rc1",
        title: "RC1",
        taskIds: ["task-eligible"],
      });

      expect(result.includedTaskIds).toEqual(["task-eligible"]);
      expect(result.rejectedTasks).toHaveLength(0);

      const release = await prisma.release.findUnique({ where: { id: result.releaseId } });
      expect(release?.version).toBe("v2.0.0-rc1");
      expect(release?.outcomeId).toBe("outcome-1");

      const taskIds = JSON.parse(release?.taskIds ?? "[]") as string[];
      expect(taskIds).toEqual(["task-eligible"]);

      const metadata = service.parseReleaseCandidateMetadata(release?.description);
      expect(metadata?.tasks).toHaveLength(1);
      expect(metadata?.tasks[0]?.prUrl).toBe("https://github.com/org/repo/pull/42");
      expect(metadata?.tasks[0]?.branchName).toBe("feature/task-eligible");
      expect(metadata?.validationEvidence.length).toBeGreaterThan(0);
    });

    it("rejects ineligible tasks with clear reasons while including eligible ones", async () => {
      const result = await service.createReleaseCandidate({
        companyId: "company-1",
        version: "v2.0.0-rc2",
        taskIds: ["task-eligible", "task-inprogress", "task-no-qa"],
      });

      expect(result.includedTaskIds).toEqual(["task-eligible"]);
      expect(result.rejectedTasks).toHaveLength(2);
      expect(result.rejectedTasks.some((r) => r.taskId === "task-inprogress")).toBe(true);
      expect(result.rejectedTasks.some((r) => r.taskId === "task-no-qa")).toBe(true);

      const release = await prisma.release.findUnique({ where: { id: result.releaseId } });
      const metadata = service.parseReleaseCandidateMetadata(release?.description);
      expect(metadata?.rejectedTasks).toHaveLength(2);
    });

    it("throws when all tasks are ineligible", async () => {
      await expect(
        service.createReleaseCandidate({
          companyId: "company-1",
          version: "v0.0.0",
          taskIds: ["task-inprogress", "task-no-qa"],
        })
      ).rejects.toThrow(/no eligible tasks/i);
    });

    it("creates a timeline entry", async () => {
      const result = await service.createReleaseCandidate({
        companyId: "company-1",
        version: "v2.0.0-rc3",
        taskIds: ["task-eligible"],
      });

      const entry = await prisma.timelineEntry.findUnique({
        where: { id: result.timelineEntryId },
      });
      expect(entry?.eventType).toBe("release_candidate_created");
    });
  });
});
