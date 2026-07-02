import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock prisma. The pure selectNextExecutableTask from task-selection.ts is
//     intentionally NOT mocked — its behavior is driven by the mocked rows. ──────

const mockTaskFindMany = vi.fn();
const mockPlanningDraftFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: (...args: unknown[]) => mockTaskFindMany(...args),
    },
    planningDraft: {
      findMany: (...args: unknown[]) => mockPlanningDraftFindMany(...args),
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
