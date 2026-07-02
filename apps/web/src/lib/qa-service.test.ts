import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as QaServiceModule from "./qa-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof QaServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("qa-service"));
  service = await import("./qa-service");

  // Postgres enforces foreign keys (the old SQLite test tables did not), so the
  // parent rows must exist before their children: User -> Company -> Task/Review.
  await prisma.user.create({
    data: { id: "user-1", email: "owner1@acme.test" },
  });
  await prisma.user.create({
    data: { id: "user-2", email: "owner2@other.test" },
  });
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
  await prisma.review.create({
    data: {
      id: "review-1",
      companyId: "company-1",
      title: "Review: feature X",
      entityType: "task",
      entityId: "task-1",
      status: "approved",
      verdict: "approved",
    },
  });
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
  await teardownTestSchema(prisma, schema);
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

  await prisma.qAResult.create({
    data: {
      id: "qa-1",
      companyId: overrides.companyId ?? "company-1",
      entityType: "task",
      entityId: overrides.entityId ?? "task-1",
      status: overrides.status ?? "pending",
      checks,
      passedCount: 2,
      failedCount: 0,
    },
  });
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

    it("resolves the task's open change requests when QA passes (rework loop)", async () => {
      // A prior QA failure left unresolved change requests on the approved review.
      await prisma.changeRequest.create({
        data: {
          reviewId: "review-1",
          reason: "[QA] Validation check failed: test",
          requestedBy: "QA",
        },
      });

      await createQa();
      await service.recordQaResult({
        companyId: "company-1",
        qaResultId: "qa-1",
        verdict: "passed",
        notes: "Re-validated after rework.",
      });

      const open = await prisma.changeRequest.findMany({
        where: { resolved: false, review: { entityId: "task-1" } },
      });
      expect(open).toHaveLength(0);
      const resolved = await prisma.changeRequest.findFirst({
        where: { reviewId: "review-1" },
      });
      expect(resolved?.resolved).toBe(true);
      expect(resolved?.resolution).toMatch(/QA .* passed/i);
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
