import { describe, expect, it } from "vitest";

import {
  generateDeterministicPlanningDraft,
  type DeterministicPlanningDraft,
} from "@/lib/planning-generator";
import { scorePlanningDraft } from "@/lib/planning/plan-eval";
import { PLANNING_EVAL_CASES } from "@/lib/planning/__fixtures__/planning-eval-cases";

/**
 * Builds a deliberately degenerate draft: it fails quality validation, contains no
 * grounded work, and references an employee id that is not in any roster. Used to prove
 * the scorer actually discriminates between good and bad drafts.
 *
 * @returns A structurally valid but low-quality planning draft.
 */
function buildDegenerateDraft(): DeterministicPlanningDraft {
  return {
    generatorVersion: "degenerate-test",
    title: "Empty plan",
    summary: "",
    status: "draft",
    scope: [],
    nonScope: [],
    assumptions: [],
    risks: [],
    dependencies: [],
    recommendedAssignments: [
      {
        role: "Backend Engineer",
        employeeId: "employee-does-not-exist",
        employeeName: "Ghost Engineer",
        reason: "Hallucinated assignment that is not in the roster.",
        taskPlanItemIds: [],
      },
    ],
    generatedProjects: [],
    generatedFeatures: [],
    generatedTasks: [],
    reviewPlan: {
      ownerRole: "Reviewer",
      requiredReviewers: [],
      checkpoints: [],
      approvalGate: "",
    },
    qaPlan: {
      ownerRole: "QA Engineer",
      strategy: "",
      requiredChecks: [],
      evidenceRequired: [],
    },
    releasePlan: {
      ownerRole: "Release Manager",
      strategy: "",
      readinessCriteria: [],
      rolloutSteps: [],
      rollbackPlan: "",
    },
    openCeoQuestions: [],
    acceptanceCriteria: [],
    estimatedExecutionOrder: [],
  };
}

describe("scorePlanningDraft", () => {
  const repositoryCase = PLANNING_EVAL_CASES.find(
    (evalCase) => evalCase.name === "repository-intelligence"
  );

  it("has the expected repository-intelligence fixture", () => {
    expect(repositoryCase).toBeDefined();
  });

  it("scores a deterministic draft as fully passing every grounding check", () => {
    for (const evalCase of PLANNING_EVAL_CASES) {
      const result = generateDeterministicPlanningDraft(evalCase.input);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("Expected success");

      const scored = scorePlanningDraft(result.draft, evalCase.input, evalCase.expect);

      expect(scored.max).toBeGreaterThan(0);
      expect(scored.score).toBe(scored.max);
      expect(scored.checks.every((check) => check.pass)).toBe(true);
    }
  });

  it("includes the conditional grounding checks only when the case requests them", () => {
    if (repositoryCase === undefined) throw new Error("Missing fixture");

    const result = generateDeterministicPlanningDraft(repositoryCase.input);
    if (result.status !== "success") throw new Error("Expected success");

    const scored = scorePlanningDraft(result.draft, repositoryCase.input, repositoryCase.expect);
    const checkNames = scored.checks.map((check) => check.name);

    expect(checkNames).toContain("passesQuality");
    expect(checkNames).toContain("noHallucinatedEmployees");
    expect(checkNames).toContain("referencesExpectedFramework");
    expect(checkNames).toContain("referencesAnImportantFile");
    expect(checkNames).toContain("meetsMinTasks");
  });

  it("scores a degenerate draft poorly across every applicable check", () => {
    if (repositoryCase === undefined) throw new Error("Missing fixture");

    const scored = scorePlanningDraft(
      buildDegenerateDraft(),
      repositoryCase.input,
      repositoryCase.expect
    );

    expect(scored.score).toBe(0);
    expect(scored.max).toBe(5);
    expect(scored.checks.every((check) => check.pass === false)).toBe(true);
  });
});
