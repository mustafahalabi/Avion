import { afterEach, describe, expect, it } from "vitest";

import { AiChatReplyAdapter } from "./ai-chat-reply-adapter";
import { DeterministicChatReplyAdapter } from "./deterministic-chat-reply-adapter";
import {
  resolveChatReplyAdapter,
  resolveChatReplyProviderId,
} from "./chat-reply-provider";

const ORIGINAL = process.env.EOS_CHAT_PROVIDER;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.EOS_CHAT_PROVIDER;
  else process.env.EOS_CHAT_PROVIDER = ORIGINAL;
});

describe("resolveChatReplyProviderId", () => {
  it("defaults to deterministic", () => {
    delete process.env.EOS_CHAT_PROVIDER;
    expect(resolveChatReplyProviderId()).toBe("deterministic");
  });

  it("honors an explicit override", () => {
    expect(resolveChatReplyProviderId({ provider: "ai" })).toBe("ai");
    expect(resolveChatReplyProviderId({ provider: "AI" })).toBe("ai");
    expect(resolveChatReplyProviderId({ provider: "nonsense" })).toBe("deterministic");
  });

  it("reads EOS_CHAT_PROVIDER when no override is given", () => {
    process.env.EOS_CHAT_PROVIDER = "ai";
    expect(resolveChatReplyProviderId()).toBe("ai");
  });

  it("prefers the explicit override over the env var", () => {
    process.env.EOS_CHAT_PROVIDER = "ai";
    expect(resolveChatReplyProviderId({ provider: "deterministic" })).toBe("deterministic");
  });
});

describe("resolveChatReplyAdapter", () => {
  it("returns the deterministic adapter by default", () => {
    delete process.env.EOS_CHAT_PROVIDER;
    expect(resolveChatReplyAdapter()).toBeInstanceOf(DeterministicChatReplyAdapter);
  });

  it("returns the AI adapter when opted in", () => {
    expect(resolveChatReplyAdapter({ provider: "ai" })).toBeInstanceOf(AiChatReplyAdapter);
  });
});
