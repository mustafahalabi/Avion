import type { NextAction } from "./next-action-recommendation";
import type { PendingCheckpoint } from "./approval-checkpoints";
import type { StuckWorkItem } from "./stuck-work-detector";
import type {
  ProviderCardState,
  ProviderCardStatus,
  ProviderDef,
} from "./provider-card-state";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttentionSeverity = "critical" | "warning" | "info";

export type AttentionKind =
  | "plan_approval"
  | "review_checkpoint"
  | "qa_checkpoint"
  | "awaiting_request"
  | "blocked"
  | "stuck"
  | "failed_execution";

export interface AttentionItem {
  /** Stable identifier used for list keys and de-duplication. */
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
  /** Present when the item is an inline-actionable review/QA checkpoint. */
  checkpoint?: { kind: "review" | "qa"; id: string };
  /** When the underlying signal occurred, used for recency ordering. */
  occurredAt?: Date;
}

export interface CompanyStateSummary {
  activeEmployees: number;
  activeProjects: number;
  tasksInProgress: number;
  blockedTasks: number;
  openRequests: number;
  memoryBanks: number;
}

export interface ProviderHealthItem {
  id: string;
  name: string;
  cardStatus: ProviderCardStatus;
  statusLabel: string;
  healthy: boolean;
}

export interface ControlCenterViewModel {
  primaryAction: NextAction | null;
  secondaryActions: NextAction[];
  attention: AttentionItem[];
  attentionCount: number;
  criticalCount: number;
  companyState: CompanyStateSummary;
  providerHealth: ProviderHealthItem[];
  providerNeedsAttention: boolean;
}

/**
 * Pure input carrying already-fetched service results. No I/O is performed in
 * this module — all data is gathered by the caller (the Server Component page).
 */
export interface ControlCenterInput {
  primaryAction: NextAction | null;
  secondaryActions: NextAction[];
  pendingCheckpoints: readonly PendingCheckpoint[];
  stuckWork: readonly StuckWorkItem[];
  awaitingApprovalRequests: readonly { id: string; title: string }[];
  blockedRequests: readonly { id: string; title: string }[];
  companyState: CompanyStateSummary;
  providers: readonly { def: ProviderDef; state: ProviderCardState }[];
}

// ─── Builder ──────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const STUCK_SEVERITY: Record<StuckWorkItem["severity"], AttentionSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

const FAILED_STUCK_CATEGORIES: ReadonlySet<StuckWorkItem["category"]> = new Set([
  "failed_execution_loop",
  "failed_validation_loop",
]);

/**
 * Builds the CEO Control Center view model from already-fetched service results.
 *
 * Maps every signal source into a unified, de-duplicated, and prioritized list
 * of {@link AttentionItem}s (critical → warning → info, then most-recent first),
 * derives provider health, and re-exposes the recommended next actions.
 *
 * Pure — no I/O; safe to unit-test without a database.
 */
export function buildControlCenterViewModel(
  input: ControlCenterInput
): ControlCenterViewModel {
  const items: AttentionItem[] = [];

  // ── Review / QA checkpoints (inline-actionable, always critical) ───────────
  for (const checkpoint of input.pendingCheckpoints) {
    items.push({
      id: checkpoint.id,
      kind: checkpoint.kind === "qa" ? "qa_checkpoint" : "review_checkpoint",
      severity: "critical",
      title: checkpoint.taskTitle,
      detail:
        checkpoint.kind === "qa"
          ? "Task is paused for your QA sign-off."
          : "Task is paused for your review approval.",
      href: `/work/tasks/${checkpoint.taskId}`,
      checkpoint: { kind: checkpoint.kind, id: checkpoint.id },
      occurredAt: checkpoint.createdAt,
    });
  }

  // ── Requests awaiting approval (critical) ──────────────────────────────────
  for (const request of input.awaitingApprovalRequests) {
    items.push({
      id: request.id,
      kind: "awaiting_request",
      severity: "critical",
      title: request.title,
      detail: "Request is stalled until you approve it.",
      href: `/inbox/requests/${request.id}`,
    });
  }

  // ── Blocked requests (warning) ─────────────────────────────────────────────
  for (const request of input.blockedRequests) {
    items.push({
      id: request.id,
      kind: "blocked",
      severity: "warning",
      title: request.title,
      detail: "Request is blocked and needs your attention.",
      href: `/inbox/requests/${request.id}`,
    });
  }

  // ── Stuck / failed work (severity-mapped from the detector) ────────────────
  for (const stuck of input.stuckWork) {
    items.push({
      id: stuck.entityId,
      kind: FAILED_STUCK_CATEGORIES.has(stuck.category)
        ? "failed_execution"
        : "stuck",
      severity: STUCK_SEVERITY[stuck.severity],
      title: stuck.title,
      detail: stuck.description,
      href: stuck.linkPath,
    });
  }

  // ── De-dupe by id (first occurrence wins) ──────────────────────────────────
  const byId = new Map<string, AttentionItem>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const attention = [...byId.values()].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    const aTime = a.occurredAt ? a.occurredAt.getTime() : 0;
    const bTime = b.occurredAt ? b.occurredAt.getTime() : 0;
    return bTime - aTime;
  });

  const criticalCount = attention.filter(
    (item) => item.severity === "critical"
  ).length;

  // ── Provider health ────────────────────────────────────────────────────────
  const providerHealth: ProviderHealthItem[] = input.providers.map(
    ({ def, state }) => ({
      id: def.id,
      name: def.name,
      cardStatus: state.cardStatus,
      statusLabel: state.statusLabel,
      healthy: state.cardStatus === "connected",
    })
  );
  const providerNeedsAttention = providerHealth.some((p) => !p.healthy);

  return {
    primaryAction: input.primaryAction,
    secondaryActions: input.secondaryActions,
    attention,
    attentionCount: attention.length,
    criticalCount,
    companyState: input.companyState,
    providerHealth,
    providerNeedsAttention,
  };
}
