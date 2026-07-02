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
  // A workspace + project so feature-completion tests can seed features.
  await prisma.workspace.create({
    data: { id: "workspace-1", name: "Main", slug: "main", companyId: "company-1" },
  });
  await prisma.project.create({
    data: {
      id: "project-1",
      name: "Platform",
      slug: "platform",
      companyId: "company-1",
      workspaceId: "workspace-1",
    },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Feature"`);
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

describe("evaluateOutcomeCompletionForTask — blocked escalation (MUS-297)", () => {
  it("escalates the outcome to blocked when a task is permanently blocked and the rest are settled", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["done", "blocked"]);

    const result = await service.evaluateOutcomeCompletionForTask("company-1", taskIds[1]);

    expect(result.completed).toBe(false);
    expect(result.reason).toMatch(/escalated to blocked/i);
    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("blocked");
    expect(outcome?.failureReason).toMatch(/permanently blocked/i);

    const timeline = await prisma.timelineEntry.findFirst({
      where: { entityId: outcomeId, eventType: "outcome_blocked" },
    });
    expect(timeline).not.toBeNull();
  });

  it("stays in_delivery (not blocked) while other tasks are still in flight", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["blocked", "in-progress"]);

    const result = await service.evaluateOutcomeCompletionForTask("company-1", taskIds[0]);

    expect(result.completed).toBe(false);
    expect(result.reason).toMatch(/unfinished task/i);
    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    expect(outcome?.status).toBe("in_delivery");
  });

  it("recovers: a blocked outcome completes once the blocked task is unblocked and done", async () => {
    const { outcomeId, taskIds } = await seedOutcomeWithTasks(["done", "blocked"]);
    await service.evaluateOutcomeCompletionForTask("company-1", taskIds[1]);
    expect(
      (await prisma.outcome.findUnique({ where: { id: outcomeId } }))?.status
    ).toBe("blocked");

    // CEO unblocks → the task is reworked to done.
    await prisma.task.update({ where: { id: taskIds[1] }, data: { status: "done" } });
    const result = await service.evaluateOutcomeCompletionForTask("company-1", taskIds[1]);

    expect(result.completed).toBe(true);
    expect(
      (await prisma.outcome.findUnique({ where: { id: outcomeId } }))?.status
    ).toBe("completed");
  });
});

describe("evaluateFeatureCompletionForTask (MUS-297)", () => {
  async function seedFeatureWithTasks(
    taskStatuses: readonly string[]
  ): Promise<{ featureId: string; taskIds: string[] }> {
    const feature = await prisma.feature.create({
      data: {
        title: "Login feature",
        companyId: "company-1",
        projectId: "project-1",
        status: "planned",
      },
    });
    const taskIds: string[] = [];
    for (const [index, status] of taskStatuses.entries()) {
      const task = await prisma.task.create({
        data: {
          title: `Feature task ${index + 1}`,
          companyId: "company-1",
          featureId: feature.id,
          status,
        },
      });
      taskIds.push(task.id);
    }
    return { featureId: feature.id, taskIds };
  }

  it("advances a feature to done when all its tasks are settled", async () => {
    const { featureId, taskIds } = await seedFeatureWithTasks(["done", "done", "cancelled"]);

    const result = await service.evaluateFeatureCompletionForTask("company-1", taskIds[0]);

    expect(result.advanced).toBe(true);
    const feature = await prisma.feature.findUnique({ where: { id: featureId } });
    expect(feature?.status).toBe("done");
    const timeline = await prisma.timelineEntry.findFirst({
      where: { entityId: featureId, eventType: "feature_completed" },
    });
    expect(timeline).not.toBeNull();
  });

  it("leaves a feature planned while a task is still open", async () => {
    const { featureId, taskIds } = await seedFeatureWithTasks(["done", "in-progress"]);

    const result = await service.evaluateFeatureCompletionForTask("company-1", taskIds[0]);

    expect(result.advanced).toBe(false);
    expect(
      (await prisma.feature.findUnique({ where: { id: featureId } }))?.status
    ).toBe("planned");
  });

  it("no-ops for a task with no feature", async () => {
    const { taskIds } = await seedOutcomeWithTasks(["done"]);
    const result = await service.evaluateFeatureCompletionForTask("company-1", taskIds[0]);
    expect(result.featureId).toBeNull();
    expect(result.advanced).toBe(false);
  });
});
