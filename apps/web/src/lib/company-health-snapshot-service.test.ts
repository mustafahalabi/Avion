import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as SnapshotServiceModule from "./company-health-snapshot-service";
import { computeCompanyHealthMetrics } from "./company-health-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof SnapshotServiceModule;

/** Fixed "now" so window membership is deterministic. */
const NOW = new Date("2026-07-02T12:00:00.000Z");
/** Inside the trailing 7-day window ending at NOW. */
const IN_WINDOW = new Date("2026-06-28T12:00:00.000Z");
/** Before the window start (2026-06-25T12:00Z). */
const OUT_WINDOW = new Date("2026-06-20T12:00:00.000Z");

const REAL_CHECKS = JSON.stringify([{ name: "pnpm test", status: "passed" }]);

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("company-health-snapshot-service"));
  service = await import("./company-health-snapshot-service");

  await prisma.user.createMany({
    data: [
      { id: "user-1", email: "owner1@acme.test" },
      { id: "user-2", email: "owner2@other.test" },
    ],
  });
  await prisma.company.createMany({
    data: [
      { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
      { id: "company-2", name: "Other", slug: "other", ownerId: "user-2" },
    ],
  });

  // ── Tasks: done in/out of window, blocked, in-progress ────────────────────
  await prisma.task.createMany({
    data: [
      { id: "task-done-recent", companyId: "company-1", title: "Done recently", status: "done", updatedAt: IN_WINDOW },
      { id: "task-done-old", companyId: "company-1", title: "Done long ago", status: "done", updatedAt: OUT_WINDOW },
      { id: "task-blocked", companyId: "company-1", title: "Blocked", status: "blocked", updatedAt: IN_WINDOW },
      { id: "task-progress", companyId: "company-1", title: "In progress", status: "in-progress", updatedAt: IN_WINDOW },
      // Other company — must never leak into company-1 counts.
      { id: "task-other-done", companyId: "company-2", title: "Other done", status: "done", updatedAt: IN_WINDOW },
    ],
  });

  // ── Reviews + ChangeRequests ───────────────────────────────────────────────
  await prisma.review.create({
    data: {
      id: "review-1",
      companyId: "company-1",
      title: "Review: done task",
      entityType: "task",
      entityId: "task-done-recent",
      status: "changes_requested",
      changeRequests: {
        create: [
          { id: "cr-unresolved", reason: "Fix the API validation", resolved: false },
          { id: "cr-resolved", reason: "Rename helper", resolved: true },
        ],
      },
    },
  });
  // PR-feedback reviews (created by pr-feedback ingestion): CI failure and
  // reviewer changes in the window; an old CI failure outside it.
  await prisma.review.createMany({
    data: [
      {
        id: "review-pr-ci",
        companyId: "company-1",
        title: "PR feedback: done task",
        entityType: "task",
        entityId: "task-done-recent",
        status: "changes_requested",
        notes: "CI checks failed: web-tests.",
        createdAt: IN_WINDOW,
      },
      {
        id: "review-pr-reviewer",
        companyId: "company-1",
        title: "PR feedback: blocked task",
        entityType: "task",
        entityId: "task-blocked",
        status: "changes_requested",
        notes: "A reviewer requested changes on the pull request.",
        createdAt: IN_WINDOW,
      },
      {
        id: "review-pr-old",
        companyId: "company-1",
        title: "PR feedback: ancient",
        entityType: "task",
        entityId: "task-done-old",
        status: "changes_requested",
        notes: "CI checks failed on the pull request.",
        createdAt: OUT_WINDOW,
      },
    ],
  });
  await prisma.review.create({
    data: {
      id: "review-other",
      companyId: "company-2",
      title: "Review: other company",
      entityType: "task",
      entityId: "task-other-done",
      status: "changes_requested",
      changeRequests: {
        create: [{ id: "cr-other", reason: "Other company CR", resolved: false }],
      },
    },
  });

  // ── QA results: verdicts with/without recorded checks, in/out of window ───
  await prisma.qAResult.createMany({
    data: [
      { id: "qa-pass-checks", companyId: "company-1", entityType: "task", entityId: "task-done-recent", status: "passed", checks: REAL_CHECKS, updatedAt: IN_WINDOW },
      { id: "qa-fail-checks", companyId: "company-1", entityType: "task", entityId: "task-blocked", status: "failed", checks: REAL_CHECKS, updatedAt: IN_WINDOW },
      // Evidence-free pass — selected by the fetch, excluded by the math.
      { id: "qa-pass-nochecks", companyId: "company-1", entityType: "task", entityId: "task-progress", status: "passed", checks: "[]", updatedAt: IN_WINDOW },
      { id: "qa-old", companyId: "company-1", entityType: "task", entityId: "task-done-old", status: "passed", checks: REAL_CHECKS, updatedAt: OUT_WINDOW },
      { id: "qa-pending", companyId: "company-1", entityType: "task", entityId: "task-done-recent", status: "pending", checks: REAL_CHECKS, updatedAt: IN_WINDOW },
    ],
  });

  // ── Execution sessions: merged PRs in/out of window ───────────────────────
  await prisma.executionSession.createMany({
    data: [
      { id: "ses-merged-recent", companyId: "company-1", prStatus: "merged", prNumber: 1, updatedAt: IN_WINDOW },
      { id: "ses-merged-old", companyId: "company-1", prStatus: "merged", prNumber: 2, updatedAt: OUT_WINDOW },
      { id: "ses-open", companyId: "company-1", prStatus: "open", prNumber: 3, updatedAt: IN_WINDOW },
      { id: "ses-other-merged", companyId: "company-2", prStatus: "merged", prNumber: 4, updatedAt: IN_WINDOW },
    ],
  });

  // ── Memory: ordinary records + learning-promoted standards ────────────────
  await prisma.memory.create({
    data: {
      id: "mem-review",
      companyId: "company-1",
      title: "Review lessons",
      category: "review",
      records: {
        create: [
          { id: "rec-review", content: "Lesson from review", source: "review:review-1", createdAt: IN_WINDOW },
          { id: "rec-old", content: "Old lesson", source: null, createdAt: OUT_WINDOW },
        ],
      },
    },
  });
  await prisma.memory.create({
    data: {
      id: "mem-standards",
      companyId: "company-1",
      title: "Engineering standards (learned)",
      category: "standards",
      records: {
        create: [
          { id: "rec-standard", content: "Recurring finding promoted", source: "learning:add-input-validation-blocker", createdAt: IN_WINDOW },
          { id: "rec-standard-old", content: "Old standard", source: "learning:old-standard", createdAt: OUT_WINDOW },
        ],
      },
    },
  });
  await prisma.memory.create({
    data: {
      id: "mem-other",
      companyId: "company-2",
      title: "Other company memory",
      category: "company",
      records: {
        create: [{ id: "rec-other", content: "Other lesson", source: null, createdAt: IN_WINDOW }],
      },
    },
  });

  // ── Timeline: retries-exhausted events (MUS-252) + noise ──────────────────
  await prisma.timelineEntry.createMany({
    data: [
      { id: "te-exhausted", entityType: "task", entityId: "task-blocked", eventType: "execution_retries_exhausted", summary: "Blocked after 3 failures.", createdAt: IN_WINDOW },
      { id: "te-exhausted-old", entityType: "task", entityId: "task-done-old", eventType: "execution_retries_exhausted", summary: "Ancient exhaustion.", createdAt: OUT_WINDOW },
      // Other company's task — excluded from company-1 by task scoping.
      { id: "te-other", entityType: "task", entityId: "task-other-done", eventType: "execution_retries_exhausted", summary: "Other exhaustion.", createdAt: IN_WINDOW },
      // Same task, different event type — excluded by eventType.
      { id: "te-noise", entityType: "task", entityId: "task-blocked", eventType: "pr_merged", summary: "PR merged.", createdAt: IN_WINDOW },
    ],
  });
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

// ─── fetchCompanyHealthSourceData ─────────────────────────────────────────────

describe("fetchCompanyHealthSourceData", () => {
  it("counts exactly the company's rows inside the trailing window", async () => {
    const data = await service.fetchCompanyHealthSourceData("company-1", NOW);

    expect(data.capturedAt).toBe(NOW);
    expect(data.tasksDoneTotal).toBe(2);
    expect(data.tasksDone7d).toBe(1); // task-done-old is outside the window
    expect(data.tasksBlocked).toBe(1);
    expect(data.changeRequestsTotal).toBe(2); // resolved + unresolved
    expect(data.changeRequestsUnresolved).toBe(1);
    expect(data.retriesExhausted7d).toBe(1); // old + other-company + noise excluded

    expect(data.qaVerdicts7d).toHaveLength(3); // pending + out-of-window excluded
    expect(data.prsMerged7d).toBe(1);
    expect(data.prFeedbackReviews7d).toHaveLength(2);

    expect(data.memoryRecords7d).toBe(2); // rec-review + rec-standard
    expect(data.memoryRecordsTotal).toBe(4);
    expect(data.standardsPromoted7d).toBe(1);
    expect(data.standardsTotal).toBe(2);
  });

  it("keeps companies isolated from each other", async () => {
    const data = await service.fetchCompanyHealthSourceData("company-2", NOW);

    expect(data.tasksDoneTotal).toBe(1);
    expect(data.changeRequestsTotal).toBe(1);
    expect(data.retriesExhausted7d).toBe(1); // te-other, via company-2's task
    expect(data.qaVerdicts7d).toHaveLength(0);
    expect(data.prsMerged7d).toBe(1);
    expect(data.prFeedbackReviews7d).toHaveLength(0);
    expect(data.memoryRecords7d).toBe(1);
    expect(data.standardsTotal).toBe(0);
  });
});

// ─── computeCurrentCompanyHealth (fetch + math) ───────────────────────────────

describe("computeCurrentCompanyHealth", () => {
  it("derives honest rates from the fetched rows", async () => {
    const metrics = await service.computeCurrentCompanyHealth("company-1", NOW);

    expect(metrics.dayKey).toBe("2026-07-02");
    // 2 verdicts with recorded checks (evidence-free pass excluded): 1 passed.
    expect(metrics.qaResultsWithChecks7d).toBe(2);
    expect(metrics.qaPassedWithChecks7d).toBe(1);
    expect(metrics.qaPassRate7d).toBe(0.5);
    // 2 change requests / 2 done tasks.
    expect(metrics.reworkRatePerDoneTask).toBe(1);
    // 2 PR-feedback reviews in window, 1 carries the CI-failure marker.
    expect(metrics.prFeedbackReviews7d).toBe(2);
    expect(metrics.prCiFailures7d).toBe(1);

    // The composition equals fetch → pure compute.
    const data = await service.fetchCompanyHealthSourceData("company-1", NOW);
    expect(metrics).toEqual(computeCompanyHealthMetrics(data));
  });
});

// ─── captureCompanyHealthSnapshot ─────────────────────────────────────────────

describe("captureCompanyHealthSnapshot", () => {
  it("persists the computed metrics on first capture of the day", async () => {
    const result = await service.captureCompanyHealthSnapshot("company-1", NOW);

    expect(result.status).toBe("captured");
    expect(result.dayKey).toBe("2026-07-02");

    const row = await prisma.companyHealthSnapshot.findUnique({
      where: {
        companyId_dayKey: { companyId: "company-1", dayKey: "2026-07-02" },
      },
    });
    expect(row).not.toBeNull();
    expect(row?.tasksDoneTotal).toBe(2);
    expect(row?.tasksDone7d).toBe(1);
    expect(row?.tasksBlocked).toBe(1);
    expect(row?.changeRequestsTotal).toBe(2);
    expect(row?.changeRequestsUnresolved).toBe(1);
    expect(row?.reworkRatePerDoneTask).toBe(1);
    expect(row?.retriesExhausted7d).toBe(1);
    expect(row?.qaResultsWithChecks7d).toBe(2);
    expect(row?.qaPassedWithChecks7d).toBe(1);
    expect(row?.qaPassRate7d).toBe(0.5);
    expect(row?.prsMerged7d).toBe(1);
    expect(row?.prFeedbackReviews7d).toBe(2);
    expect(row?.prCiFailures7d).toBe(1);
    expect(row?.memoryRecords7d).toBe(2);
    expect(row?.memoryRecordsTotal).toBe(4);
    expect(row?.standardsPromoted7d).toBe(1);
    expect(row?.standardsTotal).toBe(2);
  });

  it("is idempotent within the same UTC day (check-before-write)", async () => {
    const again = await service.captureCompanyHealthSnapshot(
      "company-1",
      // Later the same UTC day — still one snapshot.
      new Date("2026-07-02T23:00:00.000Z")
    );

    expect(again.status).toBe("already_captured");
    expect(again.dayKey).toBe("2026-07-02");

    const count = await prisma.companyHealthSnapshot.count({
      where: { companyId: "company-1" },
    });
    expect(count).toBe(1);
  });

  it("captures a fresh snapshot on the next UTC day", async () => {
    const nextDay = await service.captureCompanyHealthSnapshot(
      "company-1",
      new Date("2026-07-03T09:00:00.000Z")
    );

    expect(nextDay.status).toBe("captured");
    expect(nextDay.dayKey).toBe("2026-07-03");

    const count = await prisma.companyHealthSnapshot.count({
      where: { companyId: "company-1" },
    });
    expect(count).toBe(2);
  });

  it("scopes the once-per-day rule per company", async () => {
    const other = await service.captureCompanyHealthSnapshot("company-2", NOW);
    expect(other.status).toBe("captured");
    expect(other.dayKey).toBe("2026-07-02");
  });
});

// ─── listRecentCompanyHealthSnapshots ─────────────────────────────────────────

describe("listRecentCompanyHealthSnapshots", () => {
  it("returns the newest snapshots first, limited by take", async () => {
    const two = await service.listRecentCompanyHealthSnapshots("company-1", 2);
    expect(two.map((s) => s.dayKey)).toEqual(["2026-07-03", "2026-07-02"]);

    const one = await service.listRecentCompanyHealthSnapshots("company-1", 1);
    expect(one.map((s) => s.dayKey)).toEqual(["2026-07-03"]);
  });
});
