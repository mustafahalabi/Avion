import { describe, expect, it } from "vitest";

import {
  approveCheckpoint,
  authorizeAutonomyAction,
  AUTONOMY_ACTIONS,
  AUTONOMY_POLICY_MATRIX,
  createApprovalCheckpoint,
  evaluateAutonomyCheckpoint,
  isCheckpointResolved,
  normalizeAutonomyLevel,
  rejectCheckpoint,
  type AutonomyAction,
} from "./autonomy-policy";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "./worker-permissions";

describe("AUTONOMY_POLICY_MATRIX", () => {
  it("documents a disposition for every level × action (exhaustive matrix)", () => {
    for (const level of AUTONOMY_LEVELS) {
      for (const action of AUTONOMY_ACTIONS) {
        const disposition = AUTONOMY_POLICY_MATRIX[level][action];
        expect(["allow", "requires_approval", "deny"]).toContain(disposition);
      }
    }
  });

  it("matches the documented action matrix", () => {
    // A representative snapshot of the documented matrix to guard regressions.
    const expected: Record<AutonomyLevel, Record<AutonomyAction, string>> = {
      manual: {
        create_session: "requires_approval",
        run_agent: "requires_approval",
        push: "requires_approval",
        open_pr: "requires_approval",
        auto_merge: "deny",
        auto_review: "requires_approval",
        auto_qa: "requires_approval",
      },
      suggest: {
        create_session: "allow",
        run_agent: "requires_approval",
        push: "requires_approval",
        open_pr: "requires_approval",
        auto_merge: "deny",
        auto_review: "requires_approval",
        auto_qa: "requires_approval",
      },
      assist: {
        create_session: "allow",
        run_agent: "requires_approval",
        push: "allow",
        open_pr: "allow",
        auto_merge: "requires_approval",
        auto_review: "requires_approval",
        auto_qa: "requires_approval",
      },
      delegate: {
        create_session: "allow",
        run_agent: "allow",
        push: "allow",
        open_pr: "allow",
        auto_merge: "requires_approval",
        auto_review: "allow",
        auto_qa: "allow",
      },
      autonomous: {
        create_session: "allow",
        run_agent: "allow",
        push: "allow",
        open_pr: "allow",
        auto_merge: "allow",
        auto_review: "allow",
        auto_qa: "allow",
      },
    };

    expect(AUTONOMY_POLICY_MATRIX).toEqual(expected);
  });

  it("escalates permissiveness monotonically (manual is the strictest)", () => {
    // auto_merge is only fully unlocked at autonomous.
    expect(AUTONOMY_POLICY_MATRIX.manual.auto_merge).toBe("deny");
    expect(AUTONOMY_POLICY_MATRIX.autonomous.auto_merge).toBe("allow");
    // run_agent proceeds without approval only at delegate+.
    expect(AUTONOMY_POLICY_MATRIX.assist.run_agent).toBe("requires_approval");
    expect(AUTONOMY_POLICY_MATRIX.delegate.run_agent).toBe("allow");
  });
});

describe("normalizeAutonomyLevel", () => {
  it("passes through known levels", () => {
    for (const level of AUTONOMY_LEVELS) {
      expect(normalizeAutonomyLevel(level)).toBe(level);
    }
  });

  it("falls back to the strictest level for unknown / empty input", () => {
    expect(normalizeAutonomyLevel("nonsense")).toBe("manual");
    expect(normalizeAutonomyLevel(null)).toBe("manual");
    expect(normalizeAutonomyLevel(undefined)).toBe("manual");
  });
});

describe("authorizeAutonomyAction", () => {
  it("sets allowed only for allow dispositions", () => {
    const allow = authorizeAutonomyAction("autonomous", "push");
    expect(allow.allowed).toBe(true);
    expect(allow.requiresApproval).toBe(false);
    expect(allow.disposition).toBe("allow");
  });

  it("sets requiresApproval for requires_approval dispositions", () => {
    const appr = authorizeAutonomyAction("assist", "auto_merge");
    expect(appr.allowed).toBe(false);
    expect(appr.requiresApproval).toBe(true);
    expect(appr.reason).toMatch(/requires CEO approval/);
  });

  it("marks denied actions neither allowed nor approvable", () => {
    const deny = authorizeAutonomyAction("manual", "auto_merge");
    expect(deny.allowed).toBe(false);
    expect(deny.requiresApproval).toBe(false);
    expect(deny.disposition).toBe("deny");
  });

  it("normalizes unknown levels to the strictest decision", () => {
    expect(authorizeAutonomyAction("???", "push").level).toBe("manual");
  });

  it("is deterministic — identical inputs yield identical decisions", () => {
    // The single source of truth both the manual path and driver consult.
    for (const level of AUTONOMY_LEVELS) {
      for (const action of AUTONOMY_ACTIONS) {
        const a = authorizeAutonomyAction(level, action);
        const b = authorizeAutonomyAction(level, action);
        expect(a).toEqual(b);
      }
    }
  });
});

describe("approval checkpoint lifecycle", () => {
  const ctx = { taskId: "task-1", summary: "Push agent branch" };

  it("creates a pending checkpoint", () => {
    const cp = createApprovalCheckpoint("assist", "auto_merge", ctx);
    expect(cp.status).toBe("awaiting_approval");
    expect(cp.resolvedAt).toBeNull();
    expect(cp.resolvedBy).toBeNull();
    expect(cp.context).toEqual(ctx);
    expect(isCheckpointResolved(cp)).toBe(false);
  });

  it("approves a pending checkpoint", () => {
    const cp = createApprovalCheckpoint("assist", "auto_merge", ctx);
    const approved = approveCheckpoint(cp, "ceo-user");
    expect(approved.status).toBe("approved");
    expect(approved.resolvedBy).toBe("ceo-user");
    expect(approved.resolvedAt).not.toBeNull();
    expect(isCheckpointResolved(approved)).toBe(true);
  });

  it("rejects a pending checkpoint", () => {
    const cp = createApprovalCheckpoint("assist", "auto_merge", ctx);
    const rejected = rejectCheckpoint(cp, "ceo-user");
    expect(rejected.status).toBe("rejected");
    expect(isCheckpointResolved(rejected)).toBe(true);
  });

  it("refuses to re-resolve an already-resolved checkpoint", () => {
    const cp = approveCheckpoint(
      createApprovalCheckpoint("assist", "auto_merge", ctx),
      "ceo"
    );
    expect(() => approveCheckpoint(cp, "ceo2")).toThrow(/already approved/);
    expect(() => rejectCheckpoint(cp, "ceo2")).toThrow(/already approved/);
  });
});

describe("evaluateAutonomyCheckpoint", () => {
  const context = { taskId: "task-1", summary: "Auto-merge PR" };

  it("proceeds when the action is allowed at the level", () => {
    const outcome = evaluateAutonomyCheckpoint({
      level: "autonomous",
      action: "auto_merge",
      context,
    });
    expect(outcome.type).toBe("proceed");
  });

  it("raises a checkpoint when approval is required and not yet granted", () => {
    const outcome = evaluateAutonomyCheckpoint({
      level: "delegate",
      action: "auto_merge",
      context,
    });
    expect(outcome.type).toBe("awaiting_approval");
    if (outcome.type === "awaiting_approval") {
      expect(outcome.checkpoint.status).toBe("awaiting_approval");
      expect(outcome.checkpoint.action).toBe("auto_merge");
      expect(outcome.checkpoint.context).toEqual(context);
    }
  });

  it("proceeds when approval was already granted (driver resume / manual click)", () => {
    const outcome = evaluateAutonomyCheckpoint({
      level: "delegate",
      action: "auto_merge",
      context,
      hasApproval: true,
    });
    expect(outcome.type).toBe("proceed");
  });

  it("blocks when the action is denied at the level", () => {
    const outcome = evaluateAutonomyCheckpoint({
      level: "manual",
      action: "auto_merge",
      context,
    });
    expect(outcome.type).toBe("blocked");
  });

  it("blocks denied actions even when approval is claimed", () => {
    const outcome = evaluateAutonomyCheckpoint({
      level: "suggest",
      action: "auto_merge",
      context,
      hasApproval: true,
    });
    expect(outcome.type).toBe("blocked");
  });

  it("produces the same decision the driver would for the same inputs", () => {
    // Manual path (human click → hasApproval) and a hypothetical driver pass
    // both flow through authorizeAutonomyAction → identical decision object.
    const manual = evaluateAutonomyCheckpoint({
      level: "assist",
      action: "push",
      context,
      hasApproval: true,
    });
    const driver = evaluateAutonomyCheckpoint({
      level: "assist",
      action: "push",
      context,
      hasApproval: false,
    });
    expect(manual.decision).toEqual(driver.decision);
  });
});
