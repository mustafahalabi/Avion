/**
 * Canonical, CEO-facing work lifecycle model for the Live view.
 *
 * Where {@link ./github-workflow-status} models the narrow PR-centric loop
 * (planned → running → reviewed → merged) for a single task page, this module
 * models the *whole* delivery pipeline the CEO watches on the Live board — from
 * a plan still awaiting approval, through the agent building, code review, QA,
 * and finally a merged delivery.
 *
 * It is intentionally **pure**: no Prisma, no I/O. Callers (Server Components /
 * the {@link ./live-pipeline-data} loader) gather rows and map them into
 * {@link WorkItemInput}s; this module derives the stage, the "what's happening
 * now" line, and groups items into the board. That keeps the derivation fully
 * unit-testable.
 */

// ─── Stages ───────────────────────────────────────────────────────────────────

/**
 * Ordered lifecycle stages — the columns of the Live board, left → right.
 */
export const WORK_LIFECYCLE_STAGES = [
  "planning",
  "queued",
  "building",
  "review",
  "qa",
  "done",
] as const;

export type WorkStage = (typeof WORK_LIFECYCLE_STAGES)[number];

/** Whether a work item originates from a plan draft or a real task. */
export type WorkItemKind = "plan" | "task";

/**
 * Static, framework-free metadata for each stage. Colours / icons live in the
 * presentation layer; this is the data both the board and the pipeline bar read.
 */
export const STAGE_META: Record<
  WorkStage,
  { readonly label: string; readonly blurb: string }
> = {
  planning: { label: "Planning", blurb: "Plan being prepared / awaiting your approval" },
  queued: { label: "Queued", blurb: "Approved and waiting for an engineer" },
  building: { label: "Building", blurb: "An engineer is implementing the change" },
  review: { label: "Review", blurb: "Pull request open, in code review" },
  qa: { label: "QA", blurb: "Review approved, quality checks running" },
  done: { label: "Done", blurb: "Merged and delivered" },
};

/** Stages that represent work actively in flight (not upstream, not terminal). */
export const IN_FLIGHT_STAGES: readonly WorkStage[] = [
  "queued",
  "building",
  "review",
  "qa",
];

// ─── Input / output shapes ──────────────────────────────────────────────────────

/**
 * Raw, already-fetched signals for one item. Task fields are null for plan
 * items and vice-versa; the derivation tolerates any combination.
 */
export interface WorkItemInput {
  readonly id: string;
  readonly title: string;
  readonly kind: WorkItemKind;
  readonly href: string;
  readonly updatedAt: Date;

  /** Sub-label shown under the title (project / feature / outcome). */
  readonly context?: string | null;
  readonly assigneeName?: string | null;

  // ── Task-derived ──
  readonly taskStatus?: string | null;
  readonly sessionStatus?: string | null;
  readonly prStatus?: string | null;
  readonly prNumber?: number | null;
  readonly prUrl?: string | null;
  readonly mergeStatus?: string | null;
  readonly reviewStatus?: string | null;
  readonly qaStatus?: string | null;
  readonly qaPassedCount?: number | null;
  readonly qaFailedCount?: number | null;
  readonly branchName?: string | null;
  readonly filesChangedCount?: number | null;

  // ── Plan-derived ──
  readonly planStatus?: string | null;

  // ── Workflow grouping ──
  /** The outcome/plan this item belongs to (the "workflow" it's part of). */
  readonly workflowId?: string | null;
  readonly workflowTitle?: string | null;
}

/**
 * A fully-derived item ready to render as a card.
 */
export interface WorkItemView {
  readonly id: string;
  readonly title: string;
  readonly kind: WorkItemKind;
  readonly href: string;
  readonly stage: WorkStage;
  /** One human line describing what is happening right now. */
  readonly statusLine: string;
  /** Currently being acted on by the company (pulses on the card). */
  readonly isLive: boolean;
  /** Needs the CEO / a re-loop — surfaced in amber/red. */
  readonly isBlocked: boolean;
  /** Specifically waiting on a CEO decision (a softer "needs you"). */
  readonly awaitingApproval: boolean;
  readonly context: string | null;
  readonly assigneeName: string | null;
  readonly branchName: string | null;
  readonly prNumber: number | null;
  readonly prUrl: string | null;
  readonly updatedAt: Date;
  /** The outcome/plan this item belongs to (the "workflow" it's part of). */
  readonly workflowId: string | null;
  readonly workflowTitle: string | null;
}

export interface LifecycleColumn {
  readonly stage: WorkStage;
  readonly label: string;
  readonly blurb: string;
  readonly items: readonly WorkItemView[];
  /** Total items in this stage (may exceed items.length when capped). */
  readonly total: number;
}

export interface LifecycleBoard {
  readonly columns: readonly LifecycleColumn[];
  readonly stageCounts: Record<WorkStage, number>;
  /** Items in queued/building/review/qa — work currently in flight. */
  readonly activeCount: number;
  /** Items the company is acting on right now (isLive). */
  readonly liveCount: number;
  /** Items waiting on the CEO (blocked or awaiting approval). */
  readonly needsAttentionCount: number;
  readonly totalCount: number;
}

// ─── Derivation ─────────────────────────────────────────────────────────────────

function isMerged(input: WorkItemInput): boolean {
  return input.prStatus === "merged" || input.mergeStatus === "merged";
}

/**
 * Derives the lifecycle stage for a work item from its stored signals.
 *
 * Order matters: later stages win, so an item that has reached QA is not
 * mis-bucketed back into "building" by a stale earlier signal.
 *
 * @param input - Already-fetched signals for the item.
 * @returns The current lifecycle stage.
 *
 * @example
 * ```ts
 * deriveWorkStage({ kind: "task", taskStatus: "in-progress",
 *   sessionStatus: "running", ... }); // "building"
 * ```
 */
export function deriveWorkStage(input: WorkItemInput): WorkStage {
  if (input.kind === "plan") return "planning";

  if (isMerged(input) || input.taskStatus === "done") return "done";

  // Review approved → the work has advanced into QA.
  if (input.reviewStatus === "approved") return "qa";

  // QA recorded (passed/failed/blocked) without an approved review still means
  // the item is in the QA phase.
  if (
    input.qaStatus === "passed" ||
    input.qaStatus === "failed" ||
    input.qaStatus === "blocked"
  ) {
    return "qa";
  }

  if (
    input.taskStatus === "in-review" ||
    input.prStatus === "open" ||
    input.prStatus === "draft" ||
    input.reviewStatus === "changes_requested" ||
    input.reviewStatus === "pending"
  ) {
    return "review";
  }

  if (
    input.sessionStatus === "running" ||
    input.sessionStatus === "completed" ||
    input.taskStatus === "in-progress"
  ) {
    return "building";
  }

  // todo / queued / prepared / failed-before-start all wait in the queue.
  return "queued";
}

/**
 * Whether the company is actively acting on this item right now (drives the
 * pulsing live dot). Plan items awaiting a human are not "live".
 */
export function isWorkItemLive(input: WorkItemInput): boolean {
  if (input.kind === "plan") return input.planStatus === "generating";
  if (input.sessionStatus === "running") return true;
  if (input.sessionStatus === "completed") return true; // wrapping up → PR
  if (input.taskStatus === "in-progress") return true;
  return false;
}

/**
 * Whether the item needs the CEO or a re-loop (failed run, blocked task,
 * requested changes, failed QA).
 */
export function isWorkItemBlocked(input: WorkItemInput): boolean {
  if (input.sessionStatus === "failed") return true;
  if (input.sessionStatus === "needs_clarification") return true;
  if (input.taskStatus === "blocked") return true;
  if (input.reviewStatus === "changes_requested") return true;
  if (input.qaStatus === "failed" || input.qaStatus === "blocked") return true;
  return false;
}

/** Whether the item is specifically waiting on a CEO decision. */
export function isAwaitingApproval(input: WorkItemInput, stage: WorkStage): boolean {
  if (input.kind === "plan") {
    return input.planStatus === "draft" || input.planStatus === "reviewing";
  }
  // A finished review awaiting QA sign-off is handled by the gate, not the CEO.
  return stage === "review" && input.taskStatus === "in-review";
}

/**
 * Builds the "what's happening now" line for an item.
 */
export function buildWorkItemStatusLine(
  input: WorkItemInput,
  stage: WorkStage
): string {
  if (input.kind === "plan") {
    if (input.planStatus === "generating") return "Drafting the plan…";
    return "Plan ready — awaiting your approval";
  }

  const branch = input.branchName ? input.branchName : null;
  const files =
    typeof input.filesChangedCount === "number" && input.filesChangedCount > 0
      ? `${input.filesChangedCount} file${input.filesChangedCount === 1 ? "" : "s"}`
      : null;
  const pr = typeof input.prNumber === "number" ? `PR #${input.prNumber}` : null;

  switch (stage) {
    case "queued":
      if (input.sessionStatus === "prepared") return "Brief prepared — ready to build";
      if (input.sessionStatus === "failed") return "Last run failed — will retry";
      return "Queued for engineering";
    case "building":
      if (input.sessionStatus === "completed") {
        return "Implementation complete — opening pull request";
      }
      return [
        "Engineer building",
        branch ? `· ${branch}` : null,
        files ? `· ${files}` : null,
      ]
        .filter(Boolean)
        .join(" ");
    case "review":
      if (input.reviewStatus === "changes_requested") {
        return "Changes requested — re-looping the task";
      }
      if (pr) return `${pr} open · in code review`;
      return "In code review";
    case "qa": {
      if (input.qaStatus === "failed") return "QA failed — re-looping the task";
      if (input.qaStatus === "blocked") return "QA blocked — needs attention";
      const total = (input.qaPassedCount ?? 0) + (input.qaFailedCount ?? 0);
      if (input.qaStatus === "passed") {
        return total > 0
          ? `QA passed · ${input.qaPassedCount}/${total} checks`
          : "QA passed";
      }
      return "Running quality checks";
    }
    case "done":
      if (isMerged(input)) return pr ? `Merged · ${pr}` : "Merged & delivered";
      return "Delivered";
    case "planning":
      return "Awaiting your approval";
    default:
      return "In progress";
  }
}

/**
 * Fully derives a renderable {@link WorkItemView} from raw signals.
 *
 * @param input - Already-fetched signals for the item.
 * @returns The derived view used by the board cards.
 */
export function buildWorkItemView(input: WorkItemInput): WorkItemView {
  const stage = deriveWorkStage(input);
  return {
    id: input.id,
    title: input.title,
    kind: input.kind,
    href: input.href,
    stage,
    statusLine: buildWorkItemStatusLine(input, stage),
    isLive: isWorkItemLive(input),
    isBlocked: isWorkItemBlocked(input),
    awaitingApproval: isAwaitingApproval(input, stage),
    context: input.context ?? null,
    assigneeName: input.assigneeName ?? null,
    branchName: input.branchName ?? null,
    prNumber: input.prNumber ?? null,
    prUrl: input.prUrl ?? null,
    updatedAt: input.updatedAt,
    workflowId: input.workflowId ?? null,
    workflowTitle: input.workflowTitle ?? null,
  };
}

// ─── Board assembly ─────────────────────────────────────────────────────────────

export interface BuildLifecycleBoardOptions {
  /**
   * Max items to render in the terminal "done" column (the rest are counted but
   * not listed, so the board stays readable). Defaults to 8.
   */
  readonly doneLimit?: number;
}

const emptyStageCounts = (): Record<WorkStage, number> => ({
  planning: 0,
  queued: 0,
  building: 0,
  review: 0,
  qa: 0,
  done: 0,
});

/**
 * Groups items into the ordered lifecycle board with live counts.
 *
 * Cards within a column are ordered live-first, then most-recently-updated, so
 * the thing happening right now sits at the top. The "done" column is capped
 * (see {@link BuildLifecycleBoardOptions.doneLimit}) while still reporting its
 * true total.
 *
 * @param inputs - Raw work-item signals.
 * @param options - Optional caps.
 * @returns The assembled board view model.
 */
export function buildLifecycleBoard(
  inputs: readonly WorkItemInput[],
  options: BuildLifecycleBoardOptions = {}
): LifecycleBoard {
  const doneLimit = options.doneLimit ?? 8;
  const views = inputs.map(buildWorkItemView);

  const byStage = new Map<WorkStage, WorkItemView[]>(
    WORK_LIFECYCLE_STAGES.map((s) => [s, []])
  );
  for (const view of views) {
    byStage.get(view.stage)!.push(view);
  }

  const orderInColumn = (a: WorkItemView, b: WorkItemView): number => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  };

  const stageCounts = emptyStageCounts();
  const columns: LifecycleColumn[] = WORK_LIFECYCLE_STAGES.map((stage) => {
    const sorted = byStage.get(stage)!.sort(orderInColumn);
    stageCounts[stage] = sorted.length;
    const items = stage === "done" ? sorted.slice(0, doneLimit) : sorted;
    return {
      stage,
      label: STAGE_META[stage].label,
      blurb: STAGE_META[stage].blurb,
      items,
      total: sorted.length,
    };
  });

  const activeCount = IN_FLIGHT_STAGES.reduce(
    (sum, stage) => sum + stageCounts[stage],
    0
  );
  const liveCount = views.filter((v) => v.isLive).length;
  const needsAttentionCount = views.filter(
    (v) => v.isBlocked || v.awaitingApproval
  ).length;

  return {
    columns,
    stageCounts,
    activeCount,
    liveCount,
    needsAttentionCount,
    totalCount: views.length,
  };
}
