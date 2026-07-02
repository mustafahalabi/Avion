/**
 * Company health metrics — the pure computation layer (MUS-263).
 *
 * Derives a small, HONEST set of organizational health metrics from rows that
 * already exist. Every number is a count of real records or a transparent
 * ratio of two such counts — no synthetic 0-100 scores, no invented quality
 * adjectives. Where a rate has an empty denominator the metric is `null`
 * ("no data"), never a fabricated 0 or 100.
 *
 * The metrics, by pillar:
 *
 * - **Delivery** — task throughput (tasks reaching `done` in the trailing
 *   window), rework rate (all ChangeRequests — resolved + unresolved — per
 *   done task), and retry exhaustion (`execution_retries_exhausted` timeline
 *   events written by MUS-252 when a task is blocked after the failure budget
 *   is spent, plus the current blocked-task count).
 * - **Quality** — QA pass rate over QAResult verdicts that carry at least one
 *   recorded validation check (evidence-free passes store `checks: "[]"` and
 *   are excluded — see gate-advancement-service), plus the PR-feedback trend
 *   (PRs observed merged; "PR feedback:" reviews opened from real GitHub
 *   feedback, split out by CI failure).
 * - **Learning** — memory records written and standards promoted by the
 *   learning engine (records with a `learning:` source — see
 *   memory-learning-service).
 *
 * This module is intentionally pure — no prisma import, no I/O. The DB fetch
 * lives in `company-health-snapshot-service.ts`, mirroring how
 * `control-center-view-model.ts` separates assembly from fetching.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Length of the trailing metric window, in days (UTC). */
export const HEALTH_WINDOW_DAYS = 7;

/**
 * Substring identifying a CI failure inside a PR-feedback review's notes.
 * Matches the summary written by `buildFeedbackSummary` in
 * pr-feedback-ingestion-service ("CI checks failed: …" / "CI checks failed on
 * the pull request.") — we only ever match against notes we authored.
 */
export const CI_FAILURE_NOTES_MARKER = "CI checks failed";

/**
 * Prefix of MemoryRecord.source used by the learning engine when promoting a
 * recurring finding to a durable standard (`learning:<key>` — see
 * memory-learning-service).
 */
export const LEARNING_PROMOTION_SOURCE_PREFIX = "learning:";

/** Timeline event type written when a task exhausts its execution retries. */
export const RETRIES_EXHAUSTED_EVENT_TYPE = "execution_retries_exhausted";

// ─── Input (already-fetched rows/counts; no I/O here) ────────────────────────

/** A QAResult verdict row, reduced to what the math needs. */
export interface QaVerdictRow {
  /** "passed" | "failed" (the fetch layer only selects these statuses). */
  readonly status: string;
  /** Raw `QAResult.checks` JSON — "[]" when no real checks were recorded. */
  readonly checks: string;
}

/** A "PR feedback:" review row, reduced to what the math needs. */
export interface PrFeedbackReviewRow {
  /** Review notes; contains {@link CI_FAILURE_NOTES_MARKER} on CI failures. */
  readonly notes: string | null;
}

/**
 * Raw source data for one company, fetched by the caller
 * (`fetchCompanyHealthSourceData`). All `…7d` inputs are already scoped to the
 * trailing {@link HEALTH_WINDOW_DAYS}-day window ending at `capturedAt`.
 */
export interface CompanyHealthSourceData {
  /** Moment the metrics are computed for (window end). */
  readonly capturedAt: Date;

  // Delivery
  readonly tasksDoneTotal: number;
  readonly tasksDone7d: number;
  readonly tasksBlocked: number;
  readonly changeRequestsTotal: number;
  readonly changeRequestsUnresolved: number;
  readonly retriesExhausted7d: number;

  // Quality
  readonly qaVerdicts7d: readonly QaVerdictRow[];
  readonly prsMerged7d: number;
  readonly prFeedbackReviews7d: readonly PrFeedbackReviewRow[];

  // Learning
  readonly memoryRecords7d: number;
  readonly memoryRecordsTotal: number;
  readonly standardsPromoted7d: number;
  readonly standardsTotal: number;
}

// ─── Output ───────────────────────────────────────────────────────────────────

/**
 * Computed health metrics — matches the persisted `CompanyHealthSnapshot`
 * numeric fields one-to-one (plus the capture bookkeeping).
 */
export interface CompanyHealthMetrics {
  readonly capturedAt: Date;
  /** UTC calendar day of `capturedAt`, "YYYY-MM-DD". */
  readonly dayKey: string;

  // Delivery
  readonly tasksDoneTotal: number;
  readonly tasksDone7d: number;
  readonly tasksBlocked: number;
  readonly changeRequestsTotal: number;
  readonly changeRequestsUnresolved: number;
  /** changeRequestsTotal / tasksDoneTotal; null when no task is done. */
  readonly reworkRatePerDoneTask: number | null;
  readonly retriesExhausted7d: number;

  // Quality
  readonly qaResultsWithChecks7d: number;
  readonly qaPassedWithChecks7d: number;
  /** qaPassedWithChecks7d / qaResultsWithChecks7d; null when no verdicts. */
  readonly qaPassRate7d: number | null;
  readonly prsMerged7d: number;
  readonly prFeedbackReviews7d: number;
  readonly prCiFailures7d: number;

  // Learning
  readonly memoryRecords7d: number;
  readonly memoryRecordsTotal: number;
  readonly standardsPromoted7d: number;
  readonly standardsTotal: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Formats a date as its UTC calendar day, "YYYY-MM-DD". Used as the
 * once-per-day snapshot key, so two captures on the same UTC day collide.
 */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Start of the trailing metric window ending at `end` (exact 7×24h). */
export function healthWindowStart(end: Date): Date {
  return new Date(end.getTime() - HEALTH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * True when a raw `QAResult.checks` JSON string records at least one real
 * check. Malformed JSON or a non-array is treated as "no recorded checks" —
 * we only count evidence we can actually read.
 */
export function hasRecordedChecks(checks: string): boolean {
  try {
    const parsed: unknown = JSON.parse(checks);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

// ─── Computation ──────────────────────────────────────────────────────────────

/**
 * Computes the company health metrics from already-fetched source data.
 *
 * Pure math over counts: rates divide raw counts and become `null` on empty
 * denominators; QA verdicts are filtered down to those with recorded checks;
 * PR-feedback reviews are split by the CI-failure marker in their notes.
 *
 * @param data - Raw rows/counts fetched by the caller.
 * @returns Metrics matching the `CompanyHealthSnapshot` fields.
 */
export function computeCompanyHealthMetrics(
  data: CompanyHealthSourceData
): CompanyHealthMetrics {
  // ── Quality: QA verdicts with real recorded checks only ────────────────────
  const withChecks = data.qaVerdicts7d.filter((v) => hasRecordedChecks(v.checks));
  const qaResultsWithChecks7d = withChecks.length;
  const qaPassedWithChecks7d = withChecks.filter(
    (v) => v.status === "passed"
  ).length;
  const qaPassRate7d =
    qaResultsWithChecks7d > 0
      ? qaPassedWithChecks7d / qaResultsWithChecks7d
      : null;

  // ── Quality: PR feedback split by CI failure ───────────────────────────────
  const prFeedbackReviews7d = data.prFeedbackReviews7d.length;
  const prCiFailures7d = data.prFeedbackReviews7d.filter((r) =>
    (r.notes ?? "").includes(CI_FAILURE_NOTES_MARKER)
  ).length;

  // ── Delivery: rework rate per done task ────────────────────────────────────
  const reworkRatePerDoneTask =
    data.tasksDoneTotal > 0
      ? data.changeRequestsTotal / data.tasksDoneTotal
      : null;

  return {
    capturedAt: data.capturedAt,
    dayKey: utcDayKey(data.capturedAt),

    tasksDoneTotal: data.tasksDoneTotal,
    tasksDone7d: data.tasksDone7d,
    tasksBlocked: data.tasksBlocked,
    changeRequestsTotal: data.changeRequestsTotal,
    changeRequestsUnresolved: data.changeRequestsUnresolved,
    reworkRatePerDoneTask,
    retriesExhausted7d: data.retriesExhausted7d,

    qaResultsWithChecks7d,
    qaPassedWithChecks7d,
    qaPassRate7d,
    prsMerged7d: data.prsMerged7d,
    prFeedbackReviews7d,
    prCiFailures7d,

    memoryRecords7d: data.memoryRecords7d,
    memoryRecordsTotal: data.memoryRecordsTotal,
    standardsPromoted7d: data.standardsPromoted7d,
    standardsTotal: data.standardsTotal,
  };
}
