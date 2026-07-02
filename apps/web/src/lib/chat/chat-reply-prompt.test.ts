import { describe, expect, it } from "vitest";

import type { FollowUpReplyContext } from "@/lib/chat-followup-service";
import { buildChatReplyPrompt } from "./chat-reply-prompt";

function context(over: Partial<FollowUpReplyContext> = {}): FollowUpReplyContext {
  return {
    requestTitle: "Add login screen",
    requestStatus: "planning",
    plan: { status: "draft", version: 2, regenerated: true },
    openCeoQuestions: ["Password or magic link?"],
    taskCounts: { todo: 3, inProgress: 0, inReview: 0, done: 0, other: 0, total: 3 },
    openChangeRequests: 0,
    ...over,
  };
}

describe("buildChatReplyPrompt", () => {
  it("fixes the grounding contract in the system prompt", () => {
    const { system } = buildChatReplyPrompt({ context: context(), message: "hi" });
    expect(system).toMatch(/only using the FACTS/i);
    expect(system).toMatch(/never claim work has shipped/i);
  });

  it("includes the grounded facts and the CEO's message", () => {
    const { prompt } = buildChatReplyPrompt({
      context: context(),
      message: "where's the login work?",
    });
    expect(prompt).toContain("Add login screen");
    expect(prompt).toContain('status "planning"');
    expect(prompt).toContain('v2, status "draft"');
    expect(prompt).toContain("3 total");
    expect(prompt).toContain("Password or magic link?");
    expect(prompt).toContain("where's the login work?");
  });

  it("surfaces pending rework when there are open change requests", () => {
    const { prompt } = buildChatReplyPrompt({
      context: context({ openChangeRequests: 2 }),
      message: "use a modal instead",
    });
    expect(prompt).toMatch(/Pending rework: 2 unresolved change request/);
  });

  it("omits the rework fact when there are none", () => {
    const { prompt } = buildChatReplyPrompt({
      context: context({ openChangeRequests: 0 }),
      message: "status?",
    });
    expect(prompt).not.toMatch(/Pending rework/);
  });
});
