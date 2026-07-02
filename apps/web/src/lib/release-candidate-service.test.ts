import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ReleaseCandidateServiceModule from "./release-candidate-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof ReleaseCandidateServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("release-candidate-service"));
  service = await import("./release-candidate-service");

  // Seed parent rows first — Postgres enforces the foreign keys that the old
  // hand-written SQLite tables did not.
  await prisma.user.create({
    data: { id: "user-1", email: "owner@acme.test" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  // Tasks/releases reference outcomeId via the (companyId, outcomeId) FK.
  await prisma.outcome.create({
    data: {
      id: "outcome-1",
      companyId: "company-1",
      title: "Outcome 1",
      rawRequest: "Build the thing",
    },
  });

  await prisma.task.create({
    data: {
      id: "task-eligible",
      title: "Eligible task",
      companyId: "company-1",
      status: "done",
      outcomeId: "outcome-1",
    },
  });
  await prisma.task.create({
    data: {
      id: "task-inprogress",
      title: "In progress task",
      companyId: "company-1",
      status: "in-progress",
    },
  });
  await prisma.task.create({
    data: {
      id: "task-no-qa",
      title: "Done without QA",
      companyId: "company-1",
      status: "done",
    },
  });

  await prisma.review.create({
    data: {
      id: "review-eligible",
      companyId: "company-1",
      title: "Review eligible",
      entityType: "task",
      entityId: "task-eligible",
      status: "approved",
      verdict: "approved",
    },
  });
  await prisma.review.create({
    data: {
      id: "review-no-qa",
      companyId: "company-1",
      title: "Review no QA",
      entityType: "task",
      entityId: "task-no-qa",
      status: "approved",
      verdict: "approved",
    },
  });

  await prisma.qAResult.create({
    data: {
      id: "qa-eligible",
      companyId: "company-1",
      entityType: "task",
      entityId: "task-eligible",
      status: "passed",
      passedCount: 3,
      failedCount: 0,
      checks: "[]",
    },
  });

  await prisma.executionSession.create({
    data: {
      id: "session-1",
      companyId: "company-1",
      taskId: "task-eligible",
      status: "completed",
      branchName: "feature/task-eligible",
      baseBranch: "master",
      prUrl: "https://github.com/org/repo/pull/42",
      prNumber: 42,
      prStatus: "open",
      validationOutput: "482 tests passed",
      filesChanged: '["src/a.ts"]',
      completedAt: new Date(),
    },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Release"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
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
