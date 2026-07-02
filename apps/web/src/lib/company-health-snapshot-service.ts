/**
 * Company health snapshots — the DB layer (MUS-263).
 *
 * Fetches the raw source rows/counts for `computeCompanyHealthMetrics` (the
 * pure math lives in company-health-service.ts) and persists the result as a
 * `CompanyHealthSnapshot`, at most once per company per UTC day.
 *
 * Written by the continuous driver as a best-effort tick step (like memory
 * ingestion): a failure here must never break the tick, so the driver wraps
 * the call in try/catch and records `null`.
 */

import {
  computeCompanyHealthMetrics,
  healthWindowStart,
  utcDayKey,
  LEARNING_PROMOTION_SOURCE_PREFIX,
  RETRIES_EXHAUSTED_EVENT_TYPE,
  type CompanyHealthMetrics,
  type CompanyHealthSourceData,
} from "@/lib/company-health-service";
import { PR_FEEDBACK_REVIEW_TITLE_PREFIX } from "@/lib/pr-feedback-ingestion-service";
import { prisma } from "@/lib/prisma";

/** Result of a {@link captureCompanyHealthSnapshot} attempt. */
export type CaptureHealthSnapshotResult =
  | { readonly status: "captured"; readonly snapshotId: string; readonly dayKey: string }
  | { readonly status: "already_captured"; readonly dayKey: string };

/**
 * Fetches the raw source data behind the company health metrics.
 *
 * Every count is scoped to `companyId`; window-bounded (`…7d`) queries cover
 * the trailing 7 days ending at `now`. Notes on the sources:
 *
 * - **Tasks reaching done** use `Task.updatedAt` with `status = "done"` as the
 *   done-transition timestamp — the gated loop stamps `updatedAt` when it sets
 *   `done`, and `done` is terminal, so this is the honest available signal
 *   (there is no per-status transition log for tasks).
 * - **Retry exhaustion** counts the `execution_retries_exhausted` timeline
 *   events MUS-252 writes when blocking a task. `TimelineEntry` has no
 *   companyId, so entries are scoped through the company's task ids.
 * - **QA verdicts** select only `passed`/`failed` rows; the pure layer then
 *   keeps those whose `checks` JSON records at least one real check.
 * - **PR feedback** selects the reviews the ingestion service itself titles
 *   with "PR feedback:"; merged PRs are execution sessions whose `prStatus`
 *   was observed `merged` in the window (stamped via `updatedAt`).
 * - **Learning** counts MemoryRecords through their bank's companyId; standards
 *   are the records the learning engine wrote with a `learning:` source.
 *
 * @param companyId - Company to measure.
 * @param now - Window end (defaults to the current time; injectable in tests).
 * @returns Raw inputs for {@link computeCompanyHealthMetrics}.
 */
export async function fetchCompanyHealthSourceData(
  companyId: string,
  now: Date = new Date()
): Promise<CompanyHealthSourceData> {
  const windowStart = healthWindowStart(now);

  // TimelineEntry rows carry no companyId — scope through the company's tasks.
  const companyTasks = await prisma.task.findMany({
    where: { companyId },
    select: { id: true },
  });
  const taskIds = companyTasks.map((t) => t.id);

  const [
    tasksDoneTotal,
    tasksDone7d,
    tasksBlocked,
    changeRequestsTotal,
    changeRequestsUnresolved,
    retriesExhausted7d,
    qaVerdicts7d,
    prsMerged7d,
    prFeedbackReviews7d,
    memoryRecords7d,
    memoryRecordsTotal,
    standardsPromoted7d,
    standardsTotal,
  ] = await Promise.all([
    prisma.task.count({ where: { companyId, status: "done" } }),
    prisma.task.count({
      where: { companyId, status: "done", updatedAt: { gte: windowStart, lte: now } },
    }),
    prisma.task.count({ where: { companyId, status: "blocked" } }),
    prisma.changeRequest.count({ where: { review: { companyId } } }),
    prisma.changeRequest.count({
      where: { review: { companyId }, resolved: false },
    }),
    taskIds.length > 0
      ? prisma.timelineEntry.count({
          where: {
            entityType: "task",
            entityId: { in: taskIds },
            eventType: RETRIES_EXHAUSTED_EVENT_TYPE,
            createdAt: { gte: windowStart, lte: now },
          },
        })
      : Promise.resolve(0),
    prisma.qAResult.findMany({
      where: {
        companyId,
        status: { in: ["passed", "failed"] },
        updatedAt: { gte: windowStart, lte: now },
      },
      select: { status: true, checks: true },
    }),
    prisma.executionSession.count({
      where: {
        companyId,
        prStatus: "merged",
        updatedAt: { gte: windowStart, lte: now },
      },
    }),
    prisma.review.findMany({
      where: {
        companyId,
        title: { startsWith: PR_FEEDBACK_REVIEW_TITLE_PREFIX },
        createdAt: { gte: windowStart, lte: now },
      },
      select: { notes: true },
    }),
    prisma.memoryRecord.count({
      where: {
        memory: { companyId },
        createdAt: { gte: windowStart, lte: now },
      },
    }),
    prisma.memoryRecord.count({ where: { memory: { companyId } } }),
    prisma.memoryRecord.count({
      where: {
        memory: { companyId },
        source: { startsWith: LEARNING_PROMOTION_SOURCE_PREFIX },
        createdAt: { gte: windowStart, lte: now },
      },
    }),
    prisma.memoryRecord.count({
      where: {
        memory: { companyId },
        source: { startsWith: LEARNING_PROMOTION_SOURCE_PREFIX },
      },
    }),
  ]);

  return {
    capturedAt: now,
    tasksDoneTotal,
    tasksDone7d,
    tasksBlocked,
    changeRequestsTotal,
    changeRequestsUnresolved,
    retriesExhausted7d,
    qaVerdicts7d,
    prsMerged7d,
    prFeedbackReviews7d,
    memoryRecords7d,
    memoryRecordsTotal,
    standardsPromoted7d,
    standardsTotal,
  };
}

/**
 * Computes the current health metrics for a company (fetch + pure math).
 *
 * @param companyId - Company to measure.
 * @param now - Window end (defaults to the current time).
 * @returns The computed metrics — never persisted by this function.
 */
export async function computeCurrentCompanyHealth(
  companyId: string,
  now: Date = new Date()
): Promise<CompanyHealthMetrics> {
  const data = await fetchCompanyHealthSourceData(companyId, now);
  return computeCompanyHealthMetrics(data);
}

/**
 * Captures today's health snapshot for a company, at most once per UTC day.
 *
 * Check-before-write: when a snapshot already exists for the current UTC day
 * (`dayKey`), nothing is written. The `@@unique([companyId, dayKey])`
 * constraint backstops races — a concurrent duplicate insert is caught and
 * reported as `already_captured`.
 *
 * @param companyId - Company to snapshot.
 * @param now - Capture moment (defaults to the current time; injectable in tests).
 * @returns Whether a snapshot was created or one already existed for today.
 */
export async function captureCompanyHealthSnapshot(
  companyId: string,
  now: Date = new Date()
): Promise<CaptureHealthSnapshotResult> {
  const dayKey = utcDayKey(now);

  const existing = await prisma.companyHealthSnapshot.findUnique({
    where: { companyId_dayKey: { companyId, dayKey } },
    select: { id: true },
  });
  if (existing) {
    return { status: "already_captured", dayKey };
  }

  const metrics = await computeCurrentCompanyHealth(companyId, now);

  try {
    const created = await prisma.companyHealthSnapshot.create({
      data: {
        companyId,
        capturedAt: metrics.capturedAt,
        dayKey: metrics.dayKey,

        tasksDoneTotal: metrics.tasksDoneTotal,
        tasksDone7d: metrics.tasksDone7d,
        tasksBlocked: metrics.tasksBlocked,
        changeRequestsTotal: metrics.changeRequestsTotal,
        changeRequestsUnresolved: metrics.changeRequestsUnresolved,
        reworkRatePerDoneTask: metrics.reworkRatePerDoneTask,
        retriesExhausted7d: metrics.retriesExhausted7d,

        qaResultsWithChecks7d: metrics.qaResultsWithChecks7d,
        qaPassedWithChecks7d: metrics.qaPassedWithChecks7d,
        qaPassRate7d: metrics.qaPassRate7d,
        prsMerged7d: metrics.prsMerged7d,
        prFeedbackReviews7d: metrics.prFeedbackReviews7d,
        prCiFailures7d: metrics.prCiFailures7d,

        memoryRecords7d: metrics.memoryRecords7d,
        memoryRecordsTotal: metrics.memoryRecordsTotal,
        standardsPromoted7d: metrics.standardsPromoted7d,
        standardsTotal: metrics.standardsTotal,
      },
      select: { id: true },
    });
    return { status: "captured", snapshotId: created.id, dayKey };
  } catch (error) {
    // Unique-constraint race (two ticks capturing the same day): treat the
    // loser as an idempotent no-op rather than an error.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { status: "already_captured", dayKey };
    }
    throw error;
  }
}

/**
 * Lists a company's most recent health snapshots, newest first.
 *
 * @param companyId - Company whose snapshots to read.
 * @param take - Maximum number of snapshots (default 2 — latest + previous).
 * @returns Snapshot rows ordered by `capturedAt` descending.
 */
export async function listRecentCompanyHealthSnapshots(
  companyId: string,
  take = 2
) {
  return prisma.companyHealthSnapshot.findMany({
    where: { companyId },
    orderBy: { capturedAt: "desc" },
    take,
  });
}
