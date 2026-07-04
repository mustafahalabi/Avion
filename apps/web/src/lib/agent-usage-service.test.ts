import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as UsageServiceModule from "./agent-usage-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof UsageServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("agent-usage-service"));
  service = await import("./agent-usage-service");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.outcome.create({
    data: { id: "outcome-1", companyId: "company-1", title: "Login", rawRequest: "add login", status: "in_delivery" },
  });
  await prisma.outcome.create({
    data: { id: "outcome-2", companyId: "company-1", title: "Billing", rawRequest: "add billing", status: "in_delivery" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "UsageRecord"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

const usage = (costUsd: number, input = 10, output = 5) => ({
  model: "claude-opus-4-8",
  inputTokens: input,
  outputTokens: output,
  cachedInputTokens: 100,
  costUsd,
});

describe("recordAgentUsage + summarizeOutcomeUsage", () => {
  it("sums real spend across planning and execution samples for one outcome", async () => {
    await service.recordAgentUsage({
      companyId: "company-1",
      outcomeId: "outcome-1",
      phase: "planning",
      provider: "claude-cli",
      usage: usage(0.05),
    });
    await service.recordAgentUsage({
      companyId: "company-1",
      outcomeId: "outcome-1",
      taskId: "task-1",
      sessionId: "session-1",
      phase: "execution",
      provider: "claude_code",
      usage: usage(0.2, 100, 40),
    });

    const summary = await service.summarizeOutcomeUsage("company-1", "outcome-1");
    expect(summary.costUsd).toBeCloseTo(0.25);
    expect(summary.planningCostUsd).toBeCloseTo(0.05);
    expect(summary.executionCostUsd).toBeCloseTo(0.2);
    expect(summary.inputTokens).toBe(110);
    expect(summary.outputTokens).toBe(45);
    expect(summary.sampleCount).toBe(2);
  });

  it("returns a zero summary for an outcome with no usage", async () => {
    const summary = await service.summarizeOutcomeUsage("company-1", "outcome-2");
    expect(summary.costUsd).toBe(0);
    expect(summary.sampleCount).toBe(0);
  });

  it("summarizeOutcomeUsageMany totals each outcome in one query", async () => {
    await service.recordAgentUsage({
      companyId: "company-1",
      outcomeId: "outcome-1",
      phase: "execution",
      provider: "claude_code",
      usage: usage(1.0),
    });
    await service.recordAgentUsage({
      companyId: "company-1",
      outcomeId: "outcome-2",
      phase: "execution",
      provider: "claude_code",
      usage: usage(2.0),
    });

    const map = await service.summarizeOutcomeUsageMany("company-1", [
      "outcome-1",
      "outcome-2",
      "outcome-missing",
    ]);
    expect(map.get("outcome-1")?.costUsd).toBeCloseTo(1.0);
    expect(map.get("outcome-2")?.costUsd).toBeCloseTo(2.0);
    expect(map.get("outcome-missing")?.costUsd).toBe(0);
  });
});
