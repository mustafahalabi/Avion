import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as ApprovalsModule from "./approval-checkpoints";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof ApprovalsModule;

const CO = "appr-co";

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("approval-checkpoints"));
  service = await import("./approval-checkpoints");

  // Postgres enforces foreign keys (unlike the old hand-written SQLite tables):
  // Company.ownerId -> User.id, and Task/Review/QAResult.companyId -> Company.id.
  // Seed the owner User + Company once so the per-test children can reference them.
  await prisma.user.create({
    data: { id: "appr-owner", email: "owner@appr.test" },
  });
  await prisma.company.create({
    data: { id: CO, name: "Approvals Co", slug: "appr-co", ownerId: "appr-owner" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ChangeRequest"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

async function seedInReviewTaskWithPendingReview(taskId = "task-1") {
  await prisma.task.create({
    data: { id: taskId, companyId: CO, title: `Task ${taskId}`, status: "in-review" },
  });
  const review = await prisma.review.create({
    data: { companyId: CO, entityType: "task", entityId: taskId, title: "Review", status: "pending" },
  });
  return review;
}

async function taskStatus(id: string): Promise<string | undefined> {
  const t = await prisma.task.findUnique({ where: { id }, select: { status: true } });
  return t?.status;
}

describe("listPendingCheckpoints", () => {
  it("lists a pending review for an in-review task", async () => {
    const review = await seedInReviewTaskWithPendingReview();
    const list = await service.listPendingCheckpoints(CO);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "review", id: review.id, taskId: "task-1" });
    expect(list[0].taskTitle).toBe("Task task-1");
  });

  it("excludes checkpoints whose task is no longer in-review", async () => {
    await prisma.task.create({
      data: { id: "task-done", companyId: CO, title: "Done", status: "done" },
    });
    await prisma.review.create({
      data: { companyId: CO, entityType: "task", entityId: "task-done", title: "R", status: "pending" },
    });
    expect(await service.listPendingCheckpoints(CO)).toHaveLength(0);
  });

  it("lists pending QA checkpoints", async () => {
    await prisma.task.create({
      data: { id: "task-2", companyId: CO, title: "Task 2", status: "in-review" },
    });
    const qa = await prisma.qAResult.create({
      data: { companyId: CO, entityType: "task", entityId: "task-2", status: "pending" },
    });
    const list = await service.listPendingCheckpoints(CO);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "qa", id: qa.id, taskId: "task-2" });
  });

  it("scopes to the company", async () => {
    await seedInReviewTaskWithPendingReview();
    expect(await service.listPendingCheckpoints("other-co")).toHaveLength(0);
  });

  it("countPendingCheckpoints matches the list length", async () => {
    await seedInReviewTaskWithPendingReview();
    expect(await service.countPendingCheckpoints(CO)).toBe(1);
  });
});

describe("approveReviewCheckpoint", () => {
  it("approves the review and creates the pending QA step", async () => {
    const review = await seedInReviewTaskWithPendingReview();

    const result = await service.approveReviewCheckpoint(CO, review.id);
    expect(result.verdict).toBe("approved");

    const updated = await prisma.review.findUnique({ where: { id: review.id }, select: { status: true } });
    expect(updated?.status).toBe("approved");

    // The next checkpoint is now QA.
    const list = await service.listPendingCheckpoints(CO);
    expect(list.map((c) => c.kind)).toEqual(["qa"]);
    expect(await taskStatus("task-1")).toBe("in-review");
  });
});

describe("rejectReviewCheckpoint", () => {
  it("requests changes and sends the task back to implementation", async () => {
    const review = await seedInReviewTaskWithPendingReview();

    const result = await service.rejectReviewCheckpoint(CO, review.id);
    expect(result.verdict).toBe("changes_requested");
    expect(await taskStatus("task-1")).toBe("in-progress");
    // No longer an open checkpoint.
    expect(await service.listPendingCheckpoints(CO)).toHaveLength(0);
  });
});

describe("approveQaCheckpoint", () => {
  it("passes QA (marking checks) and completes the task", async () => {
    // Need an approved review for the same task, then a pending QA with unpassed checks.
    await prisma.task.create({
      data: { id: "task-3", companyId: CO, title: "Task 3", status: "in-review" },
    });
    await prisma.review.create({
      data: { companyId: CO, entityType: "task", entityId: "task-3", title: "R", status: "approved", verdict: "approved" },
    });
    const qa = await prisma.qAResult.create({
      data: {
        companyId: CO,
        entityType: "task",
        entityId: "task-3",
        status: "pending",
        checks: JSON.stringify([
          { label: "AC met", passed: false },
          { label: "tests pass", passed: false },
        ]),
      },
    });

    const result = await service.approveQaCheckpoint(CO, qa.id);
    expect(result.verdict).toBe("passed");
    expect(await taskStatus("task-3")).toBe("done");

    const updated = await prisma.qAResult.findUnique({ where: { id: qa.id }, select: { status: true } });
    expect(updated?.status).toBe("passed");
  });

  it("throws when the QA result does not exist", async () => {
    await expect(service.approveQaCheckpoint(CO, "missing")).rejects.toThrow(/not found/);
  });
});
