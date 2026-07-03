import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  classifyTaskKind,
  generateDeterministicPlanningDraft,
  validatePlanningDraftQuality,
  type OutcomePlanningInput,
} from "./planning-generator";

const EMPLOYEES = [
  {
    id: "employee-product-manager",
    name: "Product Manager",
    title: null,
    roleName: "Product Manager",
    responsibilities: "Write requirements and coordinate with engineering on scope.",
  },
  {
    id: "employee-tech-lead",
    name: "Tech Lead",
    title: null,
    roleName: "Tech Lead",
    responsibilities: "Decompose work and resolve technical blockers.",
  },
  {
    id: "employee-backend",
    name: "Backend Engineer",
    title: null,
    roleName: "Backend Engineer",
    responsibilities: "Build server actions, APIs, data models, and integration tests.",
  },
  {
    id: "employee-frontend",
    name: "Frontend Engineer",
    title: null,
    roleName: "Frontend Engineer",
    responsibilities: "Build user interfaces and client-side states.",
  },
  {
    id: "employee-reviewer",
    name: "Reviewer",
    title: null,
    roleName: "Reviewer",
    responsibilities: "Review correctness, safety, and coding standards.",
  },
  {
    id: "employee-qa",
    name: "QA Engineer",
    title: null,
    roleName: "QA Engineer",
    responsibilities: "Write and execute test plans.",
  },
  {
    id: "employee-release",
    name: "Release Manager",
    title: null,
    roleName: "Release Manager",
    responsibilities: "Coordinate release readiness and rollback planning.",
  },
] as const;

const REPOSITORIES = [
  {
    id: "repo-engineering-os",
    name: "engineering-os",
    description: "Avion Platform",
    primaryLanguage: "TypeScript",
    techStack: ["Next.js", "Prisma", "SQLite"],
    frameworks: ["Next.js App Router"],
    dependencies: ["@prisma/client", "zod"],
    importantFiles: ["prisma/schema.prisma", "src/app/actions/runtime.ts"],
    analysisStatus: "analyzed",
    analysisNotes: "Current repository metadata is available.",
    latestChangeSummary: "Overall impact: MEDIUM. 1 impact item(s) identified across: routing.",
    latestChangeImpactLevel: "medium",
    latestChangeAffectedAreas: ["routing"],
    latestChangeRecommendedActions: [
      "QA Engineer should smoke-test all new pages and verify that navigation and access control are working correctly.",
    ],
  },
] as const;

/**
 * Builds a complete planning input for deterministic generator tests.
 *
 * @param overrides - Partial input fields to override for a scenario.
 * @example
 * ```ts
 * const input = buildInput({ title: "Improve onboarding" });
 * ```
 * @returns A company-scoped planning input fixture.
 */
function buildInput(overrides: Partial<OutcomePlanningInput> = {}): OutcomePlanningInput {
  return {
    companyId: "company-a",
    outcomeId: "outcome-a",
    title: "Build Repository Intelligence V2",
    rawRequest: "Build Repository Intelligence V2",
    brief: null,
    businessValue: null,
    successCriteria: [],
    constraints: [],
    employees: EMPLOYEES,
    repositories: REPOSITORIES,
    ...overrides,
  };
}

describe("generateDeterministicPlanningDraft", () => {
  it("generates a planning draft for a valid outcome", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    expect(result.draft.status).toBe("draft");
    expect(result.draft.generatedProjects).toHaveLength(1);
    expect(result.draft.generatedFeatures.length).toBeGreaterThan(0);
    expect(result.draft.generatedTasks.length).toBeGreaterThan(0);
  });

  it("renders company memory into plan assumptions (MUS-258)", () => {
    const result = generateDeterministicPlanningDraft(
      buildInput({
        companyMemory: [
          {
            id: "rec-1",
            category: "standards",
            bankTitle: "Standards",
            content: "All new queries must be company-scoped.",
            source: "learning:abc",
            confidence: 0.9,
            createdAt: new Date("2026-06-30T00:00:00Z"),
          },
        ],
      })
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    expect(
      result.draft.assumptions.some((line) =>
        line.includes("Company memory (standards): All new queries must be company-scoped.")
      )
    ).toBe(true);
  });

  it("keeps assumptions memory-free when no memory exists", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");
    expect(result.draft.assumptions.every((line) => !line.startsWith("Company memory"))).toBe(
      true
    );
  });

  it("creates a useful Repository Intelligence V2 plan", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    const taskTitles = result.draft.generatedTasks.map((task) => task.title);

    expect(result.draft.generatedProjects[0]?.name).toBe("Repository Intelligence V2");
    expect(result.draft.generatedProjects[0]?.milestones.length).toBe(3);
    expect(taskTitles).toContain("Inspect repository source tree model");
    expect(taskTitles).toContain("Detect package manager and workspace strategy");
    expect(taskTitles).toContain("Parse package manifests and dependency groups");
    expect(taskTitles).toContain("Detect framework and routing system");
    expect(taskTitles).toContain("Identify database layer and persistence risks");
    expect(taskTitles).toContain("Generate repository risk report");
    expect(taskTitles).toContain("Expose repository intelligence summary in UI");
    expect(taskTitles).toContain("Add QA coverage for repository analysis");
  });

  it("includes recent repository change context in planning summaries", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    expect(result.draft.summary).toContain("Latest changes: medium impact across routing");
    expect(result.draft.generatedProjects[0]?.description).toContain(
      "Overall impact: MEDIUM"
    );
  });

  it("fails gracefully for an empty outcome", () => {
    const result = generateDeterministicPlanningDraft(
      buildInput({ title: "", rawRequest: "" })
    );

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Expected failure");

    expect(result.reason).toBe("Outcome cannot be empty.");
    expect(result.openCeoQuestions).toContain("What outcome should Avion plan for?");
  });

  it("asks clear CEO questions for an ambiguous outcome", () => {
    const result = generateDeterministicPlanningDraft(
      buildInput({ title: "Make it better", rawRequest: "Make it better" })
    );

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Expected failure");

    expect(result.reason).toContain("ambiguous");
    expect(result.openCeoQuestions.length).toBeGreaterThanOrEqual(3);
  });

  it("does not describe generated work as real created records", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    expect(result.draft.nonScope).toContain(
      "Do not create Project, Feature, Task, Review, QAResult, or Release records until approval."
    );
    expect(result.draft.reviewPlan.approvalGate).toContain("CEO approval");
    expect(result.draft.status).not.toBe("approved");
    expect(result.draft.status).not.toBe("applied");
  });

  it("includes risks, dependencies, review, QA, and release planning", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    expect(result.draft.risks.length).toBeGreaterThan(0);
    expect(result.draft.dependencies.length).toBeGreaterThan(0);
    expect(result.draft.reviewPlan.checkpoints.length).toBeGreaterThan(0);
    expect(result.draft.qaPlan.requiredChecks.length).toBeGreaterThan(0);
    expect(result.draft.releasePlan.readinessCriteria.length).toBeGreaterThan(0);
    expect(result.draft.assumptions.length).toBeGreaterThan(0);
    expect(result.draft.openCeoQuestions.length).toBeGreaterThan(0);
  });

  it("passes execution-ready plan quality validation for Repository Intelligence V2", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    expect(validatePlanningDraftQuality(result.draft)).toEqual([]);
    expect(result.draft.generatorVersion).toBe("deterministic-v2");

    for (const task of result.draft.generatedTasks) {
      expect(task.acceptanceCriteria.length).toBeGreaterThanOrEqual(2);
      expect(task.recommendedRole.length).toBeGreaterThan(0);
      expect(task.requiredContext.length).toBeGreaterThan(3);
      expect(task.definitionOfDone.length).toBeGreaterThan(0);
    }
  });

  it("ships a real implementation task carrying the outcome goal for a general-engineering outcome (MUS-274)", () => {
    const outcome = "Add a public health check endpoint that returns service status as JSON";
    const result = generateDeterministicPlanningDraft(
      buildInput({ title: outcome, rawRequest: outcome })
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    // The default (general-engineering) template must ship a task that builds the
    // change, not only documentation tasks — otherwise an outcome can reach
    // `completed` without the requested change ever existing (MUS-274).
    const implementTask = result.draft.generatedTasks.find(
      (task) => task.planItemId === "task:implement-outcome"
    );
    expect(implementTask).toBeDefined();

    // The goal must live in the acceptanceCriteria, not only the description,
    // because the execution brief renders title + acceptanceCriteria (MUS-277).
    expect(implementTask?.title).toContain(outcome);
    expect(implementTask?.acceptanceCriteria.some((c) => c.includes(outcome))).toBe(true);
    expect(implementTask?.acceptanceCriteria.some((c) => /real product code/i.test(c))).toBe(true);

    // Review must gate on the implementation, not on the design task.
    const reviewTask = result.draft.generatedTasks.find(
      (task) => task.planItemId === "task:create-review-checklist"
    );
    expect(reviewTask?.dependencies).toContain("task:implement-outcome");

    // The added task must keep the plan execution-ready.
    expect(validatePlanningDraftQuality(result.draft)).toEqual([]);
  });

  it("tags only the delivery task as implementation; the planning steps are analysis", () => {
    const outcome = "Add a public health check endpoint that returns service status as JSON";
    const result = generateDeterministicPlanningDraft(
      buildInput({ title: outcome, rawRequest: outcome })
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    // Exactly one task should open a PR: the delivery task. Everything else in the
    // general-engineering plan is a planning/design/QA-planning artifact whose
    // deliverable is the plan itself, so it must not become an executable Task row.
    const kindByPlanItem = new Map(
      result.draft.generatedTasks.map((task) => [task.planItemId, task.kind])
    );
    expect(kindByPlanItem.get("task:implement-outcome")).toBe("implementation");
    for (const planItemId of [
      "task:write-outcome-brief",
      "task:map-code-touchpoints",
      "task:define-data-api-contracts",
      "task:design-user-workflow",
      "task:create-review-checklist",
      "task:create-qa-release-plan",
    ]) {
      expect(kindByPlanItem.get(planItemId)).toBe("analysis");
    }

    const implementationTasks = result.draft.generatedTasks.filter(
      (task) => task.kind === "implementation"
    );
    expect(implementationTasks).toHaveLength(1);
  });

  it("enriches repository intelligence tasks with repository-specific context", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    const packageManagerTask = result.draft.generatedTasks.find(
      (task) => task.planItemId === "task:detect-package-manager"
    );

    expect(packageManagerTask?.description).toContain("engineering-os");
    expect(packageManagerTask?.requiredContext.some((entry) => entry.includes("repository-analyzer.ts"))).toBe(
      true
    );
    expect(
      packageManagerTask?.acceptanceCriteria.some((entry) => entry.includes("npm, pnpm, yarn, and bun"))
    ).toBe(true);
  });

  it("links generated features with stable feature dependency IDs", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    const apiFeature = result.draft.generatedFeatures.find(
      (feature) => feature.planItemId === "feature:api-risk-summary"
    );

    expect(apiFeature?.dependencies).toEqual(["feature:source-model"]);
  });

  it("matches the Repository Intelligence V2 plan shape snapshot", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    const shape = {
      generatorVersion: result.draft.generatorVersion,
      project: {
        name: result.draft.generatedProjects[0]?.name,
        milestoneCount: result.draft.generatedProjects[0]?.milestones.length,
        milestoneTitles: result.draft.generatedProjects[0]?.milestones.map((milestone) => milestone.title),
      },
      featureCount: result.draft.generatedFeatures.length,
      featureTitles: result.draft.generatedTasks.map((task) => task.title),
      taskCount: result.draft.generatedTasks.length,
      assignmentRoles: result.draft.recommendedAssignments.map((assignment) => assignment.role).sort(),
      dependencyIds: result.draft.dependencies.map((dependency) => dependency.id).sort(),
      riskIds: result.draft.risks.map((risk) => risk.id).sort(),
      reviewOwnerRole: result.draft.reviewPlan.ownerRole,
      qaOwnerRole: result.draft.qaPlan.ownerRole,
      releaseOwnerRole: result.draft.releasePlan.ownerRole,
    };

    expect(shape).toMatchInlineSnapshot(`
      {
        "assignmentRoles": [
          "Backend Engineer",
          "Frontend Engineer",
          "QA Engineer",
          "Reviewer",
          "Tech Lead",
        ],
        "dependencyIds": [
          "dependency:ceo-approval",
          "dependency:manifest-fixtures",
          "dependency:repository-metadata-freshness",
        ],
        "featureCount": 3,
        "featureTitles": [
          "Inspect repository source tree model",
          "Detect package manager and workspace strategy",
          "Parse package manifests and dependency groups",
          "Detect framework and routing system",
          "Identify database layer and persistence risks",
          "Summarize API surface and server entry points",
          "Generate repository risk report",
          "Expose repository intelligence summary in UI",
          "Add QA coverage for repository analysis",
        ],
        "generatorVersion": "deterministic-v2",
        "project": {
          "milestoneCount": 3,
          "milestoneTitles": [
            "Repository discovery model complete",
            "Repository intelligence summary complete",
            "Reviewable repository intelligence experience complete",
          ],
          "name": "Repository Intelligence V2",
        },
        "qaOwnerRole": "QA Engineer",
        "releaseOwnerRole": "Release Manager",
        "reviewOwnerRole": "Reviewer",
        "riskIds": [
          "risk:incomplete-context",
          "risk:overconfident-detection",
          "risk:premature-work-creation",
        ],
        "taskCount": 9,
      }
    `);
  });

  it("uses available company roles and employees for recommendations", () => {
    const result = generateDeterministicPlanningDraft(buildInput());

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success");

    const backendTask = result.draft.generatedTasks.find(
      (task) => task.recommendedRole === "Backend Engineer"
    );
    const assignments = result.draft.recommendedAssignments;

    expect(backendTask?.recommendedEmployeeId).toBe("employee-backend");
    expect(assignments.some((assignment) => assignment.employeeId === "employee-qa")).toBe(true);
    expect(assignments.every((assignment) => assignment.role.length > 0)).toBe(true);
  });

  it("produces a stable structure for the same input", () => {
    const first = generateDeterministicPlanningDraft(buildInput());
    const second = generateDeterministicPlanningDraft(buildInput());

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("keeps persistence service company-scoped and avoids real work creation", () => {
    const serviceSource = readFileSync(
      join(process.cwd(), "src/lib/planning-draft-service.ts"),
      "utf8"
    );

    expect(serviceSource).toContain("where: { id: input.outcomeId, companyId: input.companyId }");
    expect(serviceSource).toContain('where: { companyId: input.companyId, status: "active" }');
    expect(serviceSource).toContain("where: { workspace: { companyId: input.companyId } }");
    expect(serviceSource).not.toMatch(/\b(project|feature|task|review|qAResult|release)\.create\(/);
  });

  it("keeps runtime and chat intake imports wired without external AI calls", () => {
    const runtimeSource = readFileSync(join(process.cwd(), "src/app/actions/runtime.ts"), "utf8");
    const chatSource = readFileSync(join(process.cwd(), "src/app/actions/chat.ts"), "utf8");
    const generatorSource = readFileSync(join(process.cwd(), "src/lib/planning-generator.ts"), "utf8");

    expect(runtimeSource).toContain("createOrUpdatePlanningDraftForOutcome");
    expect(chatSource).toContain("createOrUpdatePlanningDraftForOutcome");
    expect(generatorSource).not.toMatch(/Claude|OpenAI|generateText|streamText|fetch\(/i);
  });
});

describe("classifyTaskKind", () => {
  it("classifies non-authoring roles as analysis", () => {
    for (const role of [
      "Reviewer",
      "QA Engineer",
      "Product Manager",
      "Product Analyst",
      "Technical Writer",
    ]) {
      expect(classifyTaskKind(role)).toBe("analysis");
    }
  });

  it("classifies engineer and unknown roles as implementation (never drops real work)", () => {
    for (const role of [
      "Backend Engineer",
      "Frontend Engineer",
      "Mobile Engineer",
      "Tech Lead",
      "Infrastructure Engineer",
      "Some Future Role",
    ]) {
      expect(classifyTaskKind(role)).toBe("implementation");
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(classifyTaskKind("  qa engineer ")).toBe("analysis");
    expect(classifyTaskKind("REVIEWER")).toBe("analysis");
  });
});
