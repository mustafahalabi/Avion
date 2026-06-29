import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as GateModule from "./gate-advancement-service";

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof GateModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `gate-advancement-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./gate-advancement-service");

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
    CREATE TABLE IF NOT EXISTS "CompanySettings" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL UNIQUE,
      "autonomyLevel" TEXT NOT NULL DEFAULT 'assist',
      "cultureProfile" TEXT NOT NULL DEFAULT 'startup',
      "timezone" TEXT NOT NULL DEFAULT 'UTC',
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "locale" TEXT NOT NULL DEFAULT 'en',
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
      "status" TEXT NOT NULL DEFAULT 'todo',
      "priority" TEXT NOT NULL DEFAULT 'medium',
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
    CREATE TABLE IF NOT EXISTS "ExecutionSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "taskId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "resultSummary" TEXT,
      "filesChanged" TEXT NOT NULL DEFAULT '[]',
      "validationOutput" TEXT,
      "branchName" TEXT,
      "baseBranch" TEXT,
      "commitSha" TEXT,
      "prUrl" TEXT,
      "prNumber" INTEGER,
      "prStatus" TEXT,
      "completedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "CompanySettings" ("id","companyId","autonomyLevel","createdAt","updatedAt")
    VALUES ('settings-1','company-1','assist',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Task" ("id","title","description","companyId","status","createdAt","updatedAt")
    VALUES ('task-1','Add /health endpoint','Adds a health check','company-1','in-review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionSession" ("id","companyId","taskId","status","resultSummary","filesChanged","branchName","prUrl","completedAt","createdAt","updatedAt")
    VALUES ('ses-1','company-1','task-1','completed','Implemented /health','["src/health.ts"]','feature/task-1','https://github.com/x/y/pull/1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

beforeEach(async () => {
  await setAutonomy("assist");
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ChangeRequest"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
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

async function setAutonomy(level: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "CompanySettings" SET "autonomyLevel" = '${level}', "updatedAt" = CURRENT_TIMESTAMP WHERE "companyId" = 'company-1'`
  );
}

async function taskStatus(): Promise<string | undefined> {
  const t = await prisma.task.findUnique({
    where: { id: "task-1" },
    select: { status: true },
  });
  return t?.status;
}

describe("advanceTaskGates", () => {
  it("at high autonomy advances review → QA → done with recorded results", async () => {
    await setAutonomy("autonomous");

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("completed");
    expect(await taskStatus()).toBe("done");

    // No gate skipped: an approved review AND a passed QA both exist.
    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review?.status).toBe("approved");

    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(qa?.status).toBe("passed");
  });

  it("at delegate autonomy also completes both gates", async () => {
    await setAutonomy("delegate");
    const result = await service.advanceTaskGates("company-1", "task-1");
    expect(result.status).toBe("completed");
    expect(await taskStatus()).toBe("done");
  });

  it("at low autonomy halts at the review checkpoint (needs CEO action)", async () => {
    // assist (default) → auto_review requires approval.
    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("awaiting_review");
    // Task is NOT advanced past in-review and is certainly not done.
    expect(await taskStatus()).toBe("in-review");

    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review?.status).toBe("pending");
    // No QA was created or passed — the review gate was not skipped.
    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(qa).toBeNull();
  });

  it("at low autonomy with an approved review halts at the QA checkpoint", async () => {
    await prisma.review.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        title: "Review: task-1",
        status: "approved",
        verdict: "approved",
      },
    });
    await prisma.qAResult.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        status: "pending",
      },
    });

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("awaiting_qa");
    expect(await taskStatus()).toBe("in-review");

    // The QA checklist was attached for the human reviewer.
    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(qa?.status).toBe("pending");
    expect(qa?.checks).not.toBe("[]");
  });

  it("does nothing when the task is not in-review", async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "status" = 'todo' WHERE "id" = 'task-1'`
    );
    const result = await service.advanceTaskGates("company-1", "task-1");
    expect(result.status).toBe("not_in_review");
  });

  it("is idempotent — re-running after completion reports completed", async () => {
    await setAutonomy("autonomous");
    await service.advanceTaskGates("company-1", "task-1");

    const second = await service.advanceTaskGates("company-1", "task-1");
    expect(second.status).toBe("completed");
    expect(await taskStatus()).toBe("done");
  });

  it("emits a timeline event when requesting a review", async () => {
    await service.advanceTaskGates("company-1", "task-1");
    const events = await prisma.timelineEntry.findMany({
      where: { entityId: "task-1", eventType: "review_requested" },
    });
    expect(events.length).toBe(1);
  });
});
