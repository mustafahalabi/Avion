/**
 * Company Health panel view model (MUS-263).
 *
 * Pure assembler for the Control Center's Company Health panel, mirroring
 * control-center-view-model: the Server Component page fetches, this module
 * only shapes. Honesty rules:
 *
 * - Every headline value is a raw count or a transparent ratio shown WITH its
 *   denominator ("2/3 passed (67%)") — never a synthetic 0-100 score.
 * - Every metric carries a provenance line naming the rows that produced the
 *   number ("3 QA verdicts with recorded checks (2 passed, 1 failed)").
 * - Empty denominators render as explicit "no data", never a fake 0% or 100%.
 * - Trend deltas compare the two most recent daily snapshots and appear only
 *   when both exist; direction is descriptive (the number moved), not a
 *   judgment.
 */

import { HEALTH_WINDOW_DAYS, type CompanyHealthMetrics } from "@/lib/company-health-service";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The numeric surface of a persisted CompanyHealthSnapshot row, kept
 * structural so the module stays pure and tests don't need Prisma types.
 */
export interface CompanyHealthSnapshotLike {
  readonly dayKey: string;
  readonly tasksDone7d: number;
  readonly reworkRatePerDoneTask: number | null;
  readonly retriesExhausted7d: number;
  readonly qaResultsWithChecks7d: number;
  readonly qaPassedWithChecks7d: number;
  readonly qaPassRate7d: number | null;
  readonly prsMerged7d: number;
  readonly prFeedbackReviews7d: number;
  readonly memoryRecords7d: number;
  readonly standardsPromoted7d: number;
}

export type HealthTrendDirection = "up" | "down" | "flat";

export interface HealthMetricDelta {
  readonly direction: HealthTrendDirection;
  /** e.g. "+2 vs previous snapshot (2026-07-01)". */
  readonly text: string;
}

export interface HealthMetricCard {
  readonly id: string;
  readonly label: string;
  /** Headline value — an honest count or ratio-with-denominator. */
  readonly value: string;
  /** Which rows produced the number (counts, not adjectives). */
  readonly provenance: string;
  /** Present only when two snapshots exist and both sides are comparable. */
  readonly delta?: HealthMetricDelta;
}

export interface HealthSection {
  readonly id: "delivery" | "quality" | "learning";
  readonly label: string;
  readonly metrics: readonly HealthMetricCard[];
}

export interface CompanyHealthViewModel {
  readonly sections: readonly HealthSection[];
  readonly windowDays: number;
  /** True when a snapshot-vs-snapshot trend is shown on the cards. */
  readonly hasTrend: boolean;
  /** Honest one-liner about snapshot coverage (shown under the panel title). */
  readonly snapshotNote: string;
}

export interface CompanyHealthViewInput {
  /** Metrics computed live at page load. */
  readonly current: CompanyHealthMetrics;
  /** Most recent daily snapshot, or null when none has been captured. */
  readonly latestSnapshot: CompanyHealthSnapshotLike | null;
  /** Snapshot before the latest, or null. */
  readonly previousSnapshot: CompanyHealthSnapshotLike | null;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** Rounded whole-percent rendering of a 0..1 ratio. */
function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Builds a count delta ("+2 / -1 / ±0 vs previous snapshot (day)") between the
 * two most recent snapshots. Returns undefined when either side is missing.
 */
function countDelta(
  latest: CompanyHealthSnapshotLike | null,
  previous: CompanyHealthSnapshotLike | null,
  pick: (s: CompanyHealthSnapshotLike) => number
): HealthMetricDelta | undefined {
  if (!latest || !previous) return undefined;
  const diff = pick(latest) - pick(previous);
  const direction: HealthTrendDirection = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const signed = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "±0";
  return {
    direction,
    text: `${signed} vs previous snapshot (${previous.dayKey})`,
  };
}

/**
 * Builds a rate delta in percentage points between the two most recent
 * snapshots. Returns undefined when either snapshot is missing or either
 * side's rate is null (no data on that day — a delta would be fiction).
 */
function rateDelta(
  latest: CompanyHealthSnapshotLike | null,
  previous: CompanyHealthSnapshotLike | null,
  pick: (s: CompanyHealthSnapshotLike) => number | null
): HealthMetricDelta | undefined {
  if (!latest || !previous) return undefined;
  const a = pick(latest);
  const b = pick(previous);
  if (a === null || b === null) return undefined;
  const diffPts = Math.round((a - b) * 100);
  const direction: HealthTrendDirection =
    diffPts > 0 ? "up" : diffPts < 0 ? "down" : "flat";
  const signed = diffPts > 0 ? `+${diffPts}` : diffPts < 0 ? `${diffPts}` : "±0";
  return {
    direction,
    text: `${signed} pts vs previous snapshot (${previous.dayKey})`,
  };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds the Company Health panel view model from the live metrics and the
 * two most recent daily snapshots. Pure — no I/O; safe to unit-test.
 */
export function buildCompanyHealthViewModel(
  input: CompanyHealthViewInput
): CompanyHealthViewModel {
  const { current, latestSnapshot, previousSnapshot } = input;
  const hasTrend = latestSnapshot !== null && previousSnapshot !== null;

  // ── Delivery ────────────────────────────────────────────────────────────────
  const throughput: HealthMetricCard = {
    id: "throughput",
    label: `Throughput (${HEALTH_WINDOW_DAYS}d)`,
    value: `${current.tasksDone7d}`,
    provenance:
      `${current.tasksDone7d} ${plural(current.tasksDone7d, "task")} reached done ` +
      `in the last ${HEALTH_WINDOW_DAYS} days · ${current.tasksDoneTotal} done all-time`,
    delta: countDelta(latestSnapshot, previousSnapshot, (s) => s.tasksDone7d),
  };

  const rework: HealthMetricCard = {
    id: "rework-rate",
    label: "Rework rate",
    value:
      current.reworkRatePerDoneTask === null
        ? "no data"
        : `${current.reworkRatePerDoneTask.toFixed(2)} CRs / done task`,
    provenance:
      current.tasksDoneTotal === 0
        ? `${current.changeRequestsTotal} change ${plural(current.changeRequestsTotal, "request")} recorded, but no task is done yet — no rate`
        : `${current.changeRequestsTotal} change ${plural(current.changeRequestsTotal, "request")} ` +
          `(${current.changeRequestsUnresolved} unresolved) across ${current.tasksDoneTotal} done ${plural(current.tasksDoneTotal, "task")}`,
    delta: rateDelta(
      latestSnapshot,
      previousSnapshot,
      (s) => s.reworkRatePerDoneTask
    ),
  };

  const retries: HealthMetricCard = {
    id: "retry-exhaustion",
    label: `Retry exhaustion (${HEALTH_WINDOW_DAYS}d)`,
    value: `${current.retriesExhausted7d}`,
    provenance:
      `${current.retriesExhausted7d} retries-exhausted ${plural(current.retriesExhausted7d, "event")} ` +
      `in the last ${HEALTH_WINDOW_DAYS} days · ${current.tasksBlocked} ${plural(current.tasksBlocked, "task")} currently blocked`,
    delta: countDelta(
      latestSnapshot,
      previousSnapshot,
      (s) => s.retriesExhausted7d
    ),
  };

  // ── Quality ─────────────────────────────────────────────────────────────────
  const qaFailed = current.qaResultsWithChecks7d - current.qaPassedWithChecks7d;
  const qaPassRate: HealthMetricCard = {
    id: "qa-pass-rate",
    label: `QA pass rate (${HEALTH_WINDOW_DAYS}d)`,
    value:
      current.qaPassRate7d === null
        ? "no data"
        : `${current.qaPassedWithChecks7d}/${current.qaResultsWithChecks7d} passed (${percent(current.qaPassRate7d)})`,
    provenance:
      current.qaResultsWithChecks7d === 0
        ? `No QA verdicts with recorded checks in the last ${HEALTH_WINDOW_DAYS} days`
        : `${current.qaResultsWithChecks7d} QA ${plural(current.qaResultsWithChecks7d, "verdict")} with recorded checks ` +
          `(${current.qaPassedWithChecks7d} passed, ${qaFailed} failed)`,
    delta: rateDelta(latestSnapshot, previousSnapshot, (s) => s.qaPassRate7d),
  };

  const prOutcomes: HealthMetricCard = {
    id: "pr-outcomes",
    label: `CI & PR outcomes (${HEALTH_WINDOW_DAYS}d)`,
    value: `${current.prsMerged7d} merged`,
    provenance:
      `${current.prsMerged7d} ${plural(current.prsMerged7d, "PR")} merged · ` +
      `${current.prFeedbackReviews7d} PR-feedback change ${plural(current.prFeedbackReviews7d, "request")} ` +
      `(${current.prCiFailures7d} from CI failures)`,
    delta: countDelta(latestSnapshot, previousSnapshot, (s) => s.prsMerged7d),
  };

  // ── Learning ────────────────────────────────────────────────────────────────
  const memoryWritten: HealthMetricCard = {
    id: "memory-written",
    label: `Memory written (${HEALTH_WINDOW_DAYS}d)`,
    value: `${current.memoryRecords7d}`,
    provenance:
      `${current.memoryRecords7d} memory ${plural(current.memoryRecords7d, "record")} written ` +
      `in the last ${HEALTH_WINDOW_DAYS} days · ${current.memoryRecordsTotal} all-time`,
    delta: countDelta(
      latestSnapshot,
      previousSnapshot,
      (s) => s.memoryRecords7d
    ),
  };

  const standardsPromoted: HealthMetricCard = {
    id: "standards-promoted",
    label: `Standards promoted (${HEALTH_WINDOW_DAYS}d)`,
    value: `${current.standardsPromoted7d}`,
    provenance:
      `${current.standardsPromoted7d} ${plural(current.standardsPromoted7d, "standard")} promoted by the learning engine ` +
      `in the last ${HEALTH_WINDOW_DAYS} days · ${current.standardsTotal} all-time`,
    delta: countDelta(
      latestSnapshot,
      previousSnapshot,
      (s) => s.standardsPromoted7d
    ),
  };

  const snapshotNote = hasTrend
    ? `Computed live · trend compares the ${latestSnapshot.dayKey} and ${previousSnapshot.dayKey} daily snapshots`
    : latestSnapshot
      ? `Computed live · one daily snapshot recorded (${latestSnapshot.dayKey}) — trend appears after two`
      : "Computed live · no daily snapshots yet — the driver captures one per day";

  return {
    sections: [
      {
        id: "delivery",
        label: "Delivery",
        metrics: [throughput, rework, retries],
      },
      {
        id: "quality",
        label: "Quality",
        metrics: [qaPassRate, prOutcomes],
      },
      {
        id: "learning",
        label: "Learning",
        metrics: [memoryWritten, standardsPromoted],
      },
    ],
    windowDays: HEALTH_WINDOW_DAYS,
    hasTrend,
    snapshotNote,
  };
}
