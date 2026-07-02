import { describe, expect, it } from "vitest";

import {
  areDependenciesSatisfied,
  isApprovedOrAppliedPlanningDraft,
  isExecutableCandidate,
  isExecutableTaskStatus,
  isSelectableCandidate,
  parseGeneratedTaskMetadata,
  selectNextExecutableTask,
  type TaskSelectionCandidate,
} from "./task-selection";

const BASE_CANDIDATE: TaskSelectionCandidate = {
  id: "task-1",
  title: "Detect package manager",
  status: "todo",
  priority: "medium",
  planningDraftId: "plan-1",
  planningDraftStatus: "applied",
  planItemId: "task:detect-package-manager",
  createdAt: new Date("2026-06-28T00:00:00.000Z"),
};

function buildMetadata() {
  return parseGeneratedTaskMetadata(
    JSON.stringify([
      {
        planItemId: "task:inspect-source-tree-model",
        featurePlanItemId: "feature:repo-intelligence",
        title: "Inspect source tree model",
        description: "Inspect repository tree ingestion.",
        recommendedRole: "Backend Engineer",
        recommendedEmployeeId: null,
        recommendedEmployeeName: null,
        dependencies: [],
        acceptanceCriteria: ["Tree ingestion exists."],
        definitionOfDone: ["Done."],
        requiredContext: ["Repository metadata."],
        reviewRequirements: ["Reviewed."],
        qaImpact: "Regression coverage required.",
        estimatedExecutionOrder: 1,
        estimatePoints: 2,
      },
      {
        planItemId: "task:detect-package-manager",
        featurePlanItemId: "feature:repo-intelligence",
        title: "Detect package manager",
        description: "Detect npm, pnpm, yarn, or bun.",
        recommendedRole: "Backend Engineer",
        recommendedEmployeeId: null,
        recommendedEmployeeName: null,
        dependencies: ["task:inspect-source-tree-model"],
        acceptanceCriteria: ["Package manager is detected."],
        definitionOfDone: ["Done."],
        requiredContext: ["Repository metadata."],
        reviewRequirements: ["Reviewed."],
        qaImpact: "Regression coverage required.",
        estimatedExecutionOrder: 2,
        estimatePoints: 3,
      },
      {
        planItemId: "task:expose-summary-ui",
        featurePlanItemId: "feature:repo-intelligence",
        title: "Expose summary UI",
        description: "Build repository intelligence dashboard.",
        recommendedRole: "Frontend Engineer",
        recommendedEmployeeId: null,
        recommendedEmployeeName: null,
        dependencies: ["task:detect-package-manager"],
        acceptanceCriteria: ["Dashboard renders summary."],
        definitionOfDone: ["Done."],
        requiredContext: ["Repository metadata."],
        reviewRequirements: ["Reviewed."],
        qaImpact: "UI regression coverage required.",
        estimatedExecutionOrder: 3,
        estimatePoints: 5,
      },
    ])
  );
}

describe("task-selection", () => {
  describe("parseGeneratedTaskMetadata", () => {
    it("parses generated task dependencies and execution order", () => {
      const metadata = buildMetadata();

      expect(metadata.get("task:detect-package-manager")?.dependencies).toEqual([
        "task:inspect-source-tree-model",
      ]);
      expect(metadata.get("task:detect-package-manager")?.estimatedExecutionOrder).toBe(2);
    });

    it("returns an empty map for invalid JSON", () => {
      expect(parseGeneratedTaskMetadata("not-json").size).toBe(0);
    });
  });

  describe("guard helpers", () => {
    it("accepts approved and applied planning drafts", () => {
      expect(isApprovedOrAppliedPlanningDraft("approved")).toBe(true);
      expect(isApprovedOrAppliedPlanningDraft("applied")).toBe(true);
      expect(isApprovedOrAppliedPlanningDraft("draft")).toBe(false);
    });

    it("treats todo as the only executable task status", () => {
      expect(isExecutableTaskStatus("todo")).toBe(true);
      expect(isExecutableTaskStatus("in-progress")).toBe(false);
      expect(isExecutableTaskStatus("done")).toBe(false);
    });

    it("treats an in-progress task with unresolved change requests as an executable rework", () => {
      expect(
        isExecutableCandidate({ ...BASE_CANDIDATE, status: "in-progress", needsRework: true })
      ).toBe(true);
      expect(
        isExecutableCandidate({ ...BASE_CANDIDATE, status: "in-progress", needsRework: false })
      ).toBe(false);
      // Rework never resurrects terminal or blocked statuses.
      expect(
        isExecutableCandidate({ ...BASE_CANDIDATE, status: "done", needsRework: true })
      ).toBe(false);
      expect(
        isExecutableCandidate({ ...BASE_CANDIDATE, status: "blocked", needsRework: true })
      ).toBe(false);
    });

    it("keeps plan-linked selection gated on an approved or applied draft", () => {
      expect(
        isSelectableCandidate({ ...BASE_CANDIDATE, planningDraftStatus: "applied" })
      ).toBe(true);
      expect(
        isSelectableCandidate({ ...BASE_CANDIDATE, planningDraftStatus: "draft" })
      ).toBe(false);
    });

    it("makes a planless task selectable only when it needs rework (MUS-270)", () => {
      const planless: TaskSelectionCandidate = {
        ...BASE_CANDIDATE,
        planningDraftId: "",
        planningDraftStatus: "draft",
        planItemId: null,
      };
      expect(isSelectableCandidate({ ...planless, needsRework: true })).toBe(true);
      expect(isSelectableCandidate({ ...planless, needsRework: false })).toBe(false);
      // A planless task with no rework signal is never selected for a first run.
      expect(isSelectableCandidate(planless)).toBe(false);
    });
  });

  describe("areDependenciesSatisfied", () => {
    it("returns true when every dependency is complete", () => {
      const completed = new Set(["task:inspect-source-tree-model"]);

      expect(
        areDependenciesSatisfied(["task:inspect-source-tree-model"], completed)
      ).toBe(true);
    });

    it("returns false when a dependency is incomplete", () => {
      expect(areDependenciesSatisfied(["task:inspect-source-tree-model"], new Set())).toBe(
        false
      );
    });
  });

  describe("selectNextExecutableTask", () => {
    it("selects the first ready task when dependencies are satisfied", () => {
      const metadata = buildMetadata();
      const completed = new Set(["task:inspect-source-tree-model"]);

      const result = selectNextExecutableTask(
        [
          BASE_CANDIDATE,
          {
            ...BASE_CANDIDATE,
            id: "task-2",
            title: "Expose summary UI",
            planItemId: "task:expose-summary-ui",
          },
        ],
        completed,
        metadata
      );

      expect(result.reasonCode).toBe("selected");
      expect(result.task?.id).toBe("task-1");
      expect(result.task?.planItemId).toBe("task:detect-package-manager");
    });

    it("skips blocked, completed, in-review, and in-progress tasks", () => {
      const metadata = buildMetadata();

      const result = selectNextExecutableTask(
        [
          { ...BASE_CANDIDATE, status: "blocked" },
          { ...BASE_CANDIDATE, id: "task-done", status: "done" },
          { ...BASE_CANDIDATE, id: "task-review", status: "in-review" },
          { ...BASE_CANDIDATE, id: "task-progress", status: "in-progress" },
        ],
        new Set(),
        metadata
      );

      expect(result.task).toBeNull();
      expect(result.reasonCode).toBe("all_blocked_by_status");
    });

    it("returns a dependency reason when todo tasks are waiting on incomplete work", () => {
      const metadata = buildMetadata();

      const result = selectNextExecutableTask([BASE_CANDIDATE], new Set(), metadata);

      expect(result.task).toBeNull();
      expect(result.reasonCode).toBe("all_blocked_by_dependencies");
      expect(result.reason).toContain("dependencies");
    });

    it("prioritizes urgent tasks over lower-priority ready work", () => {
      const metadata = buildMetadata();
      const completed = new Set([
        "task:inspect-source-tree-model",
        "task:detect-package-manager",
      ]);

      const result = selectNextExecutableTask(
        [
          {
            ...BASE_CANDIDATE,
            id: "task-low",
            title: "Low priority ready task",
            priority: "low",
            planItemId: "task:inspect-source-tree-model",
            createdAt: new Date("2026-06-27T00:00:00.000Z"),
          },
          {
            ...BASE_CANDIDATE,
            id: "task-urgent",
            title: "Urgent ready task",
            priority: "urgent",
            planItemId: "task:expose-summary-ui",
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
          },
        ],
        completed,
        metadata
      );

      expect(result.task?.id).toBe("task-urgent");
    });

    it("selects an in-progress rework task (PR feedback re-loop)", () => {
      const metadata = buildMetadata();
      const completed = new Set(["task:inspect-source-tree-model"]);

      const result = selectNextExecutableTask(
        [
          {
            ...BASE_CANDIDATE,
            status: "in-progress",
            needsRework: true,
          },
        ],
        completed,
        metadata
      );

      expect(result.reasonCode).toBe("selected");
      expect(result.task?.id).toBe("task-1");
    });

    it("selects a planless in-progress rework task created outside planning (MUS-270)", () => {
      const result = selectNextExecutableTask(
        [
          {
            ...BASE_CANDIDATE,
            id: "task-adhoc",
            status: "in-progress",
            planningDraftId: "",
            planningDraftStatus: "draft",
            planItemId: null,
            needsRework: true,
          },
        ],
        new Set(),
        new Map()
      );

      expect(result.reasonCode).toBe("selected");
      expect(result.task?.id).toBe("task-adhoc");
    });

    it("does not select a planless task with no unresolved change requests", () => {
      const result = selectNextExecutableTask(
        [
          {
            ...BASE_CANDIDATE,
            id: "task-adhoc",
            status: "in-progress",
            planningDraftId: "",
            planningDraftStatus: "draft",
            planItemId: null,
            needsRework: false,
          },
        ],
        new Set(),
        new Map()
      );

      expect(result.task).toBeNull();
      expect(result.reasonCode).toBe("no_approved_plans");
    });

    it("returns a clear reason when no approved or applied plan tasks exist", () => {
      const result = selectNextExecutableTask(
        [
          {
            ...BASE_CANDIDATE,
            planningDraftStatus: "draft",
          },
        ],
        new Set(),
        new Map()
      );

      expect(result.task).toBeNull();
      expect(result.reasonCode).toBe("no_approved_plans");
    });
  });
});
