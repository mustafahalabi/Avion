import { describe, expect, it } from "vitest";

import {
  buildLifecycleBoard,
  buildWorkItemView,
  deriveWorkStage,
  isAwaitingApproval,
  isWorkItemBlocked,
  isWorkItemLive,
  WORK_LIFECYCLE_STAGES,
  type WorkItemInput,
} from "./work-lifecycle";

const TASK_BASE: WorkItemInput = {
  id: "t1",
  title: "Login screen",
  kind: "task",
  href: "/work/tasks/t1",
  updatedAt: new Date("2026-06-30T12:00:00Z"),
};

const task = (over: Partial<WorkItemInput>): WorkItemInput => ({
  ...TASK_BASE,
  ...over,
});

const plan = (over: Partial<WorkItemInput> = {}): WorkItemInput => ({
  id: "p1",
  title: "Plan: auth",
  kind: "plan",
  href: "/work/outcomes/o1",
  updatedAt: new Date("2026-06-30T12:00:00Z"),
  planStatus: "reviewing",
  ...over,
});

describe("deriveWorkStage", () => {
  it("buckets plan items into planning", () => {
    expect(deriveWorkStage(plan())).toBe("planning");
  });

  it("buckets a fresh todo task into queued", () => {
    expect(deriveWorkStage(task({ taskStatus: "todo" }))).toBe("queued");
  });

  it("buckets a queued/prepared session into queued", () => {
    expect(
      deriveWorkStage(task({ taskStatus: "todo", sessionStatus: "prepared" }))
    ).toBe("queued");
  });

  it("buckets a running session into building", () => {
    expect(
      deriveWorkStage(
        task({ taskStatus: "in-progress", sessionStatus: "running" })
      )
    ).toBe("building");
  });

  it("keeps a completed session that has no PR yet in building", () => {
    expect(
      deriveWorkStage(
        task({ taskStatus: "in-progress", sessionStatus: "completed" })
      )
    ).toBe("building");
  });

  it("buckets an open PR / in-review task into review", () => {
    expect(
      deriveWorkStage(task({ taskStatus: "in-review", prStatus: "open" }))
    ).toBe("review");
  });

  it("buckets changes_requested into review (not back to building)", () => {
    expect(
      deriveWorkStage(
        task({ taskStatus: "in-progress", reviewStatus: "changes_requested" })
      )
    ).toBe("review");
  });

  it("advances an approved review into qa", () => {
    expect(
      deriveWorkStage(
        task({ taskStatus: "in-review", reviewStatus: "approved" })
      )
    ).toBe("qa");
  });

  it("buckets a recorded QA result into qa", () => {
    expect(deriveWorkStage(task({ qaStatus: "failed" }))).toBe("qa");
  });

  it("buckets a done task into done", () => {
    expect(deriveWorkStage(task({ taskStatus: "done" }))).toBe("done");
  });

  it("buckets a merged PR into done even mid-status", () => {
    expect(
      deriveWorkStage(
        task({ taskStatus: "in-review", prStatus: "merged", mergeStatus: "merged" })
      )
    ).toBe("done");
  });
});

describe("isWorkItemLive", () => {
  it("is live while the agent is running", () => {
    expect(isWorkItemLive(task({ sessionStatus: "running" }))).toBe(true);
  });
  it("is live while wrapping up a completed run", () => {
    expect(isWorkItemLive(task({ sessionStatus: "completed" }))).toBe(true);
  });
  it("is not live for a queued task", () => {
    expect(isWorkItemLive(task({ taskStatus: "todo" }))).toBe(false);
  });
  it("is not live for a plan awaiting approval", () => {
    expect(isWorkItemLive(plan())).toBe(false);
  });
  it("is live for a plan actively generating", () => {
    expect(isWorkItemLive(plan({ planStatus: "generating" }))).toBe(true);
  });
});

describe("isWorkItemBlocked", () => {
  it("flags failed sessions", () => {
    expect(isWorkItemBlocked(task({ sessionStatus: "failed" }))).toBe(true);
  });
  it("flags needs_clarification", () => {
    expect(isWorkItemBlocked(task({ sessionStatus: "needs_clarification" }))).toBe(
      true
    );
  });
  it("flags changes requested", () => {
    expect(isWorkItemBlocked(task({ reviewStatus: "changes_requested" }))).toBe(
      true
    );
  });
  it("flags failed QA", () => {
    expect(isWorkItemBlocked(task({ qaStatus: "failed" }))).toBe(true);
  });
  it("does not flag a healthy running task", () => {
    expect(isWorkItemBlocked(task({ sessionStatus: "running" }))).toBe(false);
  });
});

describe("isAwaitingApproval", () => {
  it("flags a draft plan as awaiting approval", () => {
    expect(isAwaitingApproval(plan({ planStatus: "draft" }), "planning")).toBe(
      true
    );
  });
  it("flags an in-review task as awaiting CEO review", () => {
    expect(
      isAwaitingApproval(task({ taskStatus: "in-review" }), "review")
    ).toBe(true);
  });
  it("does not flag a generating plan", () => {
    expect(
      isAwaitingApproval(plan({ planStatus: "generating" }), "planning")
    ).toBe(false);
  });
});

describe("buildWorkItemView statusLine", () => {
  it("mentions the branch and file count while building", () => {
    const view = buildWorkItemView(
      task({
        taskStatus: "in-progress",
        sessionStatus: "running",
        branchName: "feat/login",
        filesChangedCount: 3,
      })
    );
    expect(view.statusLine).toContain("feat/login");
    expect(view.statusLine).toContain("3 files");
    expect(view.isLive).toBe(true);
  });

  it("mentions the PR number in review", () => {
    const view = buildWorkItemView(
      task({ taskStatus: "in-review", prStatus: "open", prNumber: 12 })
    );
    expect(view.statusLine).toContain("PR #12");
    expect(view.stage).toBe("review");
  });

  it("reports QA check counts when passed", () => {
    const view = buildWorkItemView(
      task({
        reviewStatus: "approved",
        qaStatus: "passed",
        qaPassedCount: 5,
        qaFailedCount: 1,
      })
    );
    expect(view.stage).toBe("qa");
    expect(view.statusLine).toContain("5/6 checks");
  });

  it("reports a merged delivery in done", () => {
    const view = buildWorkItemView(
      task({ taskStatus: "done", prStatus: "merged", prNumber: 7 })
    );
    expect(view.stage).toBe("done");
    expect(view.statusLine).toContain("PR #7");
  });

  it("surfaces a re-loop on changes requested", () => {
    const view = buildWorkItemView(
      task({ taskStatus: "in-progress", reviewStatus: "changes_requested" })
    );
    expect(view.isBlocked).toBe(true);
    expect(view.statusLine.toLowerCase()).toContain("changes requested");
  });
});

describe("buildLifecycleBoard", () => {
  it("returns all six ordered stages", () => {
    const board = buildLifecycleBoard([]);
    expect(board.columns.map((c) => c.stage)).toEqual([
      ...WORK_LIFECYCLE_STAGES,
    ]);
    expect(board.totalCount).toBe(0);
    expect(board.activeCount).toBe(0);
  });

  it("groups items into the correct columns and counts in-flight work", () => {
    const board = buildLifecycleBoard([
      plan(),
      task({ id: "a", taskStatus: "todo" }),
      task({ id: "b", taskStatus: "in-progress", sessionStatus: "running" }),
      task({ id: "c", taskStatus: "in-review", prStatus: "open" }),
      task({ id: "d", reviewStatus: "approved" }),
      task({ id: "e", taskStatus: "done", prStatus: "merged" }),
    ]);

    expect(board.stageCounts).toEqual({
      planning: 1,
      queued: 1,
      building: 1,
      review: 1,
      qa: 1,
      done: 1,
    });
    // queued + building + review + qa
    expect(board.activeCount).toBe(4);
    expect(board.liveCount).toBe(1);
    // the draft plan + the in-review task both want the CEO
    expect(board.needsAttentionCount).toBe(2);
    expect(board.totalCount).toBe(6);
  });

  it("orders live items to the top of their column", () => {
    const older = new Date("2026-06-30T10:00:00Z");
    const newer = new Date("2026-06-30T11:00:00Z");
    const board = buildLifecycleBoard([
      task({
        id: "live",
        taskStatus: "in-progress",
        sessionStatus: "running",
        updatedAt: older,
      }),
      task({ id: "idle", taskStatus: "in-progress", updatedAt: newer }),
    ]);
    const building = board.columns.find((c) => c.stage === "building")!;
    // "idle" here is also live (taskStatus in-progress), so tie-breaks on recency.
    expect(building.items[0]?.id).toBe("idle");
  });

  it("caps the done column but keeps the true total", () => {
    const dones = Array.from({ length: 12 }, (_, i) =>
      task({ id: `d${i}`, taskStatus: "done", prStatus: "merged" })
    );
    const board = buildLifecycleBoard(dones, { doneLimit: 5 });
    const done = board.columns.find((c) => c.stage === "done")!;
    expect(done.items.length).toBe(5);
    expect(done.total).toBe(12);
    expect(board.stageCounts.done).toBe(12);
  });
});
