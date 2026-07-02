import { ClaudeCliLlmClient } from "@/lib/llm/claude-cli-client";

import type { ChatReplyAdapter } from "./chat-reply-adapter";
import { AiChatReplyAdapter } from "./ai-chat-reply-adapter";
import { DeterministicChatReplyAdapter } from "./deterministic-chat-reply-adapter";

/** Supported chat reply providers. */
export type ChatReplyProviderId = "deterministic" | "ai";

export interface ResolveChatReplyAdapterOptions {
  /**
   * Explicit provider override (e.g. a future per-company setting). When omitted,
   * the resolver reads `EOS_CHAT_PROVIDER`, then defaults to deterministic —
   * keeping existing behavior unchanged until a company/operator opts in.
   */
  readonly provider?: string | null;
}

/**
 * Resolves the configured chat reply provider id, defaulting to deterministic.
 *
 * @param options - Optional explicit override.
 * @returns "ai" only when explicitly configured; otherwise "deterministic".
 */
export function resolveChatReplyProviderId(
  options?: ResolveChatReplyAdapterOptions
): ChatReplyProviderId {
  const raw = (options?.provider ?? process.env.EOS_CHAT_PROVIDER ?? "deterministic")
    .toString()
    .trim()
    .toLowerCase();
  return raw === "ai" ? "ai" : "deterministic";
}

/**
 * Resolves the {@link ChatReplyAdapter} to use for a follow-up reply.
 *
 * Deterministic by default. The AI adapter (which itself falls back to
 * deterministic on any failure) is returned only when explicitly configured via
 * `EOS_CHAT_PROVIDER=ai` or an override, so default behavior — and the whole
 * test suite — is unaffected until opted in.
 *
 * @param options - Optional explicit provider override.
 * @returns A ready-to-use chat reply adapter.
 */
export function resolveChatReplyAdapter(
  options?: ResolveChatReplyAdapterOptions
): ChatReplyAdapter {
  const id = resolveChatReplyProviderId(options);
  if (id === "ai") {
    return new AiChatReplyAdapter({
      llm: new ClaudeCliLlmClient(),
      fallback: new DeterministicChatReplyAdapter(),
    });
  }
  return new DeterministicChatReplyAdapter();
}
