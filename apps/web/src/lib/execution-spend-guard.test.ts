import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as GuardModule from "./execution-spend-guard";
import type * as UsageServiceModule from "./agent-usage-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let guard: typeof GuardModule;
let usageService: typeof UsageServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("execution-spend-guard"));
  guard = await import("./execution-spend-guard");
  usageService = await import("./agent-usage-service");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

async function seed(): Promise<{ outcomeId: string; taskId: string }> {
  const outcome = await prisma.outcome.create({
    data: { companyId: "company-1", title: "Login", rawRequest: "add login", status: "in_delivery" },
  });
  const task = await prisma.task.create({
    data: { companyId: "company-1", title: "Build login", status: "todo", outcomeId: outcome.id },
  });
  return { outcomeId: outcome.id, taskId: task.id };
}

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "Notification"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "UsageRecord"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Outcome"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

const usage = (costUsd: number) => ({
  model: "m",
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  costUsd,
});

describe("enforceOutcomeSpendCeiling", () => {
  it("does not halt when there is no ceiling", async () => {
    const { taskId } = await seed();
    const result = await guard.enforceOutcomeSpendCeiling({
      companyId: "company-1",
      taskId,
      sessionId: "s1",
      companyCeilingSetting: null,
    });
    expect(result.halted).toBe(false);
  });

  it("does not halt while spend is under the ceiling", async () => {
    const { outcomeId, taskId } = await seed();
    await usageService.recordAgentUsage({
      companyId: "company-1",
      outcomeId,
      phase: "execution",
      provider: "claude_code",
      usage: usage(1),
    });
    const result = await guard.enforceOutcomeSpendCeiling({
      companyId: "company-1",
      taskId,
      sessionId: "s1",
      companyCeilingSetting: 5,
    });
    expect(result.halted).toBe(false);
    expect(result.spentUsd).toBeCloseTo(1);
  });

  it("halts, blocks the task + outcome, and notifies when the ceiling is reached", async () => {
    const { outcomeId, taskId } = await seed();
    await usageService.recordAgentUsage({
      companyId: "company-1",
      outcomeId,
      phase: "execution",
      provider: "claude_code",
      usage: usage(6),
    });

    const result = await guard.enforceOutcomeSpendCeiling({
      companyId: "company-1",
      taskId,
      sessionId: "s1",
      companyCeilingSetting: 5,
    });

    expect(result.halted).toBe(true);
    expect(result.reason).toContain("spend ceiling");

    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { status: true } });
    expect(task.status).toBe("blocked");
    const outcome = await prisma.outcome.findUniqueOrThrow({ where: { id: outcomeId }, select: { status: true } });
    expect(outcome.status).toBe("blocked");
    const notifications = await prisma.notification.findMany({
      where: { companyId: "company-1", type: "blocker", entityId: outcomeId },
    });
    expect(notifications).toHaveLength(1);
  });

  it("does not double-notify while an unread spend blocker exists", async () => {
    const { outcomeId, taskId } = await seed();
    await usageService.recordAgentUsage({
      companyId: "company-1",
      outcomeId,
      phase: "execution",
      provider: "claude_code",
      usage: usage(10),
    });

    await guard.enforceOutcomeSpendCeiling({
      companyId: "company-1",
      taskId,
      sessionId: "s1",
      companyCeilingSetting: 5,
    });
    await guard.enforceOutcomeSpendCeiling({
      companyId: "company-1",
      taskId,
      sessionId: "s2",
      companyCeilingSetting: 5,
    });

    const notifications = await prisma.notification.findMany({
      where: { companyId: "company-1", type: "blocker", entityId: outcomeId },
    });
    expect(notifications).toHaveLength(1);
  });
});
