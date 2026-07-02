/**
 * Autonomy Policy — the single source of truth for what an agent may do at each
 * autonomy level without explicit CEO approval.
 *
 * The five autonomy levels (Manual / Suggest / Assist / Delegate / Autonomous)
 * are referenced across run-mode and worker-permissions, but nothing enforced a
 * single, shared policy for the *agentic actions* that touch real code: creating
 * an execution session, running the agent, pushing, opening a PR, and merging.
 *
 * Both the manual server actions and the autonomous execution driver (MUS-205)
 * MUST consult `authorizeAutonomyAction` / `evaluateAutonomyCheckpoint` here, so
 * the two paths produce identical authorization decisions for the same inputs.
 *
 * This module is pure (no I/O, no DB). Persistence and UI for approval
 * checkpoints are layered on by the callers; the state-transition primitives
 * (`createApprovalCheckpoint`, `approveCheckpoint`, `rejectCheckpoint`) are
 * provided here so callers share one definition of the checkpoint lifecycle.
 */

import { randomUUID } from "node:crypto";

import type { AutonomyLevel } from "@/lib/worker-permissions";

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Agentic actions that touch (or move toward touching) real code and therefore
 * fall under autonomy gating.
 *
 * - `create_session` — prepare/queue an execution session for a task.
 * - `run_agent`      — start the agent against the checked-out repository.
 * - `push`           — push the agent's branch to origin.
 * - `open_pr`        — open a pull request from the session branch.
 * - `auto_merge`     — merge the PR without human review.
 * - `auto_review`    — drive an automated code review without human sign-off.
 * - `auto_qa`        — drive automated QA and pass the gate without human sign-off.
 * - `apply_plan`     — approve + apply a generated planning draft (create the
 *   Project/Feature/Task records) without a human clicking Approve/Apply.
 */
export const AUTONOMY_ACTIONS = [
  "create_session",
  "run_agent",
  "push",
  "open_pr",
  "auto_merge",
  "auto_review",
  "auto_qa",
  "apply_plan",
] as const;

export type AutonomyAction = (typeof AUTONOMY_ACTIONS)[number];

/**
 * Disposition of an action at a given autonomy level.
 *
 * - `allow`             — may proceed immediately, no checkpoint.
 * - `requires_approval` — permitted, but a CEO approval checkpoint must clear first.
 * - `deny`              — never permitted at this level.
 */
export type AutonomyDisposition = "allow" | "requires_approval" | "deny";

/** Per-action disposition map for one autonomy level. */
export type AutonomyActionMatrix = Readonly<Record<AutonomyAction, AutonomyDisposition>>;

// ─── The action matrix ───────────────────────────────────────────────────────

/**
 * The documented action matrix: autonomy level → disposition per action.
 *
 * | Action          | manual | suggest | assist | delegate | autonomous |
 * |-----------------|--------|---------|--------|----------|------------|
 * | create_session  | appr.  | allow   | allow  | allow    | allow      |
 * | run_agent       | appr.  | appr.   | appr.  | allow    | allow      |
 * | push            | appr.  | appr.   | allow  | allow    | allow      |
 * | open_pr         | appr.  | appr.   | allow  | allow    | allow      |
 * | auto_merge      | deny   | deny    | appr.  | appr.    | allow      |
 * | auto_review     | appr.  | appr.   | appr.  | allow    | allow      |
 * | auto_qa         | appr.  | appr.   | appr.  | allow    | allow      |
 * | apply_plan      | appr.  | appr.   | appr.  | allow    | allow      |
 *
 * (`appr.` = requires_approval). Rationale:
 * - manual: a human performs each step; every agent action is gated and merges
 *   are never automated.
 * - suggest: the agent may prepare work freely but running/pushing/opening a PR
 *   is gated; merges are never automated.
 * - assist: the agent executes with a confirmation gate before running; pushing
 *   and opening a PR proceed, merging and review/QA sign-off stay gated.
 * - delegate: supervised — everything proceeds (incl. automated review/QA and
 *   auto-applying plans) except auto-merge, which is gated.
 * - autonomous: fully automated, including auto-merge and applying plans (still
 *   within guardrails). A single chat message can reach a shipped PR with no
 *   human click.
 */
export const AUTONOMY_POLICY_MATRIX: Readonly<
  Record<AutonomyLevel, AutonomyActionMatrix>
> = {
  manual: {
    create_session: "requires_approval",
    run_agent: "requires_approval",
    push: "requires_approval",
    open_pr: "requires_approval",
    auto_merge: "deny",
    auto_review: "requires_approval",
    auto_qa: "requires_approval",
    apply_plan: "requires_approval",
  },
  suggest: {
    create_session: "allow",
    run_agent: "requires_approval",
    push: "requires_approval",
    open_pr: "requires_approval",
    auto_merge: "deny",
    auto_review: "requires_approval",
    auto_qa: "requires_approval",
    apply_plan: "requires_approval",
  },
  assist: {
    create_session: "allow",
    run_agent: "requires_approval",
    push: "allow",
    open_pr: "allow",
    auto_merge: "requires_approval",
    auto_review: "requires_approval",
    auto_qa: "requires_approval",
    apply_plan: "requires_approval",
  },
  delegate: {
    create_session: "allow",
    run_agent: "allow",
    push: "allow",
    open_pr: "allow",
    auto_merge: "requires_approval",
    auto_review: "allow",
    auto_qa: "allow",
    apply_plan: "allow",
  },
  autonomous: {
    create_session: "allow",
    run_agent: "allow",
    push: "allow",
    open_pr: "allow",
    auto_merge: "allow",
    auto_review: "allow",
    auto_qa: "allow",
    apply_plan: "allow",
  },
};

/**
 * Normalizes an arbitrary autonomy level string to a known level, falling back
 * to the safest level (`manual`) for unknown input.
 *
 * @param level - Raw autonomy level value (e.g. from CompanySettings).
 * @returns A known AutonomyLevel.
 */
export function normalizeAutonomyLevel(level: string | null | undefined): AutonomyLevel {
  if (level && level in AUTONOMY_POLICY_MATRIX) {
    return level as AutonomyLevel;
  }
  return "manual";
}

// ─── Decisions ───────────────────────────────────────────────────────────────

/** The authorization decision for a single (level, action) pair. */
export interface AutonomyDecision {
  readonly level: AutonomyLevel;
  readonly action: AutonomyAction;
  readonly disposition: AutonomyDisposition;
  /** True only when the action may proceed right now without a checkpoint. */
  readonly allowed: boolean;
  /** True when a CEO approval checkpoint must clear before proceeding. */
  readonly requiresApproval: boolean;
  /** Human-readable explanation of the decision. */
  readonly reason: string;
}

/**
 * Returns the authorization decision for an action at an autonomy level.
 *
 * This is the single function both the manual path and the autonomous driver
 * call, guaranteeing identical decisions for identical inputs.
 *
 * @param level - Autonomy level (unknown values normalize to `manual`).
 * @param action - The agentic action being authorized.
 * @returns The decision, including `allowed` / `requiresApproval` flags.
 *
 * @example
 * ```ts
 * authorizeAutonomyAction("assist", "auto_merge").requiresApproval; // true
 * authorizeAutonomyAction("autonomous", "push").allowed; // true
 * ```
 */
export function authorizeAutonomyAction(
  level: string | null | undefined,
  action: AutonomyAction
): AutonomyDecision {
  const normalized = normalizeAutonomyLevel(level);
  const disposition = AUTONOMY_POLICY_MATRIX[normalized][action];

  return {
    level: normalized,
    action,
    disposition,
    allowed: disposition === "allow",
    requiresApproval: disposition === "requires_approval",
    reason: describeDisposition(normalized, action, disposition),
  };
}

/**
 * Builds the explanation string for a decision.
 */
function describeDisposition(
  level: AutonomyLevel,
  action: AutonomyAction,
  disposition: AutonomyDisposition
): string {
  switch (disposition) {
    case "allow":
      return `Autonomy "${level}" permits "${action}" without approval.`;
    case "requires_approval":
      return `Autonomy "${level}" requires CEO approval before "${action}".`;
    case "deny":
      return `Autonomy "${level}" never permits "${action}".`;
  }
}

// ─── Approval checkpoints ────────────────────────────────────────────────────

export type ApprovalCheckpointStatus =
  | "awaiting_approval"
  | "approved"
  | "rejected";

/** Context attached to a checkpoint so a CEO can decide without digging. */
export interface ApprovalContext {
  /** Task the checkpoint relates to, when applicable. */
  readonly taskId?: string | null;
  /** Execution session the checkpoint relates to, when applicable. */
  readonly sessionId?: string | null;
  /** One-line human-readable summary of what is being approved. */
  readonly summary: string;
  /** Optional structured detail for richer review UIs. */
  readonly details?: Record<string, unknown>;
}

/** A pending or resolved approval checkpoint. */
export interface ApprovalCheckpoint {
  readonly id: string;
  readonly level: AutonomyLevel;
  readonly action: AutonomyAction;
  readonly status: ApprovalCheckpointStatus;
  readonly context: ApprovalContext;
  /** ISO 8601 timestamp the checkpoint was raised. */
  readonly createdAt: string;
  /** ISO 8601 timestamp the checkpoint was resolved, or null while pending. */
  readonly resolvedAt: string | null;
  /** Identifier of the approver/rejecter, or null while pending. */
  readonly resolvedBy: string | null;
}

/**
 * Creates a new checkpoint in the `awaiting_approval` state.
 *
 * @param level - Autonomy level that triggered the checkpoint.
 * @param action - Action awaiting approval.
 * @param context - Decision context for the CEO.
 * @returns A pending ApprovalCheckpoint.
 */
export function createApprovalCheckpoint(
  level: AutonomyLevel,
  action: AutonomyAction,
  context: ApprovalContext
): ApprovalCheckpoint {
  return {
    id: randomUUID(),
    level,
    action,
    status: "awaiting_approval",
    context,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
}

/**
 * Marks a pending checkpoint approved. Resolving an already-resolved checkpoint
 * throws to prevent double-resolution.
 *
 * @param checkpoint - The pending checkpoint.
 * @param approvedBy - Identifier of the approver.
 * @returns A new checkpoint in the `approved` state.
 * @throws Error when the checkpoint is not pending.
 */
export function approveCheckpoint(
  checkpoint: ApprovalCheckpoint,
  approvedBy: string
): ApprovalCheckpoint {
  assertPending(checkpoint);
  return {
    ...checkpoint,
    status: "approved",
    resolvedAt: new Date().toISOString(),
    resolvedBy: approvedBy,
  };
}

/**
 * Marks a pending checkpoint rejected.
 *
 * @param checkpoint - The pending checkpoint.
 * @param rejectedBy - Identifier of the rejecter.
 * @returns A new checkpoint in the `rejected` state.
 * @throws Error when the checkpoint is not pending.
 */
export function rejectCheckpoint(
  checkpoint: ApprovalCheckpoint,
  rejectedBy: string
): ApprovalCheckpoint {
  assertPending(checkpoint);
  return {
    ...checkpoint,
    status: "rejected",
    resolvedAt: new Date().toISOString(),
    resolvedBy: rejectedBy,
  };
}

/** Returns true once a checkpoint has been approved or rejected. */
export function isCheckpointResolved(checkpoint: ApprovalCheckpoint): boolean {
  return checkpoint.status !== "awaiting_approval";
}

function assertPending(checkpoint: ApprovalCheckpoint): void {
  if (checkpoint.status !== "awaiting_approval") {
    throw new Error(
      `Checkpoint ${checkpoint.id} is already ${checkpoint.status} and cannot be re-resolved.`
    );
  }
}

// ─── Combined evaluation (the seam both paths use) ───────────────────────────

/**
 * Outcome of evaluating an action against the policy and any prior approval.
 *
 * - `proceed`           — the action may run now.
 * - `awaiting_approval` — a checkpoint is required; `checkpoint` is the new
 *   pending record the caller should persist and surface for review.
 * - `blocked`           — the action is denied at this level.
 */
export type CheckpointOutcome =
  | { readonly type: "proceed"; readonly decision: AutonomyDecision }
  | {
      readonly type: "awaiting_approval";
      readonly decision: AutonomyDecision;
      readonly checkpoint: ApprovalCheckpoint;
    }
  | { readonly type: "blocked"; readonly decision: AutonomyDecision };

/** Input for {@link evaluateAutonomyCheckpoint}. */
export interface EvaluateCheckpointInput {
  readonly level: string | null | undefined;
  readonly action: AutonomyAction;
  readonly context: ApprovalContext;
  /**
   * True when an approval checkpoint for this action has already been granted
   * (e.g. a CEO approved it, or — on the manual path — the human is performing
   * the action). When true, a `requires_approval` action proceeds.
   */
  readonly hasApproval?: boolean;
}

/**
 * Evaluates an action against the autonomy policy and returns whether it may
 * proceed, must wait for approval (raising a checkpoint), or is blocked.
 *
 * Both the manual server actions and the autonomous driver call this so their
 * authorization is identical: the only difference between the two is what they
 * pass for `hasApproval` (the manual path treats the human click as approval;
 * the driver passes the persisted checkpoint's approval state).
 *
 * @param input - Level, action, decision context, and prior-approval flag.
 * @returns A {@link CheckpointOutcome}.
 */
export function evaluateAutonomyCheckpoint(
  input: EvaluateCheckpointInput
): CheckpointOutcome {
  const decision = authorizeAutonomyAction(input.level, input.action);

  if (decision.disposition === "deny") {
    return { type: "blocked", decision };
  }

  if (decision.disposition === "allow" || input.hasApproval === true) {
    return { type: "proceed", decision };
  }

  // requires_approval and not yet approved → raise a checkpoint.
  return {
    type: "awaiting_approval",
    decision,
    checkpoint: createApprovalCheckpoint(
      decision.level,
      input.action,
      input.context
    ),
  };
}
