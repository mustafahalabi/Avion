import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as GateModule from "./task-status-gate";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let gate: typeof GateModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("task-status-gate"));
  gate = await import("./task-status-gate");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
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
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

async function seedApprovedReview(): Promise<void> {
  await prisma.review.create({
    data: {
      companyId: "company-1",
      title: "Review: feature X",
      entityType: "task",
      entityId: "task-1",
      status: "approved",
      verdict: "approved",
    },
  });
}

async function seedPassedQa(): Promise<void> {
  await prisma.qAResult.create({
    data: {
      companyId: "company-1",
      entityType: "task",
      entityId: "task-1",
      status: "passed",
    },
  });
}

describe("isValidTaskStatus", () => {
  it("accepts only the known statuses", () => {
    for (const status of gate.TASK_STATUSES) {
      expect(gate.isValidTaskStatus(status)).toBe(true);
    }
    expect(gate.isValidTaskStatus("done!")).toBe(false);
    expect(gate.isValidTaskStatus("shipped")).toBe(false);
    expect(gate.isValidTaskStatus("")).toBe(false);
  });
});

describe("evaluateTaskStatusChange", () => {
  it("rejects unknown statuses", async () => {
    const result = await gate.evaluateTaskStatusChange("company-1", "task-1", "bogus");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not a valid task status/);
  });

  it("allows workflow moves without gate evidence", async () => {
    for (const status of ["todo", "in-progress", "in-review", "blocked", "cancelled"]) {
      const result = await gate.evaluateTaskStatusChange("company-1", "task-1", status);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects done without any gate evidence", async () => {
    const result = await gate.evaluateTaskStatusChange("company-1", "task-1", "done");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/approved review and a passing QA/i);
  });

  it("rejects done with an approved review but no passing QA", async () => {
    await seedApprovedReview();
    const result = await gate.evaluateTaskStatusChange("company-1", "task-1", "done");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/passing QA/i);
  });

  it("rejects done with passing QA but no approved review", async () => {
    await seedPassedQa();
    const result = await gate.evaluateTaskStatusChange("company-1", "task-1", "done");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/approved review/i);
  });

  it("allows done when both gates have real evidence", async () => {
    await seedApprovedReview();
    await seedPassedQa();
    const result = await gate.evaluateTaskStatusChange("company-1", "task-1", "done");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("ignores another company's evidence (ownership scoped)", async () => {
    await prisma.user.create({ data: { id: "user-2", email: "other@acme.test" } });
    await prisma.company.create({
      data: { id: "company-2", name: "Other", slug: "other", ownerId: "user-2" },
    });
    await prisma.review.create({
      data: {
        companyId: "company-2",
        title: "Review",
        entityType: "task",
        entityId: "task-1",
        status: "approved",
      },
    });
    await prisma.qAResult.create({
      data: {
        companyId: "company-2",
        entityType: "task",
        entityId: "task-1",
        status: "passed",
      },
    });

    const result = await gate.evaluateTaskStatusChange("company-1", "task-1", "done");
    expect(result.allowed).toBe(false);
  });
});
