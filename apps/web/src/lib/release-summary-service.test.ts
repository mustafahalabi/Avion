import { describe, expect, it } from "vitest";
import {
  buildCeoReleaseSummary,
  type CeoReleaseSummaryInput,
} from "./release-summary-service";

const sampleInput: CeoReleaseSummaryInput = {
  version: "v2.0.0-rc1",
  title: "Platform v2 RC1",
  status: "ready",
  deploymentStatus: "not_started",
  outcomeId: "outcome-abc",
  checklist: [
    { label: "All tests passing", checked: true },
    { label: "Code review approved", checked: true },
    { label: "QA validation passed", checked: true },
    { label: "Rollback plan documented", checked: false },
  ],
  tasks: [
    {
      taskId: "task-1",
      title: "Add release candidate flow",
      status: "done",
      reviewStatus: "approved",
      reviewNotes: "LGTM.",
      qaStatus: "passed",
      qaPassedCount: 2,
      qaFailedCount: 0,
      qaCheckLabels: ["AC met: user can create candidate", "Validation passes: npm run test"],
      branchName: "feature/MUS-169",
      prUrl: "https://github.com/org/repo/pull/28",
      validationSummary: "478 tests passed",
      openChangeRequests: [],
    },
    {
      taskId: "task-2",
      title: "Fix login redirect",
      status: "done",
      reviewStatus: "approved",
      reviewNotes: null,
      qaStatus: "passed",
      qaPassedCount: 1,
      qaFailedCount: 0,
      qaCheckLabels: ["Regression check passed"],
      branchName: null,
      prUrl: null,
      validationSummary: null,
      openChangeRequests: ["Mobile layout broken on iOS"],
    },
  ],
  additionalRisks: ["Staging deploy not yet verified."],
  additionalFollowUps: ["Schedule CEO sign-off."],
};

describe("release-summary-service", () => {
  describe("buildCeoReleaseSummary", () => {
    it("includes completed work with task titles and PR links", () => {
      const { markdown } = buildCeoReleaseSummary(sampleInput);
      expect(markdown).toContain("Add release candidate flow");
      expect(markdown).toContain("https://github.com/org/repo/pull/28");
      expect(markdown).toContain("Fix login redirect");
    });

    it("lists checks performed from checklist and QA records", () => {
      const { markdown } = buildCeoReleaseSummary(sampleInput);
      expect(markdown).toContain("[x] All tests passing");
      expect(markdown).toContain("[ ] Rollback plan documented");
      expect(markdown).toContain("QA Checklist Items Verified");
      expect(markdown).toContain("AC met: user can create candidate");
    });

    it("includes validation evidence from session records", () => {
      const { markdown } = buildCeoReleaseSummary(sampleInput);
      expect(markdown).toContain("478 tests passed");
    });

    it("lists risks including missing PR and additional risks", () => {
      const { markdown } = buildCeoReleaseSummary(sampleInput);
      expect(markdown).toContain("Staging deploy not yet verified");
      expect(markdown).toContain('no PR URL on record');
    });

    it("lists follow-up items from change requests and unchecked checklist", () => {
      const { markdown } = buildCeoReleaseSummary(sampleInput);
      expect(markdown).toContain("Mobile layout broken on iOS");
      expect(markdown).toContain("Rollback plan documented");
      expect(markdown).toContain("Schedule CEO sign-off");
    });

    it("marks hasData true when tasks or checks exist", () => {
      const result = buildCeoReleaseSummary(sampleInput);
      expect(result.hasData).toBe(true);
    });

    it("handles empty task list gracefully", () => {
      const { markdown, hasData } = buildCeoReleaseSummary({
        ...sampleInput,
        tasks: [],
        additionalRisks: [],
        additionalFollowUps: [],
      });
      expect(markdown).toContain("No tasks linked");
      expect(hasData).toBe(true);
    });
  });
});
