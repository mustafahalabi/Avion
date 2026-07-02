import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock prisma. The pure selectNextExecutableTask from task-selection.ts is
//     intentionally NOT mocked — its behavior is driven by the mocked rows. ──────

const mockTaskFindMany = vi.fn();
const mockPlanningDraftFindMany = vi.fn();
const mockReviewFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: (...args: unknown[]) => mockTaskFindMany(...args),
    },
    planningDraft: {
      findMany: (...args: unknown[]) => mockPlanningDraftFindMany(...args),
    },
    review: {
      findMany: (...args: unknown[]) => mockReviewFindMany(...args),
    },
  },
}));

import { selectNextExecutableTaskForCompany } from "./task-selection-service";

interface TaskRowOverrides {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  planItemId?: string | null;
  draftId?: string;
  draftStatus?: string;
  createdAt?: Date;
}

function makeTaskRow(overrides: TaskRowOverrides = {}) {
  const draftId = overrides.draftId ?? "draft-1";
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Task One",
    status: overrides.status ?? "todo",
    priority: overrides.priority ?? "medium",
    planningDraftId: draftId,
    planItemId: overrides.planItemId ?? "task:one",
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    planningDraft: {
      id: draftId,
      status: overrides.draftStatus ?? "approved",
      generatedTasks: "[]",
    },
  };
}

/**
 * Builds a task row created outside planning: no planning draft link, and no
 * loaded `planningDraft` relation. Only selectable as a rework candidate.
 */
function makePlanlessTaskRow(overrides: TaskRowOverrides = {}) {
  return {
    id: overrides.id ?? "task-adhoc",
    title: overrides.title ?? "Ad-hoc task",
    status: overrides.status ?? "in-progress",
    priority: overrides.priority ?? "medium",
    planningDraftId: null,
    planItemId: overrides.planItemId ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    planningDraft: null,
  };
}

interface DraftRow {
  id: string;
  generatedTasks: string;
}

function makeDraftRow(
  id: string,
  tasks: Array<{
    planItemId: string;
    dependencies?: string[];
    estimatedExecutionOrder?: number;
  }>,
): DraftRow {
  return { id, generatedTasks: JSON.stringify(tasks) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTaskFindMany.mockResolvedValue([]);
  mockPlanningDraftFindMany.mockResolvedValue([]);
  mockReviewFindMany.mockResolvedValue([]);
});

describe("selectNextExecutableTaskForCompany", () => {
  it("queries both tasks and planning drafts scoped to the company", async () => {
    await selectNextExecutableTaskForCompany("company-9");

    expect(mockTaskFindMany).toHaveBeenCalledTimes(1);
    expect(mockPlanningDraftFindMany).toHaveBeenCalledTimes(1);
    const taskWhere = mockTaskFindMany.mock.calls[0][0].where;
    expect(taskWhere.companyId).toBe("company-9");
    const draftWhere = mockPlanningDraftFindMany.mock.calls[0][0].where;
    expect(draftWhere.companyId).toBe("company-9");
  });

  it("returns no_approved_plans when there are no candidate tasks", async () => {
    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    expect(result.reasonCode).toBe("no_approved_plans");
  });

  it("selects the single ready todo task (happy path)", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-1", title: "Add health endpoint", planItemId: "task:health" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [{ planItemId: "task:health", dependencies: [] }]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-1");
    expect(result.reason).toContain("Add health endpoint");
  });

  it("returns all_blocked_by_status when every candidate is in a terminal status", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-1", status: "done", planItemId: "task:a" }),
      makeTaskRow({ id: "task-2", status: "in-review", planItemId: "task:b" }),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    expect(result.reasonCode).toBe("all_blocked_by_status");
  });

  it("returns no_executable_tasks when candidates exist but none are todo or terminal", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-1", status: "waiting", planItemId: "task:a" }),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    expect(result.reasonCode).toBe("no_executable_tasks");
  });

  it("blocks a todo task whose dependency is not complete", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-2", status: "todo", planItemId: "task:dependent" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [
        { planItemId: "task:dependent", dependencies: ["task:prereq"] },
      ]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    expect(result.reasonCode).toBe("all_blocked_by_dependencies");
  });

  it("unblocks a dependent task once its prerequisite task is done", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-prereq", status: "done", planItemId: "task:prereq" }),
      makeTaskRow({ id: "task-dep", status: "todo", planItemId: "task:dependent" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [
        { planItemId: "task:prereq", dependencies: [] },
        { planItemId: "task:dependent", dependencies: ["task:prereq"] },
      ]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-dep");
  });

  it("prefers higher-priority tasks over lower-priority ones", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-low", priority: "low", planItemId: "task:low" }),
      makeTaskRow({ id: "task-urgent", priority: "urgent", planItemId: "task:urgent" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [
        { planItemId: "task:low" },
        { planItemId: "task:urgent" },
      ]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task?.id).toBe("task-urgent");
  });

  it("breaks priority ties using the planned execution order", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-late", priority: "medium", planItemId: "task:late" }),
      makeTaskRow({ id: "task-early", priority: "medium", planItemId: "task:early" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [
        { planItemId: "task:late", estimatedExecutionOrder: 5 },
        { planItemId: "task:early", estimatedExecutionOrder: 1 },
      ]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task?.id).toBe("task-early");
  });

  it("breaks remaining ties using createdAt (earliest wins)", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({
        id: "task-newer",
        priority: "medium",
        planItemId: "task:newer",
        createdAt: new Date("2026-03-01T00:00:00Z"),
      }),
      makeTaskRow({
        id: "task-older",
        priority: "medium",
        planItemId: "task:older",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [
        { planItemId: "task:newer" },
        { planItemId: "task:older" },
      ]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task?.id).toBe("task-older");
  });

  it("ignores tasks whose planning draft did not load", async () => {
    const valid = makeTaskRow({ id: "task-valid", planItemId: "task:valid" });
    const orphan = {
      ...makeTaskRow({ id: "task-orphan", planItemId: "task:orphan" }),
      planningDraft: null,
    };
    mockTaskFindMany.mockResolvedValue([orphan, valid]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [{ planItemId: "task:valid" }]),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-valid");
  });

  it("selects an in-progress task with unresolved change requests as a rework", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-1", status: "in-progress", planItemId: "task:health" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [{ planItemId: "task:health", dependencies: [] }]),
    ]);
    // A review on the task carries an unresolved change request.
    mockReviewFindMany.mockResolvedValue([{ entityId: "task-1" }]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-1");
    // The rework query is scoped to unresolved change requests on task reviews.
    const reviewWhere = mockReviewFindMany.mock.calls[0][0].where;
    expect(reviewWhere.changeRequests).toEqual({ some: { resolved: false } });
    expect(reviewWhere.entityType).toBe("task");
  });

  it("does NOT select an in-progress task once its change requests are resolved", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: "task-1", status: "in-progress", planItemId: "task:health" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [{ planItemId: "task:health", dependencies: [] }]),
    ]);
    mockReviewFindMany.mockResolvedValue([]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    expect(result.reasonCode).toBe("all_blocked_by_status");
  });

  it("includes planless in-progress tasks in the selection query (MUS-270)", async () => {
    await selectNextExecutableTaskForCompany("company-1");

    const taskWhere = mockTaskFindMany.mock.calls[0][0].where;
    expect(Array.isArray(taskWhere.OR)).toBe(true);
    // One branch targets planless tasks (created outside planning) in either the
    // in-progress (fresh rework) or todo (failed rework) status — MUS-270/284.
    expect(taskWhere.OR).toContainEqual({
      planningDraftId: null,
      status: { in: ["in-progress", "todo"] },
    });
  });

  it("selects a planless in-progress task with unresolved change requests as rework (MUS-270)", async () => {
    // A task created outside planning (no draft) that failed QA: driven back to
    // in-progress with an open change request. It must re-enter the driver.
    mockTaskFindMany.mockResolvedValue([
      makePlanlessTaskRow({ id: "task-adhoc", title: "Fix copy typo" }),
    ]);
    mockReviewFindMany.mockResolvedValue([{ entityId: "task-adhoc" }]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-adhoc");
    // No plan linkage travels with a planless task.
    expect(result.task?.planningDraftId).toBe("");
    expect(result.task?.planItemId).toBeNull();
  });

  it("does NOT select a planless in-progress task without unresolved change requests", async () => {
    mockTaskFindMany.mockResolvedValue([
      makePlanlessTaskRow({ id: "task-adhoc" }),
    ]);
    mockReviewFindMany.mockResolvedValue([]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    // With no rework signal and no plan-linked candidate, nothing is selectable.
    expect(result.reasonCode).toBe("no_approved_plans");
  });

  it("selects a planless task at `todo` after a failed rework attempt (MUS-284)", async () => {
    // A failed/no-op rework ingest sets the task back to `todo`; it still carries
    // an unresolved change request and must be re-selected, not stranded.
    mockTaskFindMany.mockResolvedValue([
      makePlanlessTaskRow({ id: "task-adhoc", status: "todo", planItemId: null }),
    ]);
    mockReviewFindMany.mockResolvedValue([{ entityId: "task-adhoc" }]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-adhoc");
  });

  it("does NOT select a fresh planless `todo` task with no change request (preserves MUS-270 scoping)", async () => {
    mockTaskFindMany.mockResolvedValue([
      makePlanlessTaskRow({ id: "task-adhoc", status: "todo", planItemId: null }),
    ]);
    mockReviewFindMany.mockResolvedValue([]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task).toBeNull();
    expect(result.reasonCode).toBe("no_approved_plans");
  });

  it("prefers a ready plan-linked task but still surfaces a planless rework alongside it", async () => {
    // Mixed population: a plan-linked todo and a planless rework both selectable.
    // The plan-linked todo (urgent) wins on priority, proving planless inclusion
    // does not starve or override normal plan-driven selection.
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({
        id: "task-plan",
        title: "Planned urgent work",
        priority: "urgent",
        planItemId: "task:planned",
      }),
      makePlanlessTaskRow({ id: "task-adhoc", priority: "low" }),
    ]);
    mockPlanningDraftFindMany.mockResolvedValue([
      makeDraftRow("draft-1", [{ planItemId: "task:planned", dependencies: [] }]),
    ]);
    mockReviewFindMany.mockResolvedValue([{ entityId: "task-adhoc" }]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.reasonCode).toBe("selected");
    expect(result.task?.id).toBe("task-plan");
  });

  it("carries the planning draft id and plan item id onto the selected task", async () => {
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({
        id: "task-1",
        planItemId: "task:health",
        draftId: "draft-abc",
        draftStatus: "applied",
      }),
    ]);

    const result = await selectNextExecutableTaskForCompany("company-1");

    expect(result.task?.planningDraftId).toBe("draft-abc");
    expect(result.task?.planItemId).toBe("task:health");
  });
});
