import { describe, expect, it } from "vitest";
import {
  CI_FAILURE_NOTES_MARKER,
  HEALTH_WINDOW_DAYS,
  computeCompanyHealthMetrics,
  hasRecordedChecks,
  healthWindowStart,
  utcDayKey,
  type CompanyHealthSourceData,
} from "./company-health-service";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CAPTURED_AT = new Date("2026-07-02T10:30:00.000Z");

/** All-zero source data — the "brand-new company" baseline. */
function emptySource(
  overrides: Partial<CompanyHealthSourceData> = {}
): CompanyHealthSourceData {
  return {
    capturedAt: CAPTURED_AT,
    tasksDoneTotal: 0,
    tasksDone7d: 0,
    tasksBlocked: 0,
    changeRequestsTotal: 0,
    changeRequestsUnresolved: 0,
    retriesExhausted7d: 0,
    qaVerdicts7d: [],
    prsMerged7d: 0,
    prFeedbackReviews7d: [],
    memoryRecords7d: 0,
    memoryRecordsTotal: 0,
    standardsPromoted7d: 0,
    standardsTotal: 0,
    ...overrides,
  };
}

const REAL_CHECKS = JSON.stringify([
  { name: "pnpm test", status: "passed" },
]);

// ─── utcDayKey ────────────────────────────────────────────────────────────────

describe("utcDayKey", () => {
  it("formats a date as its UTC calendar day", () => {
    expect(utcDayKey(new Date("2026-07-02T10:30:00.000Z"))).toBe("2026-07-02");
  });

  it("keys strictly by UTC, not local time, at day boundaries", () => {
    expect(utcDayKey(new Date("2026-07-02T23:59:59.999Z"))).toBe("2026-07-02");
    expect(utcDayKey(new Date("2026-07-03T00:00:00.000Z"))).toBe("2026-07-03");
  });
});

// ─── healthWindowStart ────────────────────────────────────────────────────────

describe("healthWindowStart", () => {
  it(`is exactly ${HEALTH_WINDOW_DAYS} days before the window end`, () => {
    const end = new Date("2026-07-02T10:30:00.000Z");
    expect(healthWindowStart(end).toISOString()).toBe(
      "2026-06-25T10:30:00.000Z"
    );
  });
});

// ─── hasRecordedChecks ────────────────────────────────────────────────────────

describe("hasRecordedChecks", () => {
  it("accepts a non-empty JSON array", () => {
    expect(hasRecordedChecks(REAL_CHECKS)).toBe(true);
  });

  it("rejects the empty-evidence sentinel []", () => {
    expect(hasRecordedChecks("[]")).toBe(false);
  });

  it("rejects malformed JSON (no evidence we can read)", () => {
    expect(hasRecordedChecks("not json")).toBe(false);
    expect(hasRecordedChecks("")).toBe(false);
  });

  it("rejects JSON that is not an array", () => {
    expect(hasRecordedChecks("{}")).toBe(false);
    expect(hasRecordedChecks('"checks"')).toBe(false);
  });
});

// ─── computeCompanyHealthMetrics ──────────────────────────────────────────────

describe("computeCompanyHealthMetrics — empty company", () => {
  it("returns zero counts and null rates (never a fabricated 0% or 100%)", () => {
    const metrics = computeCompanyHealthMetrics(emptySource());

    expect(metrics.dayKey).toBe("2026-07-02");
    expect(metrics.capturedAt).toBe(CAPTURED_AT);
    expect(metrics.tasksDoneTotal).toBe(0);
    expect(metrics.tasksDone7d).toBe(0);
    expect(metrics.reworkRatePerDoneTask).toBeNull();
    expect(metrics.qaResultsWithChecks7d).toBe(0);
    expect(metrics.qaPassRate7d).toBeNull();
    expect(metrics.prFeedbackReviews7d).toBe(0);
    expect(metrics.prCiFailures7d).toBe(0);
  });
});

describe("computeCompanyHealthMetrics — QA pass rate", () => {
  it("computes the rate only over verdicts with recorded checks", () => {
    const metrics = computeCompanyHealthMetrics(
      emptySource({
        qaVerdicts7d: [
          { status: "passed", checks: REAL_CHECKS },
          { status: "failed", checks: REAL_CHECKS },
          // Evidence-free pass (gate passes on review approval only) — excluded.
          { status: "passed", checks: "[]" },
          // Unreadable evidence — excluded.
          { status: "passed", checks: "corrupt{" },
        ],
      })
    );

    expect(metrics.qaResultsWithChecks7d).toBe(2);
    expect(metrics.qaPassedWithChecks7d).toBe(1);
    expect(metrics.qaPassRate7d).toBe(0.5);
  });

  it("is null when every verdict lacks recorded checks", () => {
    const metrics = computeCompanyHealthMetrics(
      emptySource({
        qaVerdicts7d: [
          { status: "passed", checks: "[]" },
          { status: "passed", checks: "[]" },
        ],
      })
    );

    expect(metrics.qaResultsWithChecks7d).toBe(0);
    expect(metrics.qaPassRate7d).toBeNull();
  });
});

describe("computeCompanyHealthMetrics — rework rate", () => {
  it("divides all change requests by done tasks", () => {
    const metrics = computeCompanyHealthMetrics(
      emptySource({
        tasksDoneTotal: 4,
        changeRequestsTotal: 2,
        changeRequestsUnresolved: 1,
      })
    );

    expect(metrics.reworkRatePerDoneTask).toBe(0.5);
    expect(metrics.changeRequestsUnresolved).toBe(1);
  });

  it("is null with zero done tasks, even when change requests exist", () => {
    const metrics = computeCompanyHealthMetrics(
      emptySource({ tasksDoneTotal: 0, changeRequestsTotal: 3 })
    );

    expect(metrics.reworkRatePerDoneTask).toBeNull();
    expect(metrics.changeRequestsTotal).toBe(3);
  });
});

describe("computeCompanyHealthMetrics — PR feedback split", () => {
  it("counts CI failures by the marker in notes we authored", () => {
    const metrics = computeCompanyHealthMetrics(
      emptySource({
        prFeedbackReviews7d: [
          { notes: `${CI_FAILURE_NOTES_MARKER}: web-tests.` },
          { notes: "A reviewer requested changes on the pull request." },
          { notes: null },
        ],
      })
    );

    expect(metrics.prFeedbackReviews7d).toBe(3);
    expect(metrics.prCiFailures7d).toBe(1);
  });
});

describe("computeCompanyHealthMetrics — count passthrough", () => {
  it("carries every raw count into the metrics unchanged", () => {
    const metrics = computeCompanyHealthMetrics(
      emptySource({
        tasksDoneTotal: 10,
        tasksDone7d: 3,
        tasksBlocked: 2,
        changeRequestsTotal: 5,
        changeRequestsUnresolved: 1,
        retriesExhausted7d: 1,
        prsMerged7d: 4,
        memoryRecords7d: 6,
        memoryRecordsTotal: 20,
        standardsPromoted7d: 1,
        standardsTotal: 3,
      })
    );

    expect(metrics.tasksDone7d).toBe(3);
    expect(metrics.tasksBlocked).toBe(2);
    expect(metrics.retriesExhausted7d).toBe(1);
    expect(metrics.prsMerged7d).toBe(4);
    expect(metrics.memoryRecords7d).toBe(6);
    expect(metrics.memoryRecordsTotal).toBe(20);
    expect(metrics.standardsPromoted7d).toBe(1);
    expect(metrics.standardsTotal).toBe(3);
  });
});
