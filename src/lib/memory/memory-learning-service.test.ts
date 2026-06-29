import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as LearningServiceModule from "./memory-learning-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof LearningServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `memory-learning-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("../prisma");
  prisma = prismaModule.prisma;
  service = await import("./memory-learning-service");

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
      "updatedAt" DATETIME NOT NULL
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
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "MemoryRecord"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Memory"`);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SeedFinding {
  readonly severity: string;
  readonly description: string;
  readonly actionable?: boolean;
}

let reviewSeq = 0;

async function createReview(
  findings: readonly SeedFinding[],
  companyId = "company-1"
): Promise<string> {
  reviewSeq += 1;
  const id = `review-${reviewSeq}`;
  const findingsJson = JSON.stringify(findings);
  await prisma.review.create({
    data: {
      id,
      companyId,
      title: `Review ${id}`,
      entityType: "task",
      entityId: `task-${reviewSeq}`,
      status: "approved",
      findings: findingsJson,
    },
  });
  return id;
}

const RECURRING: SeedFinding = {
  severity: "blocker",
  description: "Missing error handling on async calls",
  actionable: true,
};

const ONE_OFF: SeedFinding = {
  severity: "non_blocker",
  description: "Variable name could be clearer",
  actionable: false,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("promoteRecurringLessons", () => {
  it("promotes a finding recurring at the default threshold (3×) and not the one-off", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING, ONE_OFF]);
    await createReview([RECURRING]);

    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(1);

    const standards = await prisma.memory.findMany({
      where: { companyId: "company-1", category: "standards" },
      include: { records: true },
    });
    expect(standards).toHaveLength(1);
    expect(standards[0].title).toBe("Engineering standards (learned)");

    const records = standards[0].records;
    expect(records).toHaveLength(1);
    expect(records[0].content).toBe(
      "Recurring blocker finding (3×): Missing error handling on async calls. Treat as a standard to check proactively."
    );
    expect(records[0].confidence).toBe(0.9);
    expect(records[0].source).toMatch(/^learning:/);

    // The one-off finding (only 1 occurrence) was not promoted.
    expect(
      records.some((r) => r.content.includes("Variable name could be clearer"))
    ).toBe(false);
  });

  it("is idempotent across repeated runs", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING]);
    await createReview([RECURRING]);

    const first = await service.promoteRecurringLessons("company-1");
    expect(first.promoted).toBe(1);

    const second = await service.promoteRecurringLessons("company-1");
    expect(second.promoted).toBe(0);

    const recordCount = await prisma.memoryRecord.count();
    expect(recordCount).toBe(1);
  });

  it("does not promote a finding below the threshold", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING]);

    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(0);

    const recordCount = await prisma.memoryRecord.count();
    expect(recordCount).toBe(0);
  });

  it("respects a custom threshold", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING]);

    // Below default (3) but at custom threshold (2) — should promote.
    const result = await service.promoteRecurringLessons("company-1", {
      threshold: 2,
    });
    expect(result.promoted).toBe(1);

    const records = await prisma.memoryRecord.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].content).toBe(
      "Recurring blocker finding (2×): Missing error handling on async calls. Treat as a standard to check proactively."
    );
  });

  it("normalizes findings by lowercased description + severity", async () => {
    // Same finding with cosmetic case differences should collapse to one key.
    await createReview([{ severity: "blocker", description: "SQL injection risk" }]);
    await createReview([{ severity: "blocker", description: "sql injection risk" }]);
    await createReview([{ severity: "blocker", description: "  SQL Injection Risk  " }]);

    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(1);

    const records = await prisma.memoryRecord.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].content).toContain("(3×)");
  });

  it("treats differing severities as distinct findings", async () => {
    await createReview([{ severity: "blocker", description: "Same text" }]);
    await createReview([{ severity: "blocker", description: "Same text" }]);
    await createReview([{ severity: "non_blocker", description: "Same text" }]);

    // blocker:2 and non_blocker:1, neither reaches default threshold of 3.
    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(0);
  });

  it("returns 0 when the company has no reviews", async () => {
    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(0);
  });
});
