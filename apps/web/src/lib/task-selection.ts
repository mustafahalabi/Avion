import type { GeneratedPlanningTask } from "@/lib/planning-generator";
import type { PlanningDraftStatus } from "@/lib/outcome-planning";

export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;

export const APPROVED_PLANNING_DRAFT_STATUSES = ["approved", "applied"] as const;

/**
 * Task statuses that are eligible for a new implementation attempt.
 *
 * `in-progress` is additionally executable as a *rework* when the task carries
 * unresolved change requests (see {@link isExecutableCandidate}) — that is how
 * PR feedback (CI failure / changes requested) re-enters the agent loop instead
 * of dead-ending on a status the driver never selects.
 */
export const EXECUTABLE_TASK_STATUSES = ["todo"] as const;

/**
 * Task statuses that must never be selected for implementation.
 * (`in-progress` is listed here for the *default* case; a rework candidate with
 * unresolved change requests overrides it.)
 */
export const NON_EXECUTABLE_TASK_STATUSES = [
  "blocked",
  "done",
  "in-review",
  "in-progress",
  "cancelled",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type ExecutableTaskStatus = (typeof EXECUTABLE_TASK_STATUSES)[number];

export type TaskSelectionReasonCode =
  | "selected"
  | "no_approved_plans"
  | "no_executable_tasks"
  | "all_blocked_by_status"
  | "all_blocked_by_dependencies";

export interface TaskSelectionCandidate {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly planningDraftId: string;
  readonly planningDraftStatus: PlanningDraftStatus;
  readonly planItemId: string | null;
  readonly createdAt: Date;
  /**
   * True when the task has unresolved change requests (from a review, QA, or
   * PR feedback) and therefore needs a rework implementation attempt. Makes an
   * `in-progress` task executable again.
   */
  readonly needsRework?: boolean;
}

export interface GeneratedTaskMetadata {
  readonly planItemId: string;
  readonly dependencies: readonly string[];
  readonly estimatedExecutionOrder: number;
}

export interface SelectedExecutableTask {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly planningDraftId: string;
  readonly planItemId: string | null;
}

export interface SelectNextExecutableTaskResult {
  readonly task: SelectedExecutableTask | null;
  readonly reasonCode: TaskSelectionReasonCode;
  readonly reason: string;
}

const PRIORITY_RANK: Readonly<Record<string, number>> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Parses generated planning task metadata from a planning draft payload.
 *
 * @param generatedTasksJson - JSON array stored on PlanningDraft.generatedTasks
 * @returns Metadata keyed by deterministic plan item ID
 * @example
 * ```ts
 * const metadata = parseGeneratedTaskMetadata(planningDraft.generatedTasks);
 * const firstTask = metadata.get("task:detect-package-manager");
 * ```
 */
export function parseGeneratedTaskMetadata(
  generatedTasksJson: string
): ReadonlyMap<string, GeneratedTaskMetadata> {
  const metadata = new Map<string, GeneratedTaskMetadata>();

  try {
    const parsed = JSON.parse(generatedTasksJson) as unknown;
    if (!Array.isArray(parsed)) {
      return metadata;
    }

    for (const item of parsed) {
      if (!isGeneratedPlanningTask(item)) {
        continue;
      }

      metadata.set(item.planItemId, {
        planItemId: item.planItemId,
        dependencies: item.dependencies ?? [],
        estimatedExecutionOrder: item.estimatedExecutionOrder ?? Number.MAX_SAFE_INTEGER,
      });
    }
  } catch {
    return metadata;
  }

  return metadata;
}

/**
 * Checks whether a planning draft status allows execution selection.
 *
 * @param status - Planning draft lifecycle status
 * @returns True when the draft is approved or already applied
 */
export function isApprovedOrAppliedPlanningDraft(status: string): boolean {
  return (APPROVED_PLANNING_DRAFT_STATUSES as readonly string[]).includes(status);
}

/**
 * Checks whether a task status is eligible for implementation selection.
 *
 * @param status - Current task status
 * @returns True when the task is ready for a new implementation attempt
 */
export function isExecutableTaskStatus(status: string): boolean {
  return (EXECUTABLE_TASK_STATUSES as readonly string[]).includes(status);
}

/**
 * Checks whether a candidate is eligible for an implementation attempt:
 * either a fresh `todo` task, or an `in-progress` task that carries
 * unresolved change requests and therefore needs a rework attempt.
 *
 * @param candidate - Task selection candidate
 * @returns True when a session may be prepared for this candidate
 */
export function isExecutableCandidate(candidate: TaskSelectionCandidate): boolean {
  if (isExecutableTaskStatus(candidate.status)) return true;
  return candidate.status === "in-progress" && candidate.needsRework === true;
}

/**
 * Determines whether all declared task dependencies are satisfied.
 *
 * @param dependencies - Deterministic plan item IDs that must be complete first
 * @param completedPlanItemIds - Plan item IDs whose linked tasks are done
 * @returns True when every dependency is present in the completed set
 * @example
 * ```ts
 * const ready = areDependenciesSatisfied(
 *   ["task:detect-package-manager"],
 *   new Set(["task:inspect-source-tree-model", "task:detect-package-manager"])
 * );
 * ```
 */
export function areDependenciesSatisfied(
  dependencies: readonly string[],
  completedPlanItemIds: ReadonlySet<string>
): boolean {
  if (dependencies.length === 0) {
    return true;
  }

  return dependencies.every((dependency) => completedPlanItemIds.has(dependency));
}

/**
 * Selects the next executable task from in-memory candidates.
 *
 * @param candidates - Company-scoped tasks linked to approved or applied plans
 * @param completedPlanItemIds - Done task plan item IDs used for dependency checks
 * @param generatedTaskMetadata - Parsed generated task metadata keyed by plan item ID
 * @returns The selected task or a reason explaining why none is executable
 * @example
 * ```ts
 * const result = selectNextExecutableTask(candidates, completedPlanItemIds, metadata);
 * if (result.task) {
 *   await createExecutionSession({ companyId, taskId: result.task.id });
 * }
 * ```
 */
export function selectNextExecutableTask(
  candidates: readonly TaskSelectionCandidate[],
  completedPlanItemIds: ReadonlySet<string>,
  generatedTaskMetadata: ReadonlyMap<string, GeneratedTaskMetadata>
): SelectNextExecutableTaskResult {
  const eligibleCandidates = candidates.filter(
    (candidate) =>
      isApprovedOrAppliedPlanningDraft(candidate.planningDraftStatus) &&
      candidate.planningDraftId.length > 0
  );

  if (eligibleCandidates.length === 0) {
    return {
      task: null,
      reasonCode: "no_approved_plans",
      reason: "No tasks are linked to an approved or applied planning draft.",
    };
  }

  const executableByStatus = eligibleCandidates.filter((candidate) =>
    isExecutableCandidate(candidate)
  );

  if (executableByStatus.length === 0) {
    const hasNonExecutableOnly = eligibleCandidates.every((candidate) =>
      (NON_EXECUTABLE_TASK_STATUSES as readonly string[]).includes(candidate.status)
    );

    return {
      task: null,
      reasonCode: hasNonExecutableOnly ? "all_blocked_by_status" : "no_executable_tasks",
      reason: hasNonExecutableOnly
        ? "All candidate tasks are blocked, completed, in review, in progress without rework, or cancelled."
        : "No tasks are currently in the todo status (or awaiting rework) for approved or applied plans.",
    };
  }

  const readyTasks = executableByStatus.filter((candidate) => {
    const metadata = candidate.planItemId
      ? generatedTaskMetadata.get(candidate.planItemId)
      : undefined;
    const dependencies = metadata?.dependencies ?? [];
    return areDependenciesSatisfied(dependencies, completedPlanItemIds);
  });

  if (readyTasks.length === 0) {
    return {
      task: null,
      reasonCode: "all_blocked_by_dependencies",
      reason:
        "Todo tasks exist, but each one is waiting on incomplete planning dependencies.",
    };
  }

  const selected = [...readyTasks].sort((left, right) =>
    compareTaskCandidates(left, right, generatedTaskMetadata)
  )[0];

  return {
    task: {
      id: selected.id,
      title: selected.title,
      status: selected.status,
      priority: selected.priority,
      planningDraftId: selected.planningDraftId,
      planItemId: selected.planItemId,
    },
    reasonCode: "selected",
    reason: `Selected "${selected.title}" as the next executable task.`,
  };
}

/**
 * Compares two task candidates by priority, execution order, and creation time.
 *
 * @param left - First candidate
 * @param right - Second candidate
 * @returns Negative when left should be selected before right
 */
function compareTaskCandidates(
  left: TaskSelectionCandidate,
  right: TaskSelectionCandidate,
  generatedTaskMetadata: ReadonlyMap<string, GeneratedTaskMetadata>
): number {
  const priorityDiff =
    getPriorityRank(left.priority) - getPriorityRank(right.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const orderDiff =
    getEstimatedExecutionOrder(left, generatedTaskMetadata) -
    getEstimatedExecutionOrder(right, generatedTaskMetadata);
  if (orderDiff !== 0) {
    return orderDiff;
  }

  const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.title.localeCompare(right.title);
}

/**
 * Reads the generated execution order for a candidate task.
 *
 * @param candidate - Task candidate being ranked
 * @param generatedTaskMetadata - Parsed generated task metadata
 * @returns Lower numbers represent earlier planned execution
 */
function getEstimatedExecutionOrder(
  candidate: TaskSelectionCandidate,
  generatedTaskMetadata: ReadonlyMap<string, GeneratedTaskMetadata>
): number {
  if (!candidate.planItemId) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (
    generatedTaskMetadata.get(candidate.planItemId)?.estimatedExecutionOrder ??
    Number.MAX_SAFE_INTEGER
  );
}

/**
 * Maps a task priority label to a sortable rank.
 *
 * @param priority - Task priority label
 * @returns Lower numbers represent higher priority
 */
function getPriorityRank(priority: string): number {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.medium;
}

function isGeneratedPlanningTask(value: unknown): value is GeneratedPlanningTask {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<GeneratedPlanningTask>;
  return typeof candidate.planItemId === "string" && candidate.planItemId.length > 0;
}
