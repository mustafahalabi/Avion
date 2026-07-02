import { describe, expect, it } from "vitest";

import {
  buildPlanningReviewUrl,
  buildPlanningReviewView,
  type PlanningReviewDraftInput,
} from "./planning-review-view";

const BASE_DRAFT: PlanningReviewDraftInput = {
  id: "draft-1",
  outcomeId: "outcome-1",
  title: "Repository Intelligence V2 Plan",
  summary: "Structured delivery plan for repository intelligence.",
  status: "draft",
  version: 1,
  scope: JSON.stringify(["Build repository analyzer", "Expose dashboard"]),
  nonScope: JSON.stringify(["No autonomous execution"]),
  assumptions: JSON.stringify(["Avion repo is available locally"]),
  risks: JSON.stringify([
    {
      id: "risk-1",
      severity: "medium",
      description: "Missing repository access",
      mitigation: "Show unknowns truthfully",
      ownerRole: "Tech Lead",
    },
  ]),
  dependencies: JSON.stringify([]),
  recommendedAssignments: JSON.stringify([
    {
      role: "Backend Engineer",
      employeeId: null,
      employeeName: null,
      reason: "Owns analyzer services",
      taskPlanItemIds: ["task-1"],
    },
  ]),
  generatedProjects: JSON.stringify([
    {
      planItemId: "project-1",
      name: "Repository Intelligence",
      description: "Analyze repositories",
      ownerRole: "Product Manager",
      ownerEmployeeId: null,
      ownerEmployeeName: null,
      milestones: [{ id: "m1", title: "Analyzer", description: "Core analyzer", acceptanceCriteria: [], estimatedOrder: 1 }],
      acceptanceCriteria: [],
      estimatedExecutionOrder: 1,
    },
  ]),
  generatedFeatures: JSON.stringify([
    {
      planItemId: "feature-1",
      projectPlanItemId: "project-1",
      milestoneId: "m1",
      title: "File tree ingestion",
      description: "Ingest repository file tree",
      ownerRole: "Backend Engineer",
      ownerEmployeeId: null,
      ownerEmployeeName: null,
      dependencies: [],
      risks: [],
      acceptanceCriteria: [],
      qaExpectations: [],
      releaseRelevance: "Core capability",
      estimatedExecutionOrder: 1,
    },
  ]),
  generatedTasks: JSON.stringify([
    {
      planItemId: "task-1",
      featurePlanItemId: "feature-1",
      title: "Implement file tree scanner",
      description: "Scan repository directories",
      recommendedRole: "Backend Engineer",
      recommendedEmployeeId: null,
      recommendedEmployeeName: null,
      dependencies: [],
      acceptanceCriteria: ["Captures top-level directories"],
      definitionOfDone: [],
      requiredContext: [],
      reviewRequirements: [],
      qaImpact: "Requires analyzer tests",
      estimatedExecutionOrder: 1,
      estimatePoints: 5,
    },
  ]),
  reviewPlan: JSON.stringify({
    ownerRole: "Reviewer",
    requiredReviewers: ["Tech Lead"],
    checkpoints: ["Architecture review"],
    approvalGate: "CEO approval before apply",
  }),
  qaPlan: JSON.stringify({
    ownerRole: "QA Engineer",
    strategy: "Run project validation suite",
    requiredChecks: ["npm run test"],
    evidenceRequired: ["Test output"],
  }),
  releasePlan: JSON.stringify({
    ownerRole: "Release Manager",
    strategy: "Standard release",
    readinessCriteria: ["All tasks complete"],
    rolloutSteps: ["Deploy to staging"],
    rollbackPlan: "Revert deployment",
  }),
  approvalNotes: null,
  rejectionReason: null,
  generationError: null,
  applicationError: null,
  approvedAt: null,
  rejectedAt: null,
  appliedAt: null,
  createdAt: new Date("2026-06-28T12:00:00.000Z"),
  updatedAt: new Date("2026-06-28T12:00:00.000Z"),
};

describe("buildPlanningReviewUrl", () => {
  it("builds the plan review page URL", () => {
    expect(buildPlanningReviewUrl("draft-1")).toBe("/work/plans/draft-1");
  });
});

describe("buildPlanningReviewView", () => {
  it("parses draft sections and enables review actions for draft status", () => {
    const view = buildPlanningReviewView(BASE_DRAFT);

    expect(view.projects).toHaveLength(1);
    expect(view.features).toHaveLength(1);
    expect(view.tasks).toHaveLength(1);
    expect(view.risks).toHaveLength(1);
    expect(view.reviewPlan?.ownerRole).toBe("Reviewer");
    expect(view.canApprove).toBe(true);
    expect(view.canReject).toBe(true);
    expect(view.canApply).toBe(false);
    expect(view.executionNotStarted).toBe(true);
  });

  it("enables apply for approved drafts", () => {
    const view = buildPlanningReviewView({
      ...BASE_DRAFT,
      status: "approved",
      approvedAt: new Date("2026-06-28T13:00:00.000Z"),
    });

    expect(view.canApprove).toBe(false);
    expect(view.canReject).toBe(false);
    expect(view.canApply).toBe(true);
  });

  it("surfaces rejection and generation errors", () => {
    const view = buildPlanningReviewView({
      ...BASE_DRAFT,
      status: "failed",
      generationError: "Outcome too vague",
      rejectionReason: "Needs clarification",
    });

    expect(view.generationError).toBe("Outcome too vague");
    expect(view.rejectionReason).toBe("Needs clarification");
    expect(view.canApprove).toBe(false);
  });
});
