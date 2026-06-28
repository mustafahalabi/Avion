import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ReviewServiceModule from "./review-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof ReviewServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `review-service-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./review-service");

  // Bootstrap schema
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

  // Seed
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
  try { rmSync(dbPath, { force: true }); } catch { /* ignore */ }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createReview(overrides: { companyId?: string; entityId?: string; status?: string } = {}) {
  return prisma.$executeRawUnsafe(`
    INSERT INTO "Review" ("id","companyId","title","entityType","entityId","status","createdAt","updatedAt")
    VALUES (
      'review-1',
      '${overrides.companyId ?? "company-1"}',
      'Review: Implement feature X',
      'task',
      '${overrides.entityId ?? "task-1"}',
      '${overrides.status ?? "pending"}',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("review-service", () => {
  // ── recordReviewResult — approved ─────────────────────────────────────────

  describe("recordReviewResult — approved", () => {
    it("sets review status to approved", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: "Looks good.",
      });
      const review = await prisma.review.findUnique({ where: { id: "review-1" } });
      expect(review?.status).toBe("approved");
      expect(review?.verdict).toBe("approved");
    });

    it("stores notes on the review", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: "LGTM.",
      });
      const review = await prisma.review.findUnique({ where: { id: "review-1" } });
      expect(review?.notes).toBe("LGTM.");
    });

    it("creates a pending QA result", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: null,
      });
      expect(result.qaResultId).not.toBeNull();
      const qa = await prisma.qAResult.findUnique({ where: { id: result.qaResultId! } });
      expect(qa?.status).toBe("pending");
      expect(qa?.entityId).toBe("task-1");
    });

    it("does not create ChangeRequests on approval", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: null,
      });
      expect(result.changeRequestIds).toHaveLength(0);
    });

    it("keeps task status at in-review", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: null,
      });
      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("in-review");
    });

    it("creates a timeline entry with review_approved event type", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: "Perfect.",
      });
      const entry = await prisma.timelineEntry.findUnique({ where: { id: result.timelineEntryId } });
      expect(entry?.eventType).toBe("review_approved");
      expect(entry?.entityId).toBe("task-1");
    });

    it("stores findings JSON on the review", async () => {
      await createReview();
      const findings = [{ severity: "non_blocker" as const, description: "Minor comment", actionable: false }];
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: null,
        findings,
      });
      const review = await prisma.review.findUnique({ where: { id: "review-1" } });
      const stored = JSON.parse(review?.findings ?? "[]") as unknown[];
      expect(stored).toHaveLength(1);
    });

    it("returns the correct output shape", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "approved",
        notes: null,
      });
      expect(result.reviewId).toBe("review-1");
      expect(result.verdict).toBe("approved");
      expect(result.taskId).toBe("task-1");
      expect(result.timelineEntryId).toBeTruthy();
    });
  });

  // ── recordReviewResult — changes_requested ────────────────────────────────

  describe("recordReviewResult — changes_requested", () => {
    it("sets review status to changes_requested", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "changes_requested",
        notes: "Fix the tests.",
      });
      const review = await prisma.review.findUnique({ where: { id: "review-1" } });
      expect(review?.status).toBe("changes_requested");
    });

    it("creates a ChangeRequest from notes when no findings", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "changes_requested",
        notes: "The implementation is incomplete.",
      });
      expect(result.changeRequestIds).toHaveLength(1);
      const cr = await prisma.changeRequest.findUnique({ where: { id: result.changeRequestIds[0] } });
      expect(cr?.reason).toBe("The implementation is incomplete.");
    });

    it("creates one ChangeRequest per blocker finding", async () => {
      await createReview();
      const findings = [
        { severity: "blocker" as const, description: "Blocker A", actionable: true },
        { severity: "blocker" as const, description: "Blocker B", actionable: true },
        { severity: "non_blocker" as const, description: "Minor C", actionable: false },
      ];
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "changes_requested",
        notes: "Two blockers.",
        findings,
      });
      // Only blocker findings create ChangeRequests
      expect(result.changeRequestIds).toHaveLength(2);
    });

    it("moves task back to in-progress", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "changes_requested",
        notes: "Needs work.",
      });
      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("in-progress");
    });

    it("does not create a QA result", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "changes_requested",
        notes: "Needs work.",
      });
      expect(result.qaResultId).toBeNull();
    });

    it("creates a timeline entry with review_changes_requested event type", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "changes_requested",
        notes: "Needs work.",
      });
      const entry = await prisma.timelineEntry.findUnique({ where: { id: result.timelineEntryId } });
      expect(entry?.eventType).toBe("review_changes_requested");
    });
  });

  // ── recordReviewResult — blocked ──────────────────────────────────────────

  describe("recordReviewResult — blocked", () => {
    it("sets review status to blocked", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "blocked",
        notes: "External dependency missing.",
      });
      const review = await prisma.review.findUnique({ where: { id: "review-1" } });
      expect(review?.status).toBe("blocked");
    });

    it("moves task to blocked status", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "blocked",
        notes: "Cannot review without credentials.",
      });
      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("blocked");
    });

    it("creates a timeline entry with review_blocked event type", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "blocked",
        notes: null,
      });
      const entry = await prisma.timelineEntry.findUnique({ where: { id: result.timelineEntryId } });
      expect(entry?.eventType).toBe("review_blocked");
    });

    it("does not create QA result or ChangeRequests", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "blocked",
        notes: null,
      });
      expect(result.qaResultId).toBeNull();
      expect(result.changeRequestIds).toHaveLength(0);
    });
  });

  // ── recordReviewResult — needs_clarification ──────────────────────────────

  describe("recordReviewResult — needs_clarification", () => {
    it("sets review status to needs_clarification", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "needs_clarification",
        notes: "Unclear what the expected behavior is.",
      });
      const review = await prisma.review.findUnique({ where: { id: "review-1" } });
      expect(review?.status).toBe("needs_clarification");
    });

    it("does not change task status", async () => {
      await createReview();
      await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "needs_clarification",
        notes: "Question raised.",
      });
      const task = await prisma.task.findUnique({ where: { id: "task-1" } });
      expect(task?.status).toBe("in-review");
    });

    it("creates a timeline entry with review_needs_clarification event type", async () => {
      await createReview();
      const result = await service.recordReviewResult({
        companyId: "company-1",
        reviewId: "review-1",
        verdict: "needs_clarification",
        notes: null,
      });
      const entry = await prisma.timelineEntry.findUnique({ where: { id: result.timelineEntryId } });
      expect(entry?.eventType).toBe("review_needs_clarification");
    });
  });

  // ── Safety / ownership ────────────────────────────────────────────────────

  describe("safety", () => {
    it("throws when review does not exist", async () => {
      await expect(
        service.recordReviewResult({
          companyId: "company-1",
          reviewId: "nonexistent",
          verdict: "approved",
          notes: null,
        })
      ).rejects.toThrow(/not found/i);
    });

    it("throws when review belongs to a different company", async () => {
      await createReview({ companyId: "company-1" });
      await expect(
        service.recordReviewResult({
          companyId: "company-2",
          reviewId: "review-1",
          verdict: "approved",
          notes: null,
        })
      ).rejects.toThrow(/not found/i);
    });

    it("throws when review is already approved", async () => {
      await createReview({ status: "approved" });
      await expect(
        service.recordReviewResult({
          companyId: "company-1",
          reviewId: "review-1",
          verdict: "changes_requested",
          notes: "Too late.",
        })
      ).rejects.toThrow(/already approved/i);
    });

    it("allows re-submission when review is in changes_requested state", async () => {
      await createReview({ status: "changes_requested" });
      await expect(
        service.recordReviewResult({
          companyId: "company-1",
          reviewId: "review-1",
          verdict: "approved",
          notes: "Fixed now.",
        })
      ).resolves.toBeDefined();
    });
  });
});
