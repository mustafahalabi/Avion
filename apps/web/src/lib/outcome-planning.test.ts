import { describe, expect, it } from "vitest";

import {
  assertPlanningDraftCanCreateWork,
  assertWorkEntityBelongsToCompany,
  buildGeneratedWorkTraceData,
  buildOutcomeCreateData,
  isPlanningDraftTerminalStatus,
  OUTCOME_PRIORITIES,
  OUTCOME_STATUSES,
  PLANNING_DRAFT_STATUSES,
  type PlanningDraftStatus,
  type PlanningDraftWorkGuardInput,
} from "@/lib/outcome-planning";

describe("constant arrays", () => {
  it("OUTCOME_STATUSES contains the full lifecycle in order", () => {
    expect(OUTCOME_STATUSES).toEqual([
      "proposed",
      "analyzing",
      "needs_clarification",
      "planned",
      "awaiting_approval",
      "approved",
      "in_delivery",
      "validating",
      "releasing",
      "released",
      "completed",
      "archived",
      "cancelled",
      "rejected",
      "deferred",
      "failed",
      "superseded",
    ]);
  });

  it("OUTCOME_STATUSES has no duplicate entries", () => {
    expect(new Set(OUTCOME_STATUSES).size).toBe(OUTCOME_STATUSES.length);
  });

  it("PLANNING_DRAFT_STATUSES enumerates the draft lifecycle", () => {
    expect(PLANNING_DRAFT_STATUSES).toEqual([
      "draft",
      "reviewing",
      "approved",
      "rejected",
      "applied",
      "failed",
    ]);
  });

  it("OUTCOME_PRIORITIES enumerates priorities low → urgent", () => {
    expect(OUTCOME_PRIORITIES).toEqual(["low", "medium", "high", "urgent"]);
  });

  it("starts an outcome at the first status (proposed)", () => {
    expect(OUTCOME_STATUSES[0]).toBe("proposed");
  });
});

describe("buildOutcomeCreateData", () => {
  const base = {
    companyId: "company_123",
    runtimeRequestId: "request_123",
    title: "Improve onboarding",
    rawRequest: "Improve activation for new users",
  };

  it("passes through the runtime request identifiers and text", () => {
    const data = buildOutcomeCreateData(base);
    expect(data.companyId).toBe("company_123");
    expect(data.runtimeRequestId).toBe("request_123");
    expect(data.title).toBe("Improve onboarding");
    expect(data.rawRequest).toBe("Improve activation for new users");
  });

  it("initializes empty JSON arrays for success criteria and constraints", () => {
    const data = buildOutcomeCreateData(base);
    expect(data.successCriteria).toBe("[]");
    expect(data.constraints).toBe("[]");
    expect(JSON.parse(data.successCriteria)).toEqual([]);
    expect(JSON.parse(data.constraints)).toEqual([]);
  });

  it("defaults to proposed status and Product Manager ownership", () => {
    const data = buildOutcomeCreateData(base);
    expect(data.status).toBe("proposed");
    expect(data.ownerRole).toBe("Product Manager");
  });

  it("defaults priority to medium when none is supplied", () => {
    expect(buildOutcomeCreateData(base).priority).toBe("medium");
  });

  it("honors an explicit priority", () => {
    expect(buildOutcomeCreateData({ ...base, priority: "urgent" }).priority).toBe("urgent");
    expect(buildOutcomeCreateData({ ...base, priority: "low" }).priority).toBe("low");
    expect(buildOutcomeCreateData({ ...base, priority: "high" }).priority).toBe("high");
  });

  it("scopes the outcome to a repository when one is supplied (MUS-259)", () => {
    expect(buildOutcomeCreateData({ ...base, repositoryId: "repo-1" }).repositoryId).toBe(
      "repo-1"
    );
    expect(buildOutcomeCreateData(base).repositoryId).toBeNull();
    expect(buildOutcomeCreateData({ ...base, repositoryId: null }).repositoryId).toBeNull();
  });

  it("produces a status that is a member of OUTCOME_STATUSES", () => {
    expect(OUTCOME_STATUSES).toContain(buildOutcomeCreateData(base).status);
  });

  it("is deterministic for identical input", () => {
    expect(buildOutcomeCreateData(base)).toEqual(buildOutcomeCreateData(base));
  });
});

describe("assertPlanningDraftCanCreateWork", () => {
  const approved: PlanningDraftWorkGuardInput = {
    id: "plan_123",
    companyId: "company_123",
    outcomeId: "outcome_123",
    status: "approved",
    approvedAt: new Date("2026-01-01T00:00:00Z"),
    rejectedAt: null,
  };

  it("permits an approved draft with an approval timestamp", () => {
    expect(() => assertPlanningDraftCanCreateWork(approved)).not.toThrow();
  });

  it("permits an applied draft that recorded approval", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, status: "applied" })
    ).not.toThrow();
  });

  it("rejects a draft whose status is rejected", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, status: "rejected" })
    ).toThrow(/Rejected planning drafts cannot create work/);
  });

  it("rejects a draft that has a rejectedAt timestamp even if otherwise approved", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, rejectedAt: new Date() })
    ).toThrow(/Rejected planning drafts cannot create work/);
  });

  it("rejects a failed draft", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, status: "failed" })
    ).toThrow(/Failed planning drafts cannot create work/);
  });

  it("rejects a draft still in draft status", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, status: "draft", approvedAt: null })
    ).toThrow(/Only approved or applied planning drafts can create work/);
  });

  it("rejects a reviewing draft", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, status: "reviewing", approvedAt: null })
    ).toThrow(/Only approved or applied planning drafts can create work/);
  });

  it("rejects an approved-status draft missing the approval timestamp", () => {
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, approvedAt: null })
    ).toThrow(/must record approval before creating work/);
  });

  it("checks rejection before the approval-timestamp guard", () => {
    // status rejected wins even when approvedAt is also null.
    expect(() =>
      assertPlanningDraftCanCreateWork({ ...approved, status: "rejected", approvedAt: null })
    ).toThrow(/Rejected planning drafts cannot create work/);
  });
});

describe("buildGeneratedWorkTraceData", () => {
  const base = {
    companyId: "company_123",
    outcomeId: "outcome_123",
    planningDraftId: "plan_123",
    planItemId: "task:setup-auth",
  };

  it("returns the normalized trace columns", () => {
    expect(buildGeneratedWorkTraceData(base)).toEqual({
      companyId: "company_123",
      outcomeId: "outcome_123",
      planningDraftId: "plan_123",
      planItemId: "task:setup-auth",
    });
  });

  it("trims surrounding whitespace from the plan item ID", () => {
    expect(buildGeneratedWorkTraceData({ ...base, planItemId: "  task:x  " }).planItemId).toBe(
      "task:x"
    );
  });

  it("throws when the plan item ID is empty", () => {
    expect(() => buildGeneratedWorkTraceData({ ...base, planItemId: "" })).toThrow(
      /deterministic plan item ID/
    );
  });

  it("throws when the plan item ID is only whitespace", () => {
    expect(() => buildGeneratedWorkTraceData({ ...base, planItemId: "   " })).toThrow(
      /deterministic plan item ID/
    );
  });

  it("does not leak extra properties from the input", () => {
    const result = buildGeneratedWorkTraceData(base);
    expect(Object.keys(result).sort()).toEqual([
      "companyId",
      "outcomeId",
      "planItemId",
      "planningDraftId",
    ]);
  });
});

describe("assertWorkEntityBelongsToCompany", () => {
  it("passes when the entity belongs to the company", () => {
    expect(() =>
      assertWorkEntityBelongsToCompany({
        companyId: "company_123",
        entityType: "task",
        entityCompanyId: "company_123",
      })
    ).not.toThrow();
  });

  it("throws when the entity belongs to another company", () => {
    expect(() =>
      assertWorkEntityBelongsToCompany({
        companyId: "company_123",
        entityType: "task",
        entityCompanyId: "company_456",
      })
    ).toThrow(/task does not belong to this company/);
  });

  it("throws when the entity has no company (null)", () => {
    expect(() =>
      assertWorkEntityBelongsToCompany({
        companyId: "company_123",
        entityType: "task",
        entityCompanyId: null,
      })
    ).toThrow(/task does not belong to this company/);
  });

  it("includes the entity type in the error message", () => {
    expect(() =>
      assertWorkEntityBelongsToCompany({
        companyId: "a",
        entityType: "task",
        entityCompanyId: "b",
      })
    ).toThrow(/^task /);
  });
});

describe("isPlanningDraftTerminalStatus", () => {
  it("treats rejected, applied, and failed as terminal", () => {
    expect(isPlanningDraftTerminalStatus("rejected")).toBe(true);
    expect(isPlanningDraftTerminalStatus("applied")).toBe(true);
    expect(isPlanningDraftTerminalStatus("failed")).toBe(true);
  });

  it("treats draft, reviewing, and approved as non-terminal", () => {
    expect(isPlanningDraftTerminalStatus("draft")).toBe(false);
    expect(isPlanningDraftTerminalStatus("reviewing")).toBe(false);
    expect(isPlanningDraftTerminalStatus("approved")).toBe(false);
  });

  it("classifies every PLANNING_DRAFT_STATUSES value consistently", () => {
    const terminal = new Set<PlanningDraftStatus>(["rejected", "applied", "failed"]);
    for (const status of PLANNING_DRAFT_STATUSES) {
      expect(isPlanningDraftTerminalStatus(status)).toBe(terminal.has(status));
    }
  });
});
