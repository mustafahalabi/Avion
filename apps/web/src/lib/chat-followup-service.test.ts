import { describe, expect, it } from "vitest";

import {
  FOLLOW_UP_BRIEF_DELIMITER,
  FOLLOW_UP_CONSTRAINT_PREFIX,
  appendFollowUpConstraint,
  appendFollowUpToBrief,
  buildFollowUpReply,
  type FollowUpReplyContext,
  type FollowUpTaskCounts,
} from "./chat-followup-service";

const ZERO_TASKS: FollowUpTaskCounts = {
  todo: 0,
  inProgress: 0,
  inReview: 0,
  done: 0,
  other: 0,
  total: 0,
};

function contextWith(overrides: Partial<FollowUpReplyContext>): FollowUpReplyContext {
  return {
    requestTitle: "Add login screen",
    requestStatus: "planning",
    plan: { status: "draft", version: 1, regenerated: true },
    openCeoQuestions: [],
    taskCounts: ZERO_TASKS,
    ...overrides,
  };
}

describe("appendFollowUpToBrief", () => {
  it("starts the brief with a delimited follow-up section when the brief is empty", () => {
    const result = appendFollowUpToBrief(null, "Must support Google SSO only.");
    expect(result).toBe(`${FOLLOW_UP_BRIEF_DELIMITER}\nMust support Google SSO only.`);
  });

  it("appends after the existing brief with a blank-line separator", () => {
    const result = appendFollowUpToBrief("Original brief.", "Ship behind a flag.");
    expect(result).toBe(
      `Original brief.\n\n${FOLLOW_UP_BRIEF_DELIMITER}\nShip behind a flag.`
    );
  });

  it("is idempotent for an identical follow-up section", () => {
    const once = appendFollowUpToBrief("Original brief.", "Ship behind a flag.");
    const twice = appendFollowUpToBrief(once, "Ship behind a flag.");
    expect(twice).toBe(once);
  });

  it("keeps distinct follow-ups as separate sections", () => {
    const first = appendFollowUpToBrief(null, "First note.");
    const second = appendFollowUpToBrief(first, "Second note.");
    expect(second.split(FOLLOW_UP_BRIEF_DELIMITER)).toHaveLength(3);
  });
});

describe("appendFollowUpConstraint", () => {
  it("appends a prefixed entry to the constraints array", () => {
    const result = appendFollowUpConstraint("[]", "Must support Google SSO only.");
    expect(JSON.parse(result)).toEqual([
      `${FOLLOW_UP_CONSTRAINT_PREFIX}Must support Google SSO only.`,
    ]);
  });

  it("preserves existing constraints", () => {
    const result = appendFollowUpConstraint(
      JSON.stringify(["What deadline should constrain this plan?"]),
      "No third-party auth providers."
    );
    expect(JSON.parse(result)).toEqual([
      "What deadline should constrain this plan?",
      `${FOLLOW_UP_CONSTRAINT_PREFIX}No third-party auth providers.`,
    ]);
  });

  it("is idempotent for an identical follow-up", () => {
    const once = appendFollowUpConstraint("[]", "No third-party auth providers.");
    const twice = appendFollowUpConstraint(once, "No third-party auth providers.");
    expect(JSON.parse(twice)).toEqual(JSON.parse(once));
  });

  it("collapses whitespace so entries survive parse round-trips", () => {
    const once = appendFollowUpConstraint("[]", "Line one\n  line two");
    expect(JSON.parse(once)).toEqual([`${FOLLOW_UP_CONSTRAINT_PREFIX}Line one line two`]);
  });

  it("treats malformed constraint JSON as an empty list instead of throwing", () => {
    const result = appendFollowUpConstraint("not json", "Keep scope small.");
    expect(JSON.parse(result)).toEqual([`${FOLLOW_UP_CONSTRAINT_PREFIX}Keep scope small.`]);
  });
});

describe("buildFollowUpReply", () => {
  it("never emits the old canned acknowledgement", () => {
    const reply = buildFollowUpReply(contextWith({}));
    expect(reply).not.toContain("Message noted");
  });

  it("renders request status, regenerated pending plan, questions, and delivery", () => {
    const reply = buildFollowUpReply(
      contextWith({
        openCeoQuestions: [
          "What deadline or release window should constrain this plan, if any?",
          "Are there explicit exclusions or tradeoffs the CEO wants preserved before approval?",
        ],
      })
    );

    expect(reply).toContain("attached to **Add login screen**");
    expect(reply).toContain("**Request status:** planning");
    expect(reply).toContain("**Plan:** v1 awaiting your review — updated with this note.");
    expect(reply).toContain("**Open questions for you:**");
    expect(reply).toContain(
      "1. What deadline or release window should constrain this plan, if any?"
    );
    expect(reply).toContain(
      "**Delivery:** no tasks yet — delivery work is created when you approve the plan."
    );
  });

  it("explains that approved plans are not regenerated and shows live task counts", () => {
    const reply = buildFollowUpReply(
      contextWith({
        requestStatus: "executing",
        plan: { status: "approved", version: 1, regenerated: false },
        taskCounts: {
          todo: 2,
          inProgress: 1,
          inReview: 1,
          done: 3,
          other: 0,
          total: 7,
        },
      })
    );

    expect(reply).toContain("**Request status:** executing");
    expect(reply).toContain(
      "**Plan:** v1 approved — this note was attached to the outcome and will reach execution and rework briefs."
    );
    expect(reply).toContain(
      "**Delivery:** 2 todo · 1 in progress · 1 in review · 3 done (7 total)"
    );
    expect(reply).not.toContain("Open questions");
  });

  it("surfaces clarification questions when planning failed", () => {
    const reply = buildFollowUpReply(
      contextWith({
        requestStatus: "blocked",
        plan: { status: "failed", version: 1, regenerated: true },
        openCeoQuestions: ["What outcome should Avion plan for?"],
      })
    );

    expect(reply).toContain("**Request status:** blocked");
    expect(reply).toContain(
      "**Plan:** v1 needs clarification — planning retried with this note."
    );
    expect(reply).toContain("1. What outcome should Avion plan for?");
  });

  it("stays honest when no plan draft exists yet", () => {
    const reply = buildFollowUpReply(contextWith({ plan: null }));
    expect(reply).toContain(
      "**Plan:** not generated yet — it will be prepared for your review."
    );
    expect(reply).toContain("**Delivery:** no delivery tasks yet.");
  });

  it("humanizes underscored statuses and counts unknown task statuses as other", () => {
    const reply = buildFollowUpReply(
      contextWith({
        requestStatus: "in_review",
        plan: { status: "applied", version: 2, regenerated: false },
        taskCounts: {
          todo: 1,
          inProgress: 0,
          inReview: 0,
          done: 0,
          other: 2,
          total: 3,
        },
      })
    );

    expect(reply).toContain("**Request status:** in review");
    expect(reply).toContain("**Plan:** v2 applied to delivery work");
    expect(reply).toContain("1 todo · 0 in progress · 0 in review · 0 done · 2 other (3 total)");
  });

  it("acknowledges pending rework inline when there are open change requests", () => {
    const reply = buildFollowUpReply(
      contextWith({ requestStatus: "in_review", openChangeRequests: 2 })
    );
    expect(reply).toContain(
      "**Your input is routed:** 2 open change requests will absorb this note"
    );
  });

  it("uses the singular and omits the routing line when there are none", () => {
    const one = buildFollowUpReply(contextWith({ openChangeRequests: 1 }));
    expect(one).toContain("1 open change request will absorb this note");

    const none = buildFollowUpReply(contextWith({ openChangeRequests: 0 }));
    expect(none).not.toContain("Your input is routed");
  });
});
