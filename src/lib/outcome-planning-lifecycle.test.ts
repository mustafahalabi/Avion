import { describe, expect, it } from "vitest";

import {
  OUTCOME_PLANNING_EVENT_TYPES,
  PENDING_PLAN_REVIEW_STATUSES,
  buildOutcomePlanningUrl,
} from "./outcome-planning-lifecycle";

describe("outcome-planning-lifecycle", () => {
  it("defines the planning lifecycle event types", () => {
    expect(OUTCOME_PLANNING_EVENT_TYPES.outcomeSubmitted).toBe("outcome.submitted");
    expect(OUTCOME_PLANNING_EVENT_TYPES.planGenerated).toBe("plan.generated");
    expect(OUTCOME_PLANNING_EVENT_TYPES.planApproved).toBe("plan.approved");
    expect(OUTCOME_PLANNING_EVENT_TYPES.planRejected).toBe("plan.rejected");
    expect(OUTCOME_PLANNING_EVENT_TYPES.workCreated).toBe("work.created");
  });

  it("tracks draft and reviewing as pending review statuses", () => {
    expect(PENDING_PLAN_REVIEW_STATUSES).toEqual(["draft", "reviewing"]);
  });

  it("builds outcome planning URLs", () => {
    expect(buildOutcomePlanningUrl("outcome-1")).toBe("/work/outcomes/outcome-1");
  });
});
