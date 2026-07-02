import type { FollowUpReplyContext } from "@/lib/chat-followup-service";

/**
 * Provider-independent contract for the company's reply to a CEO chat follow-up.
 *
 * Mirrors the {@link import("@/lib/planning/planning-adapter").PlanningAdapter}
 * seam: the deterministic reply is the guaranteed baseline, and an AI adapter
 * (which itself falls back to deterministic on any failure) produces a natural-
 * language answer grounded in the exact same real rows. Every implementation
 * returns the reply text plus provenance, so the caller can persist a single
 * message shape regardless of which provider produced it — and the AI path can
 * never be worse (or less truthful) than the templated baseline.
 */
export type ChatReplyProvider = "deterministic" | "ai";

export interface ChatReplyInput {
  /** The grounded real-state snapshot (identical to the deterministic reply's). */
  readonly context: FollowUpReplyContext;
  /** The CEO's latest message being answered. */
  readonly message: string;
}

export interface ChatReplyResult {
  /** The reply text to post as the company's chat message. */
  readonly text: string;
  /** Which provider actually produced `text`. */
  readonly provider: ChatReplyProvider;
  /** Which provider was attempted first (differs from `provider` on fallback). */
  readonly providerAttempted: ChatReplyProvider;
  /** Why the attempted provider fell back, or null when it succeeded. */
  readonly fallbackReason: string | null;
}

export interface ChatReplyAdapter {
  /** Stable identifier for telemetry/audit (e.g. "deterministic", "ai-claude"). */
  readonly provider: string;

  /**
   * Produces the company's reply to a follow-up.
   *
   * @param input - The grounded context + the CEO's message.
   * @returns The reply text and its provenance.
   */
  reply(input: ChatReplyInput): Promise<ChatReplyResult>;
}
