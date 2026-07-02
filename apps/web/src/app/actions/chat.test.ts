import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import type * as ChatActions from "./chat";
import {
  setupTestSchema,
  teardownTestSchema,
} from "@/lib/test-utils/pg-test-db";

// The actions layer resolves the caller through Clerk; tests stand in a fake
// authenticated owner so the ownership logic runs against the real DB.
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// Next.js request-scoped APIs are not available under vitest.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

let prisma: typeof PrismaSingleton;
let schema: string;
let actions: typeof ChatActions;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("actions-chat"));
  actions = await import("./chat");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.$executeRawUnsafe(`DELETE FROM "Message"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Conversation"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "PlanningDraft"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RuntimeEvent"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Outcome"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RuntimeRequest"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

function signIn(): void {
  mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "owner@acme.test" });
}

async function newConversation(): Promise<string> {
  const conv = await prisma.conversation.create({
    data: { companyId: "company-1", type: "chat" },
    select: { id: true },
  });
  return conv.id;
}

async function send(conversationId: string, content: string) {
  const formData = new FormData();
  formData.set("content", content);
  return actions.sendMessage(conversationId, undefined, formData);
}

async function latestCompanyMessage(conversationId: string) {
  return prisma.message.findFirst({
    where: { conversationId, role: "company" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

async function planGeneratedEventCount(): Promise<number> {
  return prisma.runtimeEvent.count({ where: { type: "plan.generated" } });
}

describe("sendMessage — first message (baseline)", () => {
  it("creates the request → outcome → plan draft chain", async () => {
    signIn();
    const conversationId = await newConversation();

    const result = await send(conversationId, "I want a login screen");
    expect(result).toEqual({ conversationId });

    const request = await prisma.runtimeRequest.findFirst();
    expect(request?.title).toBe("I want a login screen");

    const outcome = await prisma.outcome.findFirst();
    expect(outcome?.runtimeRequestId).toBe(request?.id);

    const draft = await prisma.planningDraft.findFirst();
    expect(draft?.outcomeId).toBe(outcome?.id);
    expect(draft?.version).toBe(1);

    const reply = await latestCompanyMessage(conversationId);
    expect(reply?.type).toBe("request_created");
    expect(reply?.requestId).toBe(request?.id);
  });
});

describe("sendMessage — follow-ups reach the active request (MUS-261)", () => {
  it("attaches the follow-up to the request and outcome instead of dropping it", async () => {
    signIn();
    const conversationId = await newConversation();
    await send(conversationId, "I want a login screen");

    await send(conversationId, "Must support Google SSO only.");

    // The user's follow-up message is linked to the runtime request.
    const request = await prisma.runtimeRequest.findFirst();
    const userFollowUp = await prisma.message.findFirst({
      where: { conversationId, role: "user", content: "Must support Google SSO only." },
    });
    expect(userFollowUp?.requestId).toBe(request?.id);

    // The follow-up text lands durably on the outcome brief.
    const outcome = await prisma.outcome.findFirst();
    expect(outcome?.brief).toContain("--- CEO follow-up ---");
    expect(outcome?.brief).toContain("Must support Google SSO only.");

    // A runtime event records the follow-up on the request.
    const followUpEvent = await prisma.runtimeEvent.findFirst({
      where: { requestId: request?.id, type: "follow_up" },
    });
    expect(followUpEvent?.actor).toBe("CEO");
    expect(followUpEvent?.description).toContain("Must support Google SSO only.");

    // No second request was created.
    expect(await prisma.runtimeRequest.count()).toBe(1);
  });

  it("replies with real state instead of the canned acknowledgement", async () => {
    signIn();
    const conversationId = await newConversation();
    await send(conversationId, "I want a login screen");

    await send(conversationId, "Must support Google SSO only.");

    const reply = await latestCompanyMessage(conversationId);
    expect(reply?.content).not.toContain("Message noted");
    expect(reply?.content).toContain("**Request status:** planning");
    expect(reply?.content).toContain("awaiting your review");
    expect(reply?.content).toContain("**Open questions for you:**");
    expect(reply?.content).toContain("**Delivery:**");
    expect(reply?.requestId).not.toBeNull();
  });

  it("regenerates a still-pending plan draft with the follow-up folded in", async () => {
    signIn();
    const conversationId = await newConversation();
    await send(conversationId, "I want a login screen");
    expect(await planGeneratedEventCount()).toBe(1);

    await send(conversationId, "Must support Google SSO only.");

    // Regeneration happened (a second plan.generated runtime event) in place:
    // still one draft at version 1, still pending review.
    expect(await planGeneratedEventCount()).toBe(2);
    const drafts = await prisma.planningDraft.findMany();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].version).toBe(1);
    expect(drafts[0].status).toBe("draft");
  });

  it("does NOT regenerate an approved plan — the note reaches the outcome instead", async () => {
    signIn();
    const conversationId = await newConversation();
    await send(conversationId, "I want a login screen");
    expect(await planGeneratedEventCount()).toBe(1);

    const draft = await prisma.planningDraft.findFirstOrThrow();
    await prisma.planningDraft.update({
      where: { id: draft.id },
      data: { status: "approved", approvedAt: new Date(), approvedById: "user-1" },
    });

    await send(conversationId, "Also add passwordless magic links.");

    // No regeneration: the draft is untouched.
    expect(await planGeneratedEventCount()).toBe(1);
    const untouched = await prisma.planningDraft.findFirstOrThrow();
    expect(untouched.status).toBe("approved");

    // The constraint append survives (nothing overwrote it) so rework and
    // execution briefs consume it through the outcome.
    const outcome = await prisma.outcome.findFirstOrThrow();
    const constraints = JSON.parse(outcome.constraints) as string[];
    expect(constraints).toContain("CEO follow-up: Also add passwordless magic links.");
    expect(outcome.brief).toContain("Also add passwordless magic links.");

    const reply = await latestCompanyMessage(conversationId);
    expect(reply?.content).toContain("approved");
    expect(reply?.content).toContain("will reach execution and rework briefs");
  });

  it("starts a fresh request when the conversation's request already completed", async () => {
    signIn();
    const conversationId = await newConversation();
    await send(conversationId, "I want a login screen");

    // The request reaches a terminal state (mirrors the completion service).
    const firstRequest = await prisma.runtimeRequest.findFirstOrThrow();
    await prisma.runtimeRequest.update({
      where: { id: firstRequest.id },
      data: { status: "complete" },
    });
    await prisma.outcome.updateMany({
      where: { runtimeRequestId: firstRequest.id },
      data: { status: "completed", completedAt: new Date() },
    });

    await send(conversationId, "Now add dark mode support");

    // A brand-new request/outcome chain exists for the new goal.
    const requests = await prisma.runtimeRequest.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(requests).toHaveLength(2);
    expect(requests[1].title).toBe("Now add dark mode support");
    expect(requests[1].status).toBe("planning");
    expect(await prisma.outcome.count()).toBe(2);

    // The conversation now points at the new request.
    const reply = await latestCompanyMessage(conversationId);
    expect(reply?.type).toBe("request_created");
    expect(reply?.requestId).toBe(requests[1].id);

    // The completed request was not touched.
    const untouchedFirst = await prisma.runtimeRequest.findUniqueOrThrow({
      where: { id: firstRequest.id },
    });
    expect(untouchedFirst.status).toBe("complete");
  });
});
