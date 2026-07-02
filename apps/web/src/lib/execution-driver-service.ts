/**
 * Execution Driver Service
 *
 * The tick logic of the continuous execution driver (MUS-211), kept separate
 * from the process entry point (`src/worker/driver.ts`) so it is unit-testable
 * and replaceable.
 *
 * Each tick, per company:
 * 1. Enqueues the next executable task(s) via `autoPrepareNextExecutionSession`
 *    (MUS-210), up to the per-company concurrency limit derived from the run
 *    mode. Idempotency in that service guarantees no duplicate sessions.
 * 2. Advances completed work via `advanceTaskGates` (MUS-212) for tasks sitting
 *    at `in-review`.
 *
 * The driver is intentionally a *separate* concern from the executor worker
 * (`src/worker/index.ts`), which claims and runs prepared sessions. The driver
 * decides what work to enqueue and how to advance gates; the worker executes.
 * Either can be replaced independently.
 */

import {
  autoPrepareNextExecutionSession,
  type AutoPrepareResult,
} from "@/lib/auto-execution-service";
import { captureCompanyHealthSnapshot } from "@/lib/company-health-snapshot-service";
import { LIVE_EXECUTION_SESSION_STATUSES } from "@/lib/execution-session-service";
import {
  advanceTaskGates,
  type GateAdvanceResult,
} from "@/lib/gate-advancement-service";
import { ingestCompanyMemory } from "@/lib/memory/memory-ingestion-service";
import { promoteRecurringLessons } from "@/lib/memory/memory-learning-service";
import { ingestPullRequestFeedbackForCompany } from "@/lib/pr-feedback-ingestion-service";
import { prisma } from "@/lib/prisma";
import { getRunModeConfig } from "@/lib/run-mode";

/** Maximum number of in-review tasks advanced per company per tick. */
const MAX_GATE_ADVANCEMENTS_PER_TICK = 10;

/** Result of a single company's driver tick, for logging/observability. */
export interface DriverTickResult {
  readonly companyId: string;
  /** Live (queued/prepared/running) session count at the start of the tick. */
  readonly liveSessionsBefore: number;
  /** Per-company concurrency limit derived from the run mode. */
  readonly concurrencyLimit: number;
  /** Results of each auto-prepare attempt this tick. */
  readonly enqueued: readonly AutoPrepareResult[];
  /** Results of each gate advancement this tick. */
  readonly advanced: readonly GateAdvanceResult[];
  /**
   * Memory compounded this tick: durable lessons written from completed signals and
   * recurring lessons promoted to standards. Best-effort — null when the step errored.
   */
  readonly memory?: { readonly written: number; readonly promoted: number } | null;
  /**
   * PR feedback ingested this tick: open PRs polled for CI + review results. CI failure /
   * changes-requested opens a change request and re-loops the task; merged PRs are recorded.
   * Best-effort — null when the step errored (e.g. no GitHub token).
   */
  readonly prFeedback?: {
    readonly sessionsChecked: number;
    readonly changeRequestsOpened: number;
    readonly merged: number;
    readonly autoMerged: number;
  } | null;
  /**
   * Company health snapshot captured this tick (MUS-263): honest delivery/
   * quality/learning counts persisted at most once per UTC day per company.
   * Best-effort — null when the step errored.
   */
  readonly health?: {
    readonly status: "captured" | "already_captured";
  } | null;
}

/**
 * Runs one driver tick for a single company: enqueues up to the concurrency
 * limit, then advances tasks waiting at the review/QA gates.
 *
 * @param companyId - Company to drive.
 * @returns A structured summary of the tick's decisions.
 */
export async function runDriverTickForCompany(
  companyId: string
): Promise<DriverTickResult> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { autonomyLevel: true },
  });
  const autonomyLevel = settings?.autonomyLevel ?? "assist";
  const concurrencyLimit = getRunModeConfig(autonomyLevel).maxConcurrentSessions;

  const liveSessionsBefore = await prisma.executionSession.count({
    where: {
      companyId,
      status: { in: [...LIVE_EXECUTION_SESSION_STATUSES] },
    },
  });

  // ── Respond to real PR feedback first (best-effort; never breaks the tick) ─
  // Poll open PRs for CI + review results so a CI failure / changes-requested moves the
  // task back to in-progress (with a change request) before we decide what to enqueue.
  let prFeedback: DriverTickResult["prFeedback"] = null;
  try {
    const ingested = await ingestPullRequestFeedbackForCompany(companyId);
    prFeedback = {
      sessionsChecked: ingested.sessionsChecked,
      changeRequestsOpened: ingested.changeRequestsOpened,
      merged: ingested.merged,
      autoMerged: ingested.autoMerged,
    };
  } catch {
    prFeedback = null;
  }

  // ── Enqueue up to the concurrency limit ──────────────────────────────────
  const enqueued: AutoPrepareResult[] = [];
  let live = liveSessionsBefore;
  while (live < concurrencyLimit) {
    const result = await autoPrepareNextExecutionSession(companyId);
    enqueued.push(result);
    if (result.status === "prepared") {
      live += 1;
      continue;
    }
    // nothing_to_do / skipped_existing_session / autonomy_below_threshold / error
    // → no more work can be enqueued this tick.
    break;
  }

  // ── Advance completed work waiting at the gates ──────────────────────────
  const inReviewTasks = await prisma.task.findMany({
    where: { companyId, status: "in-review" },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: MAX_GATE_ADVANCEMENTS_PER_TICK,
  });

  const advanced: GateAdvanceResult[] = [];
  for (const task of inReviewTasks) {
    advanced.push(await advanceTaskGates(companyId, task.id));
  }

  // ── Compound organizational memory (best-effort; never breaks the tick) ───
  // Capture durable lessons from completed reviews/QA/releases, then promote
  // recurring lessons to standards so future AI planning improves over time.
  let memory: DriverTickResult["memory"] = null;
  try {
    const ingested = await ingestCompanyMemory(companyId);
    const promoted = await promoteRecurringLessons(companyId);
    memory = { written: ingested.written, promoted: promoted.promoted };
  } catch {
    memory = null;
  }

  // ── Capture today's health snapshot (best-effort; never breaks the tick) ──
  // Persist the honest delivery/quality/learning counts at most once per UTC
  // day per company, after memory compounding so today's snapshot includes it.
  let health: DriverTickResult["health"] = null;
  try {
    const captured = await captureCompanyHealthSnapshot(companyId);
    health = { status: captured.status };
  } catch {
    health = null;
  }

  return {
    companyId,
    liveSessionsBefore,
    concurrencyLimit,
    enqueued,
    advanced,
    memory,
    prFeedback,
    health,
  };
}

/**
 * Runs one driver tick across every company.
 *
 * @returns The per-company tick results.
 */
export async function runDriverTick(): Promise<DriverTickResult[]> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  const results: DriverTickResult[] = [];
  for (const company of companies) {
    results.push(await runDriverTickForCompany(company.id));
  }
  return results;
}

/**
 * Builds a concise, single-line summary of a tick for logging.
 *
 * @param tick - A company's tick result.
 * @returns Human-readable summary string.
 */
export function summarizeDriverTick(tick: DriverTickResult): string {
  const prepared = tick.enqueued.filter((e) => e.status === "prepared").length;
  const completed = tick.advanced.filter((a) => a.status === "completed").length;
  const awaiting = tick.advanced.filter(
    (a) => a.status === "awaiting_review" || a.status === "awaiting_qa"
  ).length;

  return (
    `company ${tick.companyId}: live ${tick.liveSessionsBefore}/${tick.concurrencyLimit}, ` +
    `prepared ${prepared}, advanced ${tick.advanced.length} ` +
    `(completed ${completed}, awaiting-approval ${awaiting})`
  );
}
