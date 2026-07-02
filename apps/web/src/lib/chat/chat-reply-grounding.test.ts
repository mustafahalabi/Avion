import { describe, expect, it } from "vitest";

import type { FollowUpReplyContext } from "@/lib/chat-followup-service";
import {
  MAX_CHAT_REPLY_LENGTH,
  checkChatReplyGrounding,
  validateChatReply,
} from "./chat-reply-grounding";

function context(over: Partial<FollowUpReplyContext> = {}): FollowUpReplyContext {
  return {
    requestTitle: "Add login screen",
    requestStatus: "in_review",
    plan: { status: "applied", version: 1, regenerated: false },
    openCeoQuestions: [],
    taskCounts: { todo: 1, inProgress: 1, inReview: 1, done: 0, other: 0, total: 3 },
    openChangeRequests: 0,
    ...over,
  };
}

describe("validateChatReply", () => {
  it("accepts a normal reply", () => {
    expect(validateChatReply("The login work is in review.")).toEqual({ ok: true });
  });

  it("rejects an empty reply", () => {
    expect(validateChatReply("   ")).toEqual({ ok: false, reason: "empty reply" });
  });

  it("rejects a runaway reply", () => {
    const result = validateChatReply("x".repeat(MAX_CHAT_REPLY_LENGTH + 1));
    expect(result.ok).toBe(false);
  });
});

describe("checkChatReplyGrounding", () => {
  it("passes a grounded reply", () => {
    const result = checkChatReplyGrounding(
      "The login screen is in review; 1 task is still in progress.",
      context()
    );
    expect(result.hardIssues).toEqual([]);
  });

  it("rejects a fabricated 'merged/shipped' claim when nothing is delivered", () => {
    const result = checkChatReplyGrounding(
      "Great news — the login screen has been merged and shipped to production!",
      context({ requestStatus: "in_review", taskCounts: { todo: 0, inProgress: 1, inReview: 0, done: 0, other: 0, total: 1 }, plan: { status: "applied", version: 1, regenerated: false } })
    );
    expect(result.hardIssues.length).toBeGreaterThan(0);
  });

  it("allows a shipped claim when delivery is actually complete", () => {
    const result = checkChatReplyGrounding(
      "The login screen has been merged — all done.",
      context({
        requestStatus: "complete",
        taskCounts: { todo: 0, inProgress: 0, inReview: 0, done: 2, other: 0, total: 2 },
      })
    );
    expect(result.hardIssues).toEqual([]);
  });

  it("does not trip on a negation like 'not yet merged'", () => {
    const result = checkChatReplyGrounding(
      "The PR is open but has not yet merged; review is still in progress.",
      context({ requestStatus: "in_review" })
    );
    expect(result.hardIssues).toEqual([]);
  });

  it("rejects a false 'plan approved' claim", () => {
    const result = checkChatReplyGrounding(
      "Your plan has been approved and work is queued.",
      context({ plan: { status: "draft", version: 1, regenerated: false } })
    );
    expect(result.hardIssues.length).toBeGreaterThan(0);
  });
});
