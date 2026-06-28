// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionPriority = "urgent" | "high" | "medium" | "low";
export type ActionConfidence = "high" | "medium" | "low";

export interface NextAction {
  /** Stable identifier used for list keys and deduplication */
  id: string;
  title: string;
  /** One-sentence explanation grounding the recommendation in workspace state */
  reason: string;
  priority: ActionPriority;
  confidence: ActionConfidence;
  href: string;
  cta: string;
}

/**
 * Pure snapshot of workspace state fed into the recommendation engine.
 * All counts are non-negative integers.
 */
export interface WorkspaceActionState {
  /** PlanningDrafts awaiting CEO approval (status = "review") */
  pendingPlanApprovalCount: number;
  /** RuntimeRequests awaiting approval (legacy status = "awaiting_approval") */
  awaitingApprovalRequestCount: number;
  /** ExecutionSessions in status "failed" */
  failedExecutionCount: number;
  /** ExecutionSessions in status "needs_clarification" */
  needsClarificationCount: number;
  /** Tasks in status "blocked" */
  blockedTaskCount: number;
  /** RuntimeRequests in status "blocked" */
  blockedRequestCount: number;
  /** ExecutionSessions in status "queued" or "prepared" (ready but not running) */
  readyExecutionCount: number;
  /** ExecutionSessions currently running */
  runningExecutionCount: number;
  /** RuntimeRequests not in complete/cancelled state */
  activeRequestCount: number;
  /** True when the company has no requests, tasks, or events at all */
  isNewCompany: boolean;
}

export interface ActionRecommendation {
  primary: NextAction | null;
  secondary: NextAction[];
}

// ─── Rule engine ─────────────────────────────────────────────────────────────

/**
 * Computes a prioritized list of recommended next actions from a pure workspace
 * snapshot. Returns one primary action and up to three secondary actions.
 *
 * Priority order (highest first):
 *  1. Pending plan approvals
 *  2. Failed or stalled executions (failed / needs_clarification)
 *  3. Blocked tasks or requests
 *  4. Ready-to-run execution sessions
 *  5. Active work being monitored
 *  6. Idle company (no active requests)
 */
export function computeNextActions(
  state: WorkspaceActionState
): ActionRecommendation {
  const candidates: NextAction[] = [];

  // ── 1. Plan approvals (urgent) ────────────────────────────────────────────

  if (state.pendingPlanApprovalCount > 0) {
    const n = state.pendingPlanApprovalCount;
    candidates.push({
      id: "pending_plan_approval",
      title: `${n} plan${n === 1 ? "" : "s"} awaiting your approval`,
      reason: `${n} planning draft${n === 1 ? " is" : "s are"} ready for CEO review. Approving unlocks the next execution cycle.`,
      priority: "urgent",
      confidence: "high",
      href: "/work/projects",
      cta: "Review plans",
    });
  }

  if (state.awaitingApprovalRequestCount > 0) {
    const n = state.awaitingApprovalRequestCount;
    candidates.push({
      id: "awaiting_approval_requests",
      title: `${n} request${n === 1 ? "" : "s"} awaiting approval`,
      reason: `${n} request${n === 1 ? " is" : "s are"} stalled until you approve them. Each hour of delay slows the team.`,
      priority: "urgent",
      confidence: "high",
      href: "/inbox",
      cta: "Review requests",
    });
  }

  // ── 2. Failed or stalled executions (high) ────────────────────────────────

  if (state.failedExecutionCount > 0) {
    const n = state.failedExecutionCount;
    candidates.push({
      id: "failed_executions",
      title: `${n} execution session${n === 1 ? "" : "s"} failed`,
      reason: `${n === 1 ? "An agent" : `${n} agents`} could not complete implementation. Review the failure and decide whether to retry or escalate.`,
      priority: "high",
      confidence: "high",
      href: "/work",
      cta: "View failed sessions",
    });
  }

  if (state.needsClarificationCount > 0) {
    const n = state.needsClarificationCount;
    candidates.push({
      id: "needs_clarification",
      title: `${n} execution session${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} clarification`,
      reason: `An agent paused and requested additional context before continuing. Your input is needed to unblock implementation.`,
      priority: "high",
      confidence: "high",
      href: "/work",
      cta: "Provide clarification",
    });
  }

  // ── 3. Blocked work (high) ────────────────────────────────────────────────

  if (state.blockedRequestCount > 0) {
    const n = state.blockedRequestCount;
    candidates.push({
      id: "blocked_requests",
      title: `${n} request${n === 1 ? "" : "s"} blocked`,
      reason: `${n === 1 ? "A request is" : `${n} requests are`} stuck. Unblocking them is the fastest way to restore velocity.`,
      priority: "high",
      confidence: "high",
      href: "/inbox",
      cta: "View blocked requests",
    });
  }

  if (state.blockedTaskCount > 0) {
    const n = state.blockedTaskCount;
    candidates.push({
      id: "blocked_tasks",
      title: `${n} task${n === 1 ? "" : "s"} blocked`,
      reason: `${n === 1 ? "A task is" : `${n} tasks are`} blocked and cannot advance until the blocker is resolved.`,
      priority: "high",
      confidence: "medium",
      href: "/work",
      cta: "View work board",
    });
  }

  // ── 4. Ready execution sessions (medium) ─────────────────────────────────

  if (state.readyExecutionCount > 0) {
    const n = state.readyExecutionCount;
    candidates.push({
      id: "ready_executions",
      title: `${n} session${n === 1 ? "" : "s"} ready to execute`,
      reason: `${n === 1 ? "One implementation session is" : `${n} implementation sessions are`} queued and prepared. Hand off to an agent to start implementation.`,
      priority: "medium",
      confidence: "high",
      href: "/work",
      cta: "Start execution",
    });
  }

  // ── 5. Active work (low) ──────────────────────────────────────────────────

  if (state.runningExecutionCount > 0) {
    const n = state.runningExecutionCount;
    candidates.push({
      id: "running_executions",
      title: `${n} session${n === 1 ? "" : "s"} in progress`,
      reason: `Agents are actively working. Check back for results or review work in progress.`,
      priority: "low",
      confidence: "high",
      href: "/work",
      cta: "Monitor execution",
    });
  } else if (state.activeRequestCount > 0) {
    candidates.push({
      id: "active_requests",
      title: "Company is executing",
      reason: "Your team is working through the active request pipeline. Monitor for updates or submit the next priority.",
      priority: "low",
      confidence: "medium",
      href: "/inbox",
      cta: "Open inbox",
    });
  }

  // ── 6. Idle / new company (low) ───────────────────────────────────────────

  if (candidates.length === 0) {
    if (state.isNewCompany) {
      candidates.push({
        id: "new_company",
        title: "Submit your first outcome",
        reason: "Your company is set up and your team is standing by. Submit a desired outcome to generate an execution plan.",
        priority: "low",
        confidence: "high",
        href: "/inbox",
        cta: "Submit first request",
      });
    } else {
      candidates.push({
        id: "no_active_work",
        title: "No active requests",
        reason: "All requests are complete or cancelled. Submit a new request to start the next initiative.",
        priority: "low",
        confidence: "high",
        href: "/inbox",
        cta: "Submit a request",
      });
    }
  }

  // Sort by priority (urgent → high → medium → low) then confidence (high first)
  const PRIORITY_RANK: Record<ActionPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const CONFIDENCE_RANK: Record<ActionConfidence, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  candidates.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]
  );

  const [primary, ...rest] = candidates;
  return {
    primary: primary ?? null,
    secondary: rest.slice(0, 3),
  };
}
