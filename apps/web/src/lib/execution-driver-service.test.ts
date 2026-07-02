import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (run-mode is real — pure concurrency mapping) ────────────────────────

const mockCompanySettingsFindUnique = vi.fn();
const mockSessionCount = vi.fn();
const mockTaskFindMany = vi.fn();
const mockCompanyFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companySettings: {
      findUnique: (...args: unknown[]) => mockCompanySettingsFindUnique(...args),
    },
    executionSession: { count: (...args: unknown[]) => mockSessionCount(...args) },
    task: { findMany: (...args: unknown[]) => mockTaskFindMany(...args) },
    company: { findMany: (...args: unknown[]) => mockCompanyFindMany(...args) },
  },
}));

const mockAutoPrepare = vi.fn();
vi.mock("@/lib/auto-execution-service", () => ({
  autoPrepareNextExecutionSession: (...args: unknown[]) => mockAutoPrepare(...args),
}));

const mockAdvanceTaskGates = vi.fn();
vi.mock("@/lib/gate-advancement-service", () => ({
  advanceTaskGates: (...args: unknown[]) => mockAdvanceTaskGates(...args),
}));

const mockCaptureHealthSnapshot = vi.fn();
vi.mock("@/lib/company-health-snapshot-service", () => ({
  captureCompanyHealthSnapshot: (...args: unknown[]) =>
    mockCaptureHealthSnapshot(...args),
}));

// Keep the LIVE status constant real-ish without importing the heavy service.
vi.mock("@/lib/execution-session-service", () => ({
  LIVE_EXECUTION_SESSION_STATUSES: ["queued", "prepared", "running"],
}));

import {
  runDriverTick,
  runDriverTickForCompany,
  summarizeDriverTick,
} from "./execution-driver-service";

beforeEach(() => {
  vi.clearAllMocks();
  mockCompanySettingsFindUnique.mockResolvedValue({ autonomyLevel: "assist" });
  mockSessionCount.mockResolvedValue(0);
  mockTaskFindMany.mockResolvedValue([]);
  mockCompanyFindMany.mockResolvedValue([{ id: "company-1" }]);
  mockAutoPrepare.mockResolvedValue({ status: "nothing_to_do", reason: "none" });
  mockAdvanceTaskGates.mockResolvedValue({
    status: "completed",
    reason: "done",
    taskId: "task-1",
  });
  mockCaptureHealthSnapshot.mockResolvedValue({
    status: "captured",
    snapshotId: "health-1",
    dayKey: "2026-07-02",
  });
});

describe("runDriverTickForCompany — enqueue", () => {
  it("enqueues up to the concurrency limit", async () => {
    // autonomous → limit 3; start with 0 live; every prepare succeeds.
    mockCompanySettingsFindUnique.mockResolvedValue({ autonomyLevel: "autonomous" });
    mockSessionCount.mockResolvedValue(0);
    mockAutoPrepare.mockResolvedValue({
      status: "prepared",
      reason: "prepared",
      sessionId: "ses",
    });

    const result = await runDriverTickForCompany("company-1");

    expect(result.concurrencyLimit).toBe(3);
    // Filled from 0 → 3.
    expect(mockAutoPrepare).toHaveBeenCalledTimes(3);
    expect(result.enqueued).toHaveLength(3);
  });

  it("does not enqueue when already at the concurrency limit", async () => {
    // assist → limit 1; already 1 live session.
    mockSessionCount.mockResolvedValue(1);

    const result = await runDriverTickForCompany("company-1");

    expect(result.concurrencyLimit).toBe(1);
    expect(mockAutoPrepare).not.toHaveBeenCalled();
    expect(result.enqueued).toHaveLength(0);
  });

  it("stops enqueuing when there is nothing to do", async () => {
    mockCompanySettingsFindUnique.mockResolvedValue({ autonomyLevel: "autonomous" });
    mockAutoPrepare.mockResolvedValue({ status: "nothing_to_do", reason: "none" });

    const result = await runDriverTickForCompany("company-1");

    // Limit is 3 but a single nothing_to_do breaks the loop.
    expect(mockAutoPrepare).toHaveBeenCalledTimes(1);
    expect(result.enqueued).toHaveLength(1);
  });

  it("stops enqueuing when an existing live session is found (no duplicate work)", async () => {
    mockCompanySettingsFindUnique.mockResolvedValue({ autonomyLevel: "autonomous" });
    mockAutoPrepare.mockResolvedValue({
      status: "skipped_existing_session",
      reason: "live session exists",
      sessionId: "ses-existing",
    });

    const result = await runDriverTickForCompany("company-1");

    expect(mockAutoPrepare).toHaveBeenCalledTimes(1);
    expect(result.enqueued[0]?.status).toBe("skipped_existing_session");
  });
});

describe("runDriverTickForCompany — gate advancement", () => {
  it("advances each in-review task through the gates", async () => {
    mockTaskFindMany.mockResolvedValue([{ id: "task-1" }, { id: "task-2" }]);

    const result = await runDriverTickForCompany("company-1");

    expect(mockAdvanceTaskGates).toHaveBeenCalledTimes(2);
    expect(mockAdvanceTaskGates).toHaveBeenCalledWith("company-1", "task-1");
    expect(mockAdvanceTaskGates).toHaveBeenCalledWith("company-1", "task-2");
    expect(result.advanced).toHaveLength(2);
  });

  it("advances nothing when no task is in-review", async () => {
    mockTaskFindMany.mockResolvedValue([]);
    const result = await runDriverTickForCompany("company-1");
    expect(mockAdvanceTaskGates).not.toHaveBeenCalled();
    expect(result.advanced).toHaveLength(0);
  });
});

describe("runDriverTickForCompany — health snapshot (best-effort)", () => {
  it("captures the company's daily health snapshot and reports its status", async () => {
    const result = await runDriverTickForCompany("company-1");

    expect(mockCaptureHealthSnapshot).toHaveBeenCalledTimes(1);
    expect(mockCaptureHealthSnapshot).toHaveBeenCalledWith("company-1");
    expect(result.health).toEqual({ status: "captured" });
  });

  it("reports already_captured on the second tick of the day", async () => {
    mockCaptureHealthSnapshot.mockResolvedValue({
      status: "already_captured",
      dayKey: "2026-07-02",
    });

    const result = await runDriverTickForCompany("company-1");

    expect(result.health).toEqual({ status: "already_captured" });
  });

  it("never breaks the tick when the snapshot step fails", async () => {
    mockCaptureHealthSnapshot.mockRejectedValue(new Error("db down"));

    const result = await runDriverTickForCompany("company-1");

    // The tick still completes and reports the step as errored (null).
    expect(result.health).toBeNull();
    expect(result.companyId).toBe("company-1");
  });
});

describe("runDriverTick", () => {
  it("ticks every company", async () => {
    mockCompanyFindMany.mockResolvedValue([{ id: "company-1" }, { id: "company-2" }]);

    const results = await runDriverTick();

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.companyId)).toEqual(["company-1", "company-2"]);
  });
});

describe("summarizeDriverTick", () => {
  it("summarizes prepared, completed, and awaiting counts", () => {
    const summary = summarizeDriverTick({
      companyId: "company-1",
      liveSessionsBefore: 1,
      concurrencyLimit: 3,
      enqueued: [
        { status: "prepared", reason: "ok", sessionId: "s1" },
        { status: "nothing_to_do", reason: "none" },
      ],
      advanced: [
        { status: "completed", reason: "done", taskId: "t1" },
        { status: "awaiting_review", reason: "needs CEO", taskId: "t2" },
      ],
    });

    expect(summary).toContain("company-1");
    expect(summary).toContain("live 1/3");
    expect(summary).toContain("prepared 1");
    expect(summary).toContain("completed 1");
    expect(summary).toContain("awaiting-approval 1");
  });
});
