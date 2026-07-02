import { describe, expect, it } from "vitest";

import type { FollowUpReplyContext } from "@/lib/chat-followup-service";
import { buildFollowUpReply } from "@/lib/chat-followup-service";
import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from "@/lib/llm/llm-client";

import { AiChatReplyAdapter } from "./ai-chat-reply-adapter";
import { DeterministicChatReplyAdapter } from "./deterministic-chat-reply-adapter";
import type { ChatReplyInput } from "./chat-reply-adapter";

function context(over: Partial<FollowUpReplyContext> = {}): FollowUpReplyContext {
  return {
    requestTitle: "Add login screen",
    requestStatus: "in_review",
    plan: { status: "draft", version: 1, regenerated: false },
    openCeoQuestions: [],
    taskCounts: { todo: 1, inProgress: 1, inReview: 1, done: 0, other: 0, total: 3 },
    openChangeRequests: 0,
    ...over,
  };
}

/** An LlmClient that returns a canned completion. */
function fakeLlm(completion: LlmCompletion): LlmClient {
  return {
    provider: "fake",
    async complete(_request: LlmCompletionRequest): Promise<LlmCompletion> {
      return completion;
    },
  };
}

/** An LlmClient that throws, to exercise the adapter's catch path. */
const throwingLlm: LlmClient = {
  provider: "fake-throwing",
  async complete(): Promise<LlmCompletion> {
    throw new Error("boom");
  },
};

function adapter(llm: LlmClient): AiChatReplyAdapter {
  return new AiChatReplyAdapter({ llm, fallback: new DeterministicChatReplyAdapter() });
}

const input: ChatReplyInput = { context: context(), message: "where's the login work?" };

describe("AiChatReplyAdapter", () => {
  it("returns a grounded AI reply on success", async () => {
    const result = await adapter(
      fakeLlm({ ok: true, text: "The login screen is in review; one task is still in progress.", durationMs: 5 })
    ).reply(input);

    expect(result.provider).toBe("ai");
    expect(result.providerAttempted).toBe("ai");
    expect(result.fallbackReason).toBeNull();
    expect(result.text).toContain("in review");
  });

  it("falls back to deterministic when the LLM fails", async () => {
    const result = await adapter(
      fakeLlm({ ok: false, error: "timeout", durationMs: 60000 })
    ).reply(input);

    expect(result.provider).toBe("deterministic");
    expect(result.providerAttempted).toBe("ai");
    expect(result.fallbackReason).toMatch(/LLM completion failed/);
    expect(result.text).toBe(buildFollowUpReply(input.context));
  });

  it("falls back on an empty reply", async () => {
    const result = await adapter(fakeLlm({ ok: true, text: "   ", durationMs: 5 })).reply(input);
    expect(result.provider).toBe("deterministic");
    expect(result.fallbackReason).toMatch(/invalid reply/);
  });

  it("falls back when the AI fabricates a shipped claim", async () => {
    const result = await adapter(
      fakeLlm({ ok: true, text: "Done — the login screen has been merged and deployed!", durationMs: 5 })
    ).reply(input);

    expect(result.provider).toBe("deterministic");
    expect(result.fallbackReason).toMatch(/grounding/);
    expect(result.text).toBe(buildFollowUpReply(input.context));
  });

  it("falls back when the LLM client throws", async () => {
    const result = await adapter(throwingLlm).reply(input);

    expect(result.provider).toBe("deterministic");
    expect(result.fallbackReason).toMatch(/AI reply threw: boom/);
  });
});
