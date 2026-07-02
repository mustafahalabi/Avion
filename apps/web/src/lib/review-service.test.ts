import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ReviewServiceModule from "./review-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof ReviewServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("review-service"));
  service = await import("./review-service");

  // Postgres enforces foreign keys (unlike the old SQLite test tables), so seed
  // parent rows first: User (Company.ownerId → User.id) → Company → Task.
  await prisma.user.create({ data: { id: "user-1", email: "owner1@acme.test" } });
  await prisma.user.create({ data: { id: "user-2", email: "owner2@other.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.company.create({
    data: { id: "company-2", name: "Other", slug: "other", ownerId: "user-2" },
  });
  await prisma.task.create({
    data: {
      id: "task-1",
      title: "Implement feature X",
      companyId: "company-1",
      status: "in-review",
    },
  });
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
  await teardownTestSchema(prisma, schema);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createReview(overrides: { companyId?: string; entityId?: string; status?: string } = {}) {
  return prisma.review.create({
    data: {
      id: "review-1",
      companyId: overrides.companyId ?? "company-1",
      title: "Review: Implement feature X",
      entityType: "task",
      entityId: overrides.entityId ?? "task-1",
      status: overrides.status ?? "pending",
    },
  });
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
