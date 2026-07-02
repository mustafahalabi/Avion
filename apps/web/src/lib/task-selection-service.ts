import type { PlanningDraftStatus } from "@/lib/outcome-planning";
import { prisma } from "@/lib/prisma";
import {
  parseGeneratedTaskMetadata,
  selectNextExecutableTask,
  type GeneratedTaskMetadata,
  type SelectNextExecutableTaskResult,
  type TaskSelectionCandidate,
} from "@/lib/task-selection";

/**
 * Selects the next executable task for a company from approved or applied plans.
 *
 * @param companyId - Company ID used for ownership scoping
 * @returns The selected task or a reason explaining why none is executable
 * @example
 * ```ts
 * const result = await selectNextExecutableTaskForCompany("company_123");
 * if (result.task) {
 *   logger.info({ taskId: result.task.id }, result.reason);
 * }
 * ```
 */
export async function selectNextExecutableTaskForCompany(
  companyId: string
): Promise<SelectNextExecutableTaskResult> {
  const [tasks, planningDrafts] = await Promise.all([
    prisma.task.findMany({
      where: {
        companyId,
        OR: [
          // Plan-linked tasks driven by an approved or applied plan.
          {
            planningDraftId: { not: null },
            planningDraft: {
              status: { in: ["approved", "applied"] },
            },
          },
          // Planless rework candidates (MUS-270): tasks created outside planning
          // (chat/manual/script) that a failed review, QA, or PR feedback put
          // back into the loop with an open change request. `in-progress` is
          // where a fresh rework sits; `todo` is where a *failed* rework attempt
          // lands (a failed ingest sets the task to `todo`), so both must be
          // fetched or the failed rework strands invisibly (MUS-284). The
          // needs-rework filter below keeps non-rework planless tasks out of
          // selection — a fresh planless `todo` with no change request is ignored.
          { planningDraftId: null, status: { in: ["in-progress", "todo"] } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        planningDraftId: true,
        planItemId: true,
        createdAt: true,
        planningDraft: {
          select: {
            id: true,
            status: true,
            generatedTasks: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.planningDraft.findMany({
      where: {
        companyId,
        status: { in: ["approved", "applied"] },
      },
      select: {
        id: true,
        generatedTasks: true,
      },
    }),
  ]);

  const generatedTaskMetadata = buildGeneratedTaskMetadata(planningDrafts);
  const completedPlanItemIds = buildCompletedPlanItemIds(tasks);
  const reworkTaskIds = await findTasksNeedingRework(
    companyId,
    tasks.map((task) => task.id)
  );
  const candidates = tasks
    .filter((task) =>
      // Plan-linked tasks: keep only those whose draft actually loaded.
      // Planless tasks (no draft): keep only genuine rework candidates — a task
      // with an unresolved change request — so the driver never picks up an
      // ad-hoc `in-progress` task that isn't awaiting rework.
      task.planningDraftId !== null
        ? task.planningDraft !== null
        : reworkTaskIds.has(task.id)
    )
    .map((task) => toTaskSelectionCandidate(task, reworkTaskIds.has(task.id)));

  return selectNextExecutableTask(candidates, completedPlanItemIds, generatedTaskMetadata);
}

/**
 * Finds tasks that carry unresolved change requests (review, QA, or PR
 * feedback) and therefore need a rework implementation attempt.
 *
 * Change requests hang off reviews; a review's `entityId` is the task when
 * `entityType` is "task". Any unresolved change request — regardless of the
 * review's own status (a QA failure attaches its change requests to the
 * already-approved review) — marks the task as needing rework.
 *
 * @param companyId - Company ID used for ownership scoping
 * @param taskIds - Candidate task IDs to check
 * @returns The subset of task IDs with at least one unresolved change request
 */
export async function findTasksNeedingRework(
  companyId: string,
  taskIds: readonly string[]
): Promise<ReadonlySet<string>> {
  if (taskIds.length === 0) return new Set();

  const reviews = await prisma.review.findMany({
    where: {
      companyId,
      entityType: "task",
      entityId: { in: [...taskIds] },
      changeRequests: { some: { resolved: false } },
    },
    select: { entityId: true },
  });

  return new Set(reviews.map((review) => review.entityId));
}

interface PlanningDraftMetadataSource {
  readonly id: string;
  readonly generatedTasks: string;
}

interface TaskWithPlanningDraft {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly planningDraftId: string | null;
  readonly planItemId: string | null;
  readonly createdAt: Date;
  readonly planningDraft: {
    readonly id: string;
    readonly status: string;
    readonly generatedTasks: string;
  } | null;
}

/**
 * Builds a combined metadata map from all approved or applied planning drafts.
 *
 * @param planningDrafts - Planning drafts with generated task payloads
 * @returns Metadata keyed by deterministic plan item ID
 */
function buildGeneratedTaskMetadata(
  planningDrafts: readonly PlanningDraftMetadataSource[]
): ReadonlyMap<string, GeneratedTaskMetadata> {
  const metadata = new Map<string, GeneratedTaskMetadata>();

  for (const draft of planningDrafts) {
    for (const [planItemId, taskMetadata] of parseGeneratedTaskMetadata(
      draft.generatedTasks
    )) {
      metadata.set(planItemId, taskMetadata);
    }
  }

  return metadata;
}

/**
 * Collects plan item IDs for tasks that have completed implementation.
 *
 * @param tasks - Company tasks linked to approved or applied plans
 * @returns Plan item IDs whose linked tasks are done
 */
function buildCompletedPlanItemIds(
  tasks: readonly Pick<TaskWithPlanningDraft, "status" | "planItemId">[]
): ReadonlySet<string> {
  const completedPlanItemIds = new Set<string>();

  for (const task of tasks) {
    if (task.status === "done" && task.planItemId) {
      completedPlanItemIds.add(task.planItemId);
    }
  }

  return completedPlanItemIds;
}

/**
 * Converts a Prisma task row into a task selection candidate.
 *
 * @param task - Task row with planning draft context
 * @param needsRework - Whether the task carries unresolved change requests
 * @returns Normalized selection candidate
 */
function toTaskSelectionCandidate(
  task: TaskWithPlanningDraft,
  needsRework: boolean
): TaskSelectionCandidate {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    planningDraftId: task.planningDraftId ?? task.planningDraft?.id ?? "",
    planningDraftStatus: (task.planningDraft?.status ?? "draft") as PlanningDraftStatus,
    planItemId: task.planItemId,
    createdAt: task.createdAt,
    needsRework,
  };
}
