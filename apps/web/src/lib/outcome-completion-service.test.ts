import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as CompletionModule from "./outcome-completion-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof CompletionModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("outcome-completion-service"));
  service = await import("./outcome-completion-service");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RuntimeEvent"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Outcome"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RuntimeRequest"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

async function seedOutcomeWithTasks(
  taskStatuses: readonly string[]
): Promise<{ outcomeId: string; taskIds: string[] }> {
  const request = await prisma.runtimeRequest.create({
    data: {
      companyId: "company-1",
      title: "Build login",
      goal: "Users can sign in.",
      requestType: "feature",
      status: "executing",
      assignedTo: "Product Manager",
    },
  });
  const outcome = await prisma.outcome.create({
    data: {
      companyId: "company-1",
      runtimeRequestId: request.id,
      title: "Build login",
      rawRequest: "Users can sign in.",
      status: "in_delivery",
    },
  });
  const taskIds: string[] = [];
  for (const [index, status] of taskStatuses.entries()) {
    const task = await prisma.task.create({
      data: {
        title: `Task ${index + 1}`,
        companyId: "company-1",
        outcomeId: outcome.id,
        status,
      },
    });
    taskIds.push(task.id);
  }
  return { outcomeId: outcome.id, taskIds };
}

describe("evaluateOutcomeCompletionForTask", () => {
  it("completes the outcome when its last task reaches done", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["done", "done", "cancelled"]);

    const result = await service.evaluateOutcomeCompletionForTask(
      "company-1",
      taskIds[0]
    );

    expect(result.completed).toBe(true);
    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("completed");
    expect(outcome?.completedAt).not.toBeNull();

    // The originating runtime request is completed too.
    const request = await prisma.runtimeRequest.findFirst({
      where: { companyId: "company-1" },
    });
    expect(request?.status).toBe("complete");

    const timeline = await prisma.timelineEntry.findFirst({
      where: { entityId: outcomeId, eventType: "outcome_completed" },
    });
    expect(timeline).not.toBeNull();
  });

  it("does nothing while the outcome still has open tasks", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["done", "in-progress"]);

    const result = await service.evaluateOutcomeCompletionForTask(
      "company-1",
      taskIds[0]
    );

    expect(result.completed).toBe(false);
    expect(result.reason).toMatch(/unfinished task/i);
    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("in_delivery");
    expect(outcome?.completedAt).toBeNull();
  });

  it("never completes an outcome whose tasks are all cancelled (nothing shipped)", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["cancelled", "cancelled"]);

    const result = await service.evaluateOutcomeCompletionForTask(
      "company-1",
      taskIds[0]
    );

    expect(result.completed).toBe(false);
    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("in_delivery");
  });

  it("does not touch outcomes already in a terminal status", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["done"]);
    await prisma.outcome.update({
      where: { id: outcomeId },
      data: { status: "released" },
    });

    const result = await service.evaluateOutcomeCompletionForTask(
      "company-1",
      taskIds[0]
    );

    expect(result.completed).toBe(false);
    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("released");
  });

  it("reports no outcome for tasks that trace to none", async () => {
    const task = await prisma.task.create({
      data: { title: "Orphan", companyId: "company-1", status: "done" },
    });

    const result = await service.evaluateOutcomeCompletionForTask("company-1", task.id);

    expect(result.outcomeId).toBeNull();
    expect(result.completed).toBe(false);
  });
});

describe("markOutcomeReleased", () => {
  it("moves the outcome to released with completedAt and a timeline entry", async () => {
    const { outcomeId } = await seedOutcomeWithTasks(["done"]);

    await service.markOutcomeReleased("company-1", outcomeId, "release-1");

    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("released");
    expect(outcome?.completedAt).not.toBeNull();

    const timeline = await prisma.timelineEntry.findFirst({
      where: { entityId: outcomeId, eventType: "outcome_released" },
    });
    expect(timeline).not.toBeNull();
  });

  it("is a no-op for another company's outcome", async () => {
    const { outcomeId } = await seedOutcomeWithTasks(["done"]);

    await service.markOutcomeReleased("company-other", outcomeId, "release-1");

    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("in_delivery");
  });
});
