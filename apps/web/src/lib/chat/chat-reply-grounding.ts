import type { FollowUpReplyContext } from "@/lib/chat-followup-service";

/**
 * Validation + grounding for an AI-generated chat reply.
 *
 * A free-text status answer can't be schema-checked like a plan, so the guard is
 * deliberately conservative and focused on the one dangerous failure mode: the
 * model *fabricating completion* — telling the CEO work shipped/merged/deployed
 * or a plan was approved when the real records say otherwise. Anything the guard
 * flags falls the reply back to the deterministic, row-traceable baseline, so a
 * flagged reply is never shown. Legitimate negations ("not yet merged") don't
 * trip it because the patterns match positive assertions only.
 */

/** Upper bound on a reply's length — a runaway completion is rejected. */
export const MAX_CHAT_REPLY_LENGTH = 1500;

export type ChatReplyValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** Structural validation: non-empty and within a sane length. */
export function validateChatReply(text: string): ChatReplyValidation {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty reply" };
  if (trimmed.length > MAX_CHAT_REPLY_LENGTH) {
    return { ok: false, reason: `reply exceeds ${MAX_CHAT_REPLY_LENGTH} chars` };
  }
  return { ok: true };
}

export interface ChatReplyGroundingResult {
  /** Fabrications that must reject the AI reply (fall back to deterministic). */
  readonly hardIssues: string[];
}

// Positive assertions of shipment/merge/deploy/release/completion.
const SHIPPED_CLAIM =
  /\b(?:has|have|been|was|were|is|are|now|successfully)\s+(?:been\s+)?(?:merged|shipped|deployed|released|delivered|completed|live|in production)\b/i;
// Positive assertions that a plan is approved.
const APPROVED_CLAIM = /\bplan\b[^.?!]*\b(?:approved|has been approved|is approved)\b/i;

/**
 * Checks an AI reply against the real context for fabricated completion.
 *
 * Hard issues (reject): claiming work shipped/merged/deployed/completed while no
 * delivery is complete (no done tasks, request not complete, plan not applied),
 * or claiming the plan is approved while it isn't.
 *
 * @param text - The AI reply.
 * @param context - The real-state snapshot the reply was grounded in.
 * @returns Hard grounding issues (empty when the reply is trustworthy).
 */
export function checkChatReplyGrounding(
  text: string,
  context: FollowUpReplyContext
): ChatReplyGroundingResult {
  const hardIssues: string[] = [];

  // "Delivered" means work actually shipped: the request completed or a task
  // reached done (merged). An *applied* plan only means tasks were created — not
  // that anything shipped — so it does not count as delivery here.
  const anyDelivered =
    context.requestStatus === "complete" || context.taskCounts.done > 0;
  if (SHIPPED_CLAIM.test(text) && !anyDelivered) {
    hardIssues.push(
      "reply claims work shipped/merged/completed but no delivery is complete in the records"
    );
  }

  const planApproved =
    context.plan?.status === "approved" || context.plan?.status === "applied";
  if (APPROVED_CLAIM.test(text) && !planApproved) {
    hardIssues.push("reply claims the plan is approved but it is not");
  }

  return { hardIssues };
}
