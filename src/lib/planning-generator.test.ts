import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  generateDeterministicPlanningDraft,
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
    description: "Engineering OS Platform",
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
    expect(result.openCeoQuestions).toContain("What outcome should Engineering OS plan for?");
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
