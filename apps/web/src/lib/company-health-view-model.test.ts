import { describe, expect, it } from "vitest";
import type { CompanyHealthMetrics } from "./company-health-service";
import {
  buildCompanyHealthViewModel,
  type CompanyHealthSnapshotLike,
  type HealthMetricCard,
} from "./company-health-view-model";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function metrics(
  overrides: Partial<CompanyHealthMetrics> = {}
): CompanyHealthMetrics {
  return {
    capturedAt: new Date("2026-07-02T10:30:00.000Z"),
    dayKey: "2026-07-02",
    tasksDoneTotal: 10,
    tasksDone7d: 3,
    tasksBlocked: 1,
    changeRequestsTotal: 5,
    changeRequestsUnresolved: 2,
    reworkRatePerDoneTask: 0.5,
    retriesExhausted7d: 1,
    qaResultsWithChecks7d: 3,
    qaPassedWithChecks7d: 2,
    qaPassRate7d: 2 / 3,
    prsMerged7d: 4,
    prFeedbackReviews7d: 2,
    prCiFailures7d: 1,
    memoryRecords7d: 6,
    memoryRecordsTotal: 20,
    standardsPromoted7d: 1,
    standardsTotal: 3,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<CompanyHealthSnapshotLike> = {}
): CompanyHealthSnapshotLike {
  return {
    dayKey: "2026-07-01",
    tasksDone7d: 2,
    reworkRatePerDoneTask: 0.4,
    retriesExhausted7d: 1,
    qaResultsWithChecks7d: 2,
    qaPassedWithChecks7d: 1,
    qaPassRate7d: 0.5,
    prsMerged7d: 5,
    prFeedbackReviews7d: 1,
    memoryRecords7d: 6,
    standardsPromoted7d: 0,
    ...overrides,
  };
}

function findMetric(
  vm: ReturnType<typeof buildCompanyHealthViewModel>,
  id: string
): HealthMetricCard {
  const metric = vm.sections
    .flatMap((s) => s.metrics)
    .find((m) => m.id === id);
  if (!metric) throw new Error(`metric ${id} not found`);
  return metric;
}

// ─── Structure ────────────────────────────────────────────────────────────────

describe("buildCompanyHealthViewModel — structure", () => {
  it("groups the seven metrics into delivery / quality / learning", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: null,
      previousSnapshot: null,
    });

    expect(vm.sections.map((s) => s.id)).toEqual([
      "delivery",
      "quality",
      "learning",
    ]);
    expect(vm.sections.flatMap((s) => s.metrics.map((m) => m.id))).toEqual([
      "throughput",
      "rework-rate",
      "retry-exhaustion",
      "qa-pass-rate",
      "pr-outcomes",
      "memory-written",
      "standards-promoted",
    ]);
  });
});

// ─── Provenance ───────────────────────────────────────────────────────────────

describe("buildCompanyHealthViewModel — provenance strings", () => {
  const vm = buildCompanyHealthViewModel({
    current: metrics(),
    latestSnapshot: null,
    previousSnapshot: null,
  });

  it("throughput names the done rows behind the number", () => {
    const m = findMetric(vm, "throughput");
    expect(m.value).toBe("3");
    expect(m.provenance).toBe(
      "3 tasks reached done in the last 7 days · 10 done all-time"
    );
  });

  it("rework rate shows the change-request and done-task counts", () => {
    const m = findMetric(vm, "rework-rate");
    expect(m.value).toBe("0.50 CRs / done task");
    expect(m.provenance).toBe(
      "5 change requests (2 unresolved) across 10 done tasks"
    );
  });

  it("retry exhaustion shows events plus currently blocked tasks", () => {
    const m = findMetric(vm, "retry-exhaustion");
    expect(m.value).toBe("1");
    expect(m.provenance).toBe(
      "1 retries-exhausted event in the last 7 days · 1 task currently blocked"
    );
  });

  it("QA pass rate is a transparent ratio with its denominator", () => {
    const m = findMetric(vm, "qa-pass-rate");
    expect(m.value).toBe("2/3 passed (67%)");
    expect(m.provenance).toBe(
      "3 QA verdicts with recorded checks (2 passed, 1 failed)"
    );
  });

  it("PR outcomes count merges and feedback change requests", () => {
    const m = findMetric(vm, "pr-outcomes");
    expect(m.value).toBe("4 merged");
    expect(m.provenance).toBe(
      "4 PRs merged · 2 PR-feedback change requests (1 from CI failures)"
    );
  });

  it("learning metrics show window and all-time counts", () => {
    expect(findMetric(vm, "memory-written").provenance).toBe(
      "6 memory records written in the last 7 days · 20 all-time"
    );
    expect(findMetric(vm, "standards-promoted").provenance).toBe(
      "1 standard promoted by the learning engine in the last 7 days · 3 all-time"
    );
  });
});

// ─── Empty denominators ───────────────────────────────────────────────────────

describe("buildCompanyHealthViewModel — no-data states", () => {
  it("renders 'no data' (not 0% or 100%) for empty QA denominators", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics({
        qaResultsWithChecks7d: 0,
        qaPassedWithChecks7d: 0,
        qaPassRate7d: null,
      }),
      latestSnapshot: null,
      previousSnapshot: null,
    });

    const m = findMetric(vm, "qa-pass-rate");
    expect(m.value).toBe("no data");
    expect(m.provenance).toBe(
      "No QA verdicts with recorded checks in the last 7 days"
    );
  });

  it("explains a missing rework rate instead of faking one", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics({
        tasksDoneTotal: 0,
        changeRequestsTotal: 3,
        reworkRatePerDoneTask: null,
      }),
      latestSnapshot: null,
      previousSnapshot: null,
    });

    const m = findMetric(vm, "rework-rate");
    expect(m.value).toBe("no data");
    expect(m.provenance).toBe(
      "3 change requests recorded, but no task is done yet — no rate"
    );
  });
});

// ─── Trend deltas ─────────────────────────────────────────────────────────────

describe("buildCompanyHealthViewModel — trend", () => {
  it("shows no deltas with fewer than two snapshots", () => {
    const withNone = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: null,
      previousSnapshot: null,
    });
    const withOne = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: snapshot({ dayKey: "2026-07-02" }),
      previousSnapshot: null,
    });

    for (const vm of [withNone, withOne]) {
      expect(vm.hasTrend).toBe(false);
      for (const m of vm.sections.flatMap((s) => s.metrics)) {
        expect(m.delta).toBeUndefined();
      }
    }
    expect(withNone.snapshotNote).toContain("no daily snapshots yet");
    expect(withOne.snapshotNote).toContain("trend appears after two");
  });

  it("computes count deltas between the two latest snapshots", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: snapshot({
        dayKey: "2026-07-02",
        tasksDone7d: 5,
        prsMerged7d: 5,
        retriesExhausted7d: 1,
      }),
      previousSnapshot: snapshot({
        dayKey: "2026-07-01",
        tasksDone7d: 2,
        prsMerged7d: 6,
        retriesExhausted7d: 1,
      }),
    });

    expect(vm.hasTrend).toBe(true);
    expect(findMetric(vm, "throughput").delta).toEqual({
      direction: "up",
      text: "+3 vs previous snapshot (2026-07-01)",
    });
    expect(findMetric(vm, "pr-outcomes").delta).toEqual({
      direction: "down",
      text: "-1 vs previous snapshot (2026-07-01)",
    });
    expect(findMetric(vm, "retry-exhaustion").delta).toEqual({
      direction: "flat",
      text: "±0 vs previous snapshot (2026-07-01)",
    });
  });

  it("computes rate deltas in percentage points", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: snapshot({ dayKey: "2026-07-02", qaPassRate7d: 0.75 }),
      previousSnapshot: snapshot({ dayKey: "2026-07-01", qaPassRate7d: 0.5 }),
    });

    expect(findMetric(vm, "qa-pass-rate").delta).toEqual({
      direction: "up",
      text: "+25 pts vs previous snapshot (2026-07-01)",
    });
  });

  it("omits a rate delta when either snapshot recorded no data", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: snapshot({ dayKey: "2026-07-02", qaPassRate7d: 0.75 }),
      previousSnapshot: snapshot({ dayKey: "2026-07-01", qaPassRate7d: null }),
    });

    expect(findMetric(vm, "qa-pass-rate").delta).toBeUndefined();
    // Count deltas on the same snapshots still appear.
    expect(findMetric(vm, "throughput").delta).toBeDefined();
  });

  it("names both snapshot days in the panel note", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics(),
      latestSnapshot: snapshot({ dayKey: "2026-07-02" }),
      previousSnapshot: snapshot({ dayKey: "2026-07-01" }),
    });

    expect(vm.snapshotNote).toBe(
      "Computed live · trend compares the 2026-07-02 and 2026-07-01 daily snapshots"
    );
  });
});

// ─── Pluralization ────────────────────────────────────────────────────────────

describe("buildCompanyHealthViewModel — pluralization", () => {
  it("uses singular forms for counts of one", () => {
    const vm = buildCompanyHealthViewModel({
      current: metrics({
        tasksDone7d: 1,
        tasksDoneTotal: 1,
        changeRequestsTotal: 1,
        changeRequestsUnresolved: 0,
        reworkRatePerDoneTask: 1,
        prsMerged7d: 1,
        prFeedbackReviews7d: 1,
        memoryRecords7d: 1,
        memoryRecordsTotal: 1,
      }),
      latestSnapshot: null,
      previousSnapshot: null,
    });

    expect(findMetric(vm, "throughput").provenance).toBe(
      "1 task reached done in the last 7 days · 1 done all-time"
    );
    expect(findMetric(vm, "rework-rate").provenance).toBe(
      "1 change request (0 unresolved) across 1 done task"
    );
    expect(findMetric(vm, "pr-outcomes").provenance).toBe(
      "1 PR merged · 1 PR-feedback change request (1 from CI failures)"
    );
    expect(findMetric(vm, "memory-written").provenance).toBe(
      "1 memory record written in the last 7 days · 1 all-time"
    );
  });
});
