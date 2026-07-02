import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import { setupTestSchema, teardownTestSchema } from "@/lib/test-utils/pg-test-db";

// The live pipeline stream must now carry task-scoped milestones (pr_merged,
// qa_passed, review_*), each tagged with its outcome ("workflow") id, so the
// conversation-scoped chat feed can filter live pushes to its own work (MUS-303).

let prisma: typeof PrismaSingleton;
let schema: string;
let loadLivePipeline: typeof import("./live-pipeline-data").loadLivePipeline;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("live-pipeline-stream"));
  ({ loadLivePipeline } = await import("./live-pipeline-data"));
  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  for (const table of ["TimelineEntry", "Task", "Outcome", "RuntimeRequest"]) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

describe("loadLivePipeline stream — task milestones", () => {
  it("folds in task timeline events tagged with their outcome workflowId", async () => {
    await prisma.runtimeRequest.create({
      data: { id: "req-1", companyId: "company-1", title: "Login", goal: "add login" },
    });
    await prisma.outcome.create({
      data: {
        id: "out-1",
        companyId: "company-1",
        runtimeRequestId: "req-1",
        title: "Login screen",
        rawRequest: "add login",
      },
    });
    await prisma.task.create({
      data: { id: "task-1", companyId: "company-1", title: "Build login", outcomeId: "out-1" },
    });
    await prisma.timelineEntry.create({
      data: {
        id: "tl-1",
        entityType: "task",
        entityId: "task-1",
        eventType: "pr_merged",
        summary: "Merged PR #12",
      },
    });

    const pipeline = await loadLivePipeline("company-1");
    const merged = pipeline.stream.find((s) => s.id === "task-tl-1");

    expect(merged).toBeDefined();
    expect(merged!.type).toBe("pr_merged");
    expect(merged!.description).toBe("Merged PR #12");
    expect(merged!.workflowId).toBe("out-1");
    expect(merged!.contextHref).toBe("/work/tasks/task-1");
  });
});
