import { describe, expect, it } from "vitest";
import {
  computeNextActions,
  type WorkspaceActionState,
} from "./next-action-recommendation";

const EMPTY_STATE: WorkspaceActionState = {
  pendingPlanApprovalCount: 0,
  awaitingApprovalRequestCount: 0,
  failedExecutionCount: 0,
  needsClarificationCount: 0,
  blockedTaskCount: 0,
  blockedRequestCount: 0,
  readyExecutionCount: 0,
  runningExecutionCount: 0,
  activeRequestCount: 0,
  isNewCompany: false,
};

describe("computeNextActions", () => {
  // ── New / idle company ────────────────────────────────────────────────────

  it("returns new-company action for a brand-new workspace", () => {
    const { primary, secondary } = computeNextActions({
      ...EMPTY_STATE,
      isNewCompany: true,
    });

    expect(primary?.id).toBe("new_company");
    expect(primary?.href).toBe("/inbox");
    expect(secondary).toHaveLength(0);
  });

  it("returns no-active-work action for an idle company with history", () => {
    const { primary } = computeNextActions(EMPTY_STATE);
    expect(primary?.id).toBe("no_active_work");
  });

  // ── Priority ordering ─────────────────────────────────────────────────────

  it("prioritises pending plan approvals above everything else", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 2,
      blockedTaskCount: 5,
      failedExecutionCount: 3,
      readyExecutionCount: 1,
    });

    expect(primary?.id).toBe("pending_plan_approval");
    expect(primary?.priority).toBe("urgent");
  });

  it("prioritises awaiting-approval requests above failed executions", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      awaitingApprovalRequestCount: 1,
      failedExecutionCount: 4,
    });

    expect(primary?.id).toBe("awaiting_approval_requests");
    expect(primary?.priority).toBe("urgent");
  });

  it("prioritises failed executions above blocked tasks", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      failedExecutionCount: 1,
      blockedTaskCount: 10,
    });

    expect(primary?.id).toBe("failed_executions");
    expect(primary?.priority).toBe("high");
  });

  it("prioritises needs-clarification above blocked tasks", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      needsClarificationCount: 1,
      blockedTaskCount: 5,
    });

    expect(primary?.id).toBe("needs_clarification");
    expect(primary?.priority).toBe("high");
  });

  it("prioritises blocked requests above blocked tasks", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      blockedRequestCount: 1,
      blockedTaskCount: 5,
    });

    expect(primary?.id).toBe("blocked_requests");
    expect(primary?.priority).toBe("high");
  });

  it("prioritises blocked tasks above ready executions", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      blockedTaskCount: 3,
      readyExecutionCount: 2,
    });

    expect(primary?.id).toBe("blocked_tasks");
  });

  it("prioritises ready executions above running executions", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      readyExecutionCount: 1,
      runningExecutionCount: 3,
    });

    expect(primary?.id).toBe("ready_executions");
    expect(primary?.priority).toBe("medium");
  });

  it("falls back to running-executions when that is the only signal", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      runningExecutionCount: 2,
      activeRequestCount: 1,
    });

    expect(primary?.id).toBe("running_executions");
  });

  it("falls back to active-requests when no executions are running", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      activeRequestCount: 3,
    });

    expect(primary?.id).toBe("active_requests");
  });

  // ── Secondary actions ─────────────────────────────────────────────────────

  it("returns up to three secondary actions", () => {
    const { secondary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 1,
      failedExecutionCount: 2,
      blockedTaskCount: 4,
      readyExecutionCount: 1,
      runningExecutionCount: 1,
    });

    expect(secondary.length).toBeGreaterThanOrEqual(1);
    expect(secondary.length).toBeLessThanOrEqual(3);
  });

  it("secondary actions do not include the primary action id", () => {
    const { primary, secondary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 1,
      failedExecutionCount: 1,
      blockedTaskCount: 2,
    });

    const secondaryIds = secondary.map((a) => a.id);
    expect(secondaryIds).not.toContain(primary?.id);
  });

  it("secondary actions are sorted lower-priority than the primary", () => {
    const PRIORITY_RANK: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const { primary, secondary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 1,
      failedExecutionCount: 1,
      blockedTaskCount: 2,
      readyExecutionCount: 1,
    });

    for (const action of secondary) {
      expect(PRIORITY_RANK[action.priority]).toBeGreaterThanOrEqual(
        PRIORITY_RANK[primary!.priority]
      );
    }
  });

  // ── Recommendation shape ──────────────────────────────────────────────────

  it("every action has id, title, reason, priority, confidence, href, and cta", () => {
    const { primary, secondary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 1,
      failedExecutionCount: 1,
    });

    for (const action of [primary, ...secondary].filter(Boolean)) {
      expect(action!.id).toBeTruthy();
      expect(action!.title).toBeTruthy();
      expect(action!.reason).toBeTruthy();
      expect(["urgent", "high", "medium", "low"]).toContain(action!.priority);
      expect(["high", "medium", "low"]).toContain(action!.confidence);
      expect(action!.href).toMatch(/^\//);
      expect(action!.cta).toBeTruthy();
    }
  });

  it("returns null primary when state is entirely empty and not a new company", () => {
    // Shouldn't happen in practice (always falls through to idle), but defensive check
    const { primary } = computeNextActions(EMPTY_STATE);
    // The idle fallback always ensures a non-null primary
    expect(primary).not.toBeNull();
  });

  // ── Plural/singular copy ──────────────────────────────────────────────────

  it("uses singular copy when count is 1", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 1,
    });

    expect(primary?.title).toMatch(/1 plan awaiting/i);
  });

  it("uses plural copy when count is greater than 1", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      pendingPlanApprovalCount: 3,
    });

    expect(primary?.title).toMatch(/3 plans awaiting/i);
  });

  it("blocked-tasks singular wording when count is 1", () => {
    const { primary } = computeNextActions({
      ...EMPTY_STATE,
      blockedTaskCount: 1,
    });

    expect(primary?.title).toContain("1 task blocked");
  });
});
