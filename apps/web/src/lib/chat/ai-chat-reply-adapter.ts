import type { LlmClient } from "@/lib/llm/llm-client";

import type {
  ChatReplyAdapter,
  ChatReplyInput,
  ChatReplyResult,
} from "./chat-reply-adapter";
import { buildChatReplyPrompt } from "./chat-reply-prompt";
import { checkChatReplyGrounding, validateChatReply } from "./chat-reply-grounding";

/** Wall-clock budget (seconds) granted to the LLM for a chat reply. */
const AI_CHAT_REPLY_TIMEOUT_SECONDS = 60;

/** Max stored length of a fallback reason. */
const MAX_FALLBACK_REASON_LENGTH = 300;

function truncateReason(reason: string): string {
  const trimmed = reason.trim();
  return trimmed.length > MAX_FALLBACK_REASON_LENGTH
    ? `${trimmed.slice(0, MAX_FALLBACK_REASON_LENGTH - 1)}…`
    : trimmed;
}

/** Dependencies injected into {@link AiChatReplyAdapter}. */
export interface AiChatReplyAdapterDeps {
  /** Provider-independent LLM used to generate the reply text. */
  readonly llm: LlmClient;
  /** Adapter used whenever the AI path can't produce a trustworthy reply. */
  readonly fallback: ChatReplyAdapter;
}

/**
 * Chat reply backed by a real LLM, with a guaranteed deterministic fallback.
 *
 * The AI reply is trusted only when it (a) completes, (b) is non-empty and within
 * length, and (c) has no grounding fabrications (no false shipped/merged/approved
 * claims). On ANY problem — LLM failure, empty/overlong output, a fabrication, or
 * an unexpected throw — it falls back to the deterministic reply, so the AI path
 * can never be less truthful than the baseline. It only ever produces a chat
 * message; it never mutates a gate.
 */
export class AiChatReplyAdapter implements ChatReplyAdapter {
  readonly provider = "ai-claude";

  constructor(private readonly deps: AiChatReplyAdapterDeps) {}

  async reply(input: ChatReplyInput): Promise<ChatReplyResult> {
    try {
      const { system, prompt } = buildChatReplyPrompt(input);
      const completion = await this.deps.llm.complete({
        system,
        prompt,
        timeoutSeconds: AI_CHAT_REPLY_TIMEOUT_SECONDS,
      });

      if (!completion.ok) {
        return this.fallbackWith(input, `LLM completion failed: ${completion.error}`);
      }

      const text = completion.text.trim();

      const validation = validateChatReply(text);
      if (!validation.ok) {
        return this.fallbackWith(input, `invalid reply: ${validation.reason}`);
      }

      const grounding = checkChatReplyGrounding(text, input.context);
      if (grounding.hardIssues.length > 0) {
        return this.fallbackWith(
          input,
          `reply failed grounding: ${grounding.hardIssues.slice(0, 2).join("; ")}`
        );
      }

      return {
        text,
        provider: "ai",
        providerAttempted: "ai",
        fallbackReason: null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.fallbackWith(input, `AI reply threw: ${message}`);
    }
  }

  /** Runs the deterministic fallback, stamping that the AI path was attempted. */
  private async fallbackWith(
    input: ChatReplyInput,
    reason: string
  ): Promise<ChatReplyResult> {
    const result = await this.deps.fallback.reply(input);
    return {
      ...result,
      providerAttempted: "ai",
      fallbackReason: truncateReason(reason),
    };
  }
}
