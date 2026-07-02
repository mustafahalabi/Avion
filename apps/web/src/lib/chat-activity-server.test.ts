import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import { setupTestSchema, teardownTestSchema } from "@/lib/test-utils/pg-test-db";

// Real-Postgres coverage for the conversation-scoped activity readers (MUS-303):
// resolving a chat thread to its outcome/task/request ids and loading its
// authoritative activity seed.

let prisma: typeof PrismaSingleton;
let schema: string;
let resolveConversationScope: typeof import("./chat-activity-server").resolveConversationScope;
let loadConversationActivity: typeof import("./chat-activity-server").loadConversationActivity;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("chat-activity"));
  ({ resolveConversationScope, loadConversationActivity } = await import(
    "./chat-activity-server"
  ));
  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  for (const table of [
    "TimelineEntry",
    "Message",
    "Task",
    "PlanningDraft",
    "Outcome",
    "RuntimeRequest",
    "Conversation",
  ]) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

/** Seeds a conversation → request → outcome → task chain and returns its ids. */
async function seedConversation(suffix: string): Promise<{
  conversationId: string;
  requestId: string;
  outcomeId: string;
  taskId: string;
  draftTaskId: string;
}> {
  const conversationId = `conv-${suffix}`;
  const requestId = `req-${suffix}`;
  const outcomeId = `out-${suffix}`;
  const taskId = `task-${suffix}`;
  const draftTaskId = `dtask-${suffix}`;
  const draftId = `draft-${suffix}`;

  await prisma.conversation.create({
    data: { id: conversationId, companyId: "company-1", type: "chat" },
  });
  await prisma.runtimeRequest.create({
    data: { id: requestId, companyId: "company-1", title: `Goal ${suffix}`, goal: "do it" },
  });
  await prisma.outcome.create({
    data: {
      id: outcomeId,
      companyId: "company-1",
      runtimeRequestId: requestId,
      title: `Outcome ${suffix}`,
      rawRequest: "do it",
    },
  });
  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      type: "text",
      content: "build it",
      requestId,
    },
  });
  await prisma.task.create({
    data: { id: taskId, companyId: "company-1", title: `Task ${suffix}`, outcomeId },
  });
  // A task linked to the outcome only through its plan draft.
  await prisma.planningDraft.create({
    data: { id: draftId, companyId: "company-1", outcomeId, title: `Plan ${suffix}` },
  });
  await prisma.task.create({
    data: {
      id: draftTaskId,
      companyId: "company-1",
      title: `Draft task ${suffix}`,
      planningDraftId: draftId,
    },
  });
  return { conversationId, requestId, outcomeId, taskId, draftTaskId };
}

describe("resolveConversationScope", () => {
  it("resolves a conversation to its outcome / task / request ids", async () => {
    const a = await seedConversation("a");
    await seedConversation("b"); // an unrelated conversation

    const scope = await resolveConversationScope("company-1", a.conversationId);

    expect(scope.requestIds).toEqual([a.requestId]);
    expect(scope.outcomeIds).toEqual([a.outcomeId]);
    // Both the direct-outcome task and the plan-draft task belong to the scope.
    expect([...scope.taskIds].sort()).toEqual([a.draftTaskId, a.taskId].sort());
  });

  it("returns an empty scope for a conversation with no linked request", async () => {
    await prisma.conversation.create({
      data: { id: "conv-empty", companyId: "company-1", type: "chat" },
    });
    await prisma.message.create({
      data: { conversationId: "conv-empty", role: "user", type: "text", content: "hi" },
    });

    const scope = await resolveConversationScope("company-1", "conv-empty");
    expect(scope).toEqual({ outcomeIds: [], taskIds: [], requestIds: [] });
  });
});

describe("loadConversationActivity", () => {
  it("returns outcome + task events tagged with their workflow, in scope only", async () => {
    const a = await seedConversation("a");
    const b = await seedConversation("b");

    await prisma.timelineEntry.create({
      data: {
        entityType: "outcome",
        entityId: a.outcomeId,
        eventType: "plan.generated",
        summary: "Plan ready",
      },
    });
    await prisma.timelineEntry.create({
      data: {
        entityType: "task",
        entityId: a.taskId,
        eventType: "qa_passed",
        summary: "QA passed 4/5",
      },
    });
    // A task event reachable only via the plan-draft task.
    await prisma.timelineEntry.create({
      data: {
        entityType: "task",
        entityId: a.draftTaskId,
        eventType: "pr_merged",
        summary: "Merged PR #7",
      },
    });
    // An out-of-scope event that must not leak into this conversation.
    await prisma.timelineEntry.create({
      data: {
        entityType: "task",
        entityId: b.taskId,
        eventType: "pr_merged",
        summary: "Other work merged",
      },
    });

    const scope = await resolveConversationScope("company-1", a.conversationId);
    const activity = await loadConversationActivity("company-1", scope);

    const summaries = activity.map((i) => i.description).sort();
    expect(summaries).toEqual(["Merged PR #7", "Plan ready", "QA passed 4/5"]);
    // Every returned item is tagged with this conversation's outcome.
    expect(activity.every((i) => i.workflowId === a.outcomeId)).toBe(true);
    // Out-of-scope event excluded.
    expect(activity.some((i) => i.description === "Other work merged")).toBe(false);
  });

  it("returns an empty seed for an empty scope", async () => {
    const activity = await loadConversationActivity("company-1", {
      outcomeIds: [],
      taskIds: [],
      requestIds: [],
    });
    expect(activity).toEqual([]);
  });
});
