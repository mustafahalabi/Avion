import { describe, expect, it } from "vitest";

import {
  buildGithubWorkflowPhaseStates,
  deriveGithubWorkflowPhase,
} from "./github-workflow-status";

const BASE = {
  taskStatus: "todo",
  sessionStatus: null,
  prStatus: null,
  mergeStatus: null,
  reviewStatus: null,
} as const;

describe("deriveGithubWorkflowPhase", () => {
  it("returns planned when no session exists", () => {
    expect(deriveGithubWorkflowPhase(BASE)).toBe("planned");
  });

  it("returns running when session is prepared", () => {
    expect(
      deriveGithubWorkflowPhase({ ...BASE, sessionStatus: "prepared" })
    ).toBe("running");
  });

  it("returns running when session completed but not yet in review", () => {
    expect(
      deriveGithubWorkflowPhase({ ...BASE, sessionStatus: "completed" })
    ).toBe("running");
  });

  it("returns reviewed when task is in-review", () => {
    expect(
      deriveGithubWorkflowPhase({ ...BASE, taskStatus: "in-review", sessionStatus: "completed" })
    ).toBe("reviewed");
  });

  it("returns reviewed when review is approved", () => {
    expect(
      deriveGithubWorkflowPhase({
        ...BASE,
        reviewStatus: "approved",
        prStatus: "open",
      })
    ).toBe("reviewed");
  });

  it("returns merged when PR is merged", () => {
    expect(
      deriveGithubWorkflowPhase({
        ...BASE,
        taskStatus: "done",
        prStatus: "merged",
        mergeStatus: "merged",
      })
    ).toBe("merged");
  });
});

describe("buildGithubWorkflowPhaseStates", () => {
  it("marks planned as current for a new task", () => {
    const states = buildGithubWorkflowPhaseStates(BASE);
    expect(states.map((s) => s.status)).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(states[0]?.detail).toContain("Ready for implementation");
  });

  it("marks earlier phases complete when merged", () => {
    const states = buildGithubWorkflowPhaseStates({
      ...BASE,
      taskStatus: "done",
      prStatus: "merged",
      mergeStatus: "merged",
    });
    expect(states.map((s) => s.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "current",
    ]);
  });
});
