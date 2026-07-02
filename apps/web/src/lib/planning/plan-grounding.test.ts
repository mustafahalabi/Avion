import { describe, expect, it } from "vitest";

import type {
  DeterministicPlanningDraft,
  GeneratedPlanningTask,
  OutcomePlanningInput,
} from "@/lib/planning-generator";

import { checkPlanGrounding } from "./plan-grounding";

function baseTask(
  overrides: Partial<GeneratedPlanningTask> = {}
): GeneratedPlanningTask {
  return {
    planItemId: "task:1",
    featurePlanItemId: "feature:1",
    title: "Implement handler",
    description:
      "Implement a verified, idempotent handler with persistence and ownership checks.",
    recommendedRole: "Backend Engineer",
    recommendedEmployeeId: null,
    recommendedEmployeeName: null,
    dependencies: [],
    acceptanceCriteria: ["A.", "B."],
    definitionOfDone: ["Done."],
    requiredContext: ["Source Outcome and PlanningDraft identifiers."],
    reviewRequirements: ["Reviewer checks correctness."],
    qaImpact: "Adds coverage.",
    estimatedExecutionOrder: 1,
    estimatePoints: 3,
    ...overrides,
  };
}

function baseDraft(
  overrides: Partial<DeterministicPlanningDraft> = {}
): DeterministicPlanningDraft {
  return {
    generatorVersion: "ai-claude-v1",
    title: "Draft",
    summary: "Summary.",
    status: "draft",
    scope: ["Scope."],
    nonScope: ["Non-scope."],
    assumptions: ["Assumption."],
    risks: [],
    dependencies: [],
    recommendedAssignments: [],
    generatedProjects: [
      {
        planItemId: "project:1",
        name: "Project",
        description: "Description.",
        ownerRole: "Product Manager",
        ownerEmployeeId: null,
        ownerEmployeeName: null,
        milestones: [],
        acceptanceCriteria: ["Criteria."],
        estimatedExecutionOrder: 1,
      },
    ],
    generatedFeatures: [
      {
        planItemId: "feature:1",
        projectPlanItemId: "project:1",
        milestoneId: "milestone:1",
        title: "Feature",
        description: "Description.",
        ownerRole: "Backend Engineer",
        ownerEmployeeId: null,
        ownerEmployeeName: null,
        dependencies: [],
        risks: [],
        acceptanceCriteria: ["Criteria."],
        qaExpectations: [],
        releaseRelevance: "Relevant.",
        estimatedExecutionOrder: 1,
      },
    ],
    generatedTasks: [baseTask()],
    reviewPlan: {
      ownerRole: "Reviewer",
      requiredReviewers: [],
      checkpoints: ["Checkpoint."],
      approvalGate: "Gate.",
    },
    qaPlan: {
      ownerRole: "QA Engineer",
      strategy: "Strategy.",
      requiredChecks: ["Check."],
      evidenceRequired: [],
    },
    releasePlan: {
      ownerRole: "Release Manager",
      strategy: "Strategy.",
      readinessCriteria: ["Criteria."],
      rolloutSteps: [],
      rollbackPlan: "Rollback.",
    },
    openCeoQuestions: ["Question?"],
    acceptanceCriteria: ["Criteria."],
    estimatedExecutionOrder: ["task:1"],
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<OutcomePlanningInput> = {}
): OutcomePlanningInput {
  return {
    companyId: "company_1",
    outcomeId: "outcome_1",
    title: "Build it",
    rawRequest: "Build it well",
    brief: null,
    businessValue: null,
    successCriteria: [],
    constraints: [],
    employees: [
      {
        id: "emp_1",
        name: "Ada",
        title: null,
        roleName: "Backend Engineer",
        responsibilities: null,
      },
    ],
    repositories: [
      {
        id: "repo_1",
        name: "app",
        description: null,
        primaryLanguage: "TypeScript",
        techStack: [],
        frameworks: ["Next.js"],
        dependencies: [],
        importantFiles: ["src/app/api/webhooks/route.ts"],
        analysisStatus: "analyzed",
        analysisNotes: null,
        latestChangeSummary: null,
        latestChangeImpactLevel: null,
        latestChangeAffectedAreas: [],
        latestChangeRecommendedActions: [],
      },
    ],
    ...overrides,
  };
}

describe("checkPlanGrounding", () => {
  it("reports no issues for a clean, grounded draft", () => {
    const result = checkPlanGrounding(baseDraft(), baseInput());
    expect(result.hardIssues).toEqual([]);
    expect(result.softIssues).toEqual([]);
  });

  it("accepts roster employee ids without complaint", () => {
    const draft = baseDraft({
      generatedTasks: [baseTask({ recommendedEmployeeId: "emp_1" })],
    });
    const result = checkPlanGrounding(draft, baseInput());
    expect(result.hardIssues).toEqual([]);
  });

  it("flags a task assigned to an employee outside the roster as a hard issue", () => {
    const draft = baseDraft({
      generatedTasks: [baseTask({ recommendedEmployeeId: "ghost_99" })],
    });
    const result = checkPlanGrounding(draft, baseInput());
    expect(result.hardIssues).toHaveLength(1);
    expect(result.hardIssues[0]).toContain("ghost_99");
  });

  it("flags invented project and feature owner ids as hard issues", () => {
    const draft = baseDraft();
    const withBadOwners = baseDraft({
      generatedProjects: [
        { ...draft.generatedProjects[0], ownerEmployeeId: "ghost_p" },
      ],
      generatedFeatures: [
        { ...draft.generatedFeatures[0], ownerEmployeeId: "ghost_f" },
      ],
    });
    const result = checkPlanGrounding(withBadOwners, baseInput());
    expect(result.hardIssues).toHaveLength(2);
  });

  it("flags an invented recommendedAssignment employee id as a hard issue", () => {
    const draft = baseDraft({
      recommendedAssignments: [
        {
          role: "Backend Engineer",
          employeeId: "ghost_a",
          employeeName: "Ghost",
          reason: "Reason.",
          taskPlanItemIds: ["task:1"],
        },
      ],
    });
    const result = checkPlanGrounding(draft, baseInput());
    expect(result.hardIssues).toHaveLength(1);
    expect(result.hardIssues[0]).toContain("ghost_a");
  });

  it("flags an ungrounded file reference in requiredContext as a soft issue", () => {
    const draft = baseDraft({
      generatedTasks: [
        baseTask({
          requiredContext: ["Inspect src/lib/totally-made-up.ts before starting."],
        }),
      ],
    });
    const result = checkPlanGrounding(draft, baseInput());
    expect(result.hardIssues).toEqual([]);
    expect(result.softIssues).toHaveLength(1);
    expect(result.softIssues[0]).toContain("src/lib/totally-made-up.ts");
  });

  it("does not flag a grounded file reference in requiredContext", () => {
    const draft = baseDraft({
      generatedTasks: [
        baseTask({
          requiredContext: [
            "Review src/app/api/webhooks/route.ts for the handler.",
          ],
        }),
      ],
    });
    const result = checkPlanGrounding(draft, baseInput());
    expect(result.softIssues).toEqual([]);
  });

  it("skips the soft file check when no importantFiles are available", () => {
    const draft = baseDraft({
      generatedTasks: [
        baseTask({ requiredContext: ["Inspect src/lib/anything.ts now."] }),
      ],
    });
    const result = checkPlanGrounding(draft, baseInput({ repositories: [] }));
    expect(result.softIssues).toEqual([]);
  });
});
