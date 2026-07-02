import { buildFollowUpReply } from "@/lib/chat-followup-service";

import type { ChatReplyAdapter, ChatReplyInput, ChatReplyResult } from "./chat-reply-adapter";

/**
 * The baseline chat reply: the deterministic, row-traceable status answer
 * ({@link buildFollowUpReply}). Every line traces to a real record — no AI, no
 * fabrication. This is both the default provider and the AI adapter's fallback.
 */
export class DeterministicChatReplyAdapter implements ChatReplyAdapter {
  readonly provider = "deterministic";

  async reply(input: ChatReplyInput): Promise<ChatReplyResult> {
    return {
      text: buildFollowUpReply(input.context),
      provider: "deterministic",
      providerAttempted: "deterministic",
      fallbackReason: null,
    };
  }
}
