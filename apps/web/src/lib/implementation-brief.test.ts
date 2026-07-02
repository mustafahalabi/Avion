import { describe, expect, it } from "vitest";

import {
  deriveBranchName,
  extractPlanningTaskPayload,
  generateClaudeImplementationBrief,
  type BriefRepositoryContext,
  type ImplementationBriefInput,
} from "./implementation-brief";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_GENERATED_TASKS = JSON.stringify([
  {
    planItemId: "task:detect-package-manager",
    featurePlanItemId: "feature:source-model",
    title: "Detect package manager and workspace strategy",
    description: "Detect npm, pnpm, yarn, or bun from lockfiles.",
    recommendedRole: "Backend Engineer",
    recommendedEmployeeId: null,
    recommendedEmployeeName: null,
    dependencies: ["task:inspect-source-tree-model"],
    acceptanceCriteria: [
      "Lockfile precedence is deterministic.",
      "Workspace packages are listed with stable names.",
    ],
    definitionOfDone: [
      "All tests pass.",
      "Validation commands pass.",
    ],
    requiredContext: [
      "Source tree model and manifest detection.",
      "Existing repository analyzer patterns.",
    ],
    reviewRequirements: [
      "Independent reviewer checks correctness and regression risk.",
      "Change requests must be captured before QA.",
    ],
    qaImpact: "Add coverage for each package manager.",
    estimatedExecutionOrder: 2,
    estimatePoints: 2,
  },
]);

const SAMPLE_REPO: BriefRepositoryContext = {
  name: "engineering-os",
  url: "https://github.com/org/engineering-os",
  primaryLanguage: "TypeScript",
  frameworks: ["Next.js"],
  techStack: ["Prisma", "Tailwind CSS"],
  importantFiles: ["prisma/schema.prisma", "src/lib/repository-analyzer.ts"],
  analysisStatus: "completed",
};

const MINIMAL_INPUT: ImplementationBriefInput = {
  taskId: "task_abc123",
  taskTitle: "Detect package manager and dependency graph",
  taskDescription: "Analyze repository manifests to detect package manager.",
  priority: "urgent",
  planningDraftId: "plan_xyz",
  planItemId: "task:detect-package-manager",
  generatedTasksJson: SAMPLE_GENERATED_TASKS,
  repository: SAMPLE_REPO,
  branchName: null,
  baseBranch: "master",
  linearTicketUrl: "https://linear.app/mustafas-space/issue/MUS-999",
};

// ─── deriveBranchName ─────────────────────────────────────────────────────────

describe("deriveBranchName", () => {
  it("creates a feature branch with task ID prefix", () => {
    const name = deriveBranchName("MUS-149", "Generate Claude implementation brief");
    expect(name).toBe("feature/MUS-149-generate-claude-implementation-brief");
  });

  it("truncates long titles to 60 characters in the slug portion", () => {
    const longTitle = "A".repeat(100);
    const name = deriveBranchName("MUS-1", longTitle);
    const slug = name.replace("feature/MUS-1-", "");
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it("removes leading and trailing dashes from the slug", () => {
    const name = deriveBranchName("TASK-1", "  Build the thing  ");
    expect(name).not.toMatch(/feature\/TASK-1--/);
    expect(name).toBe("feature/TASK-1-build-the-thing");
  });

  it("replaces special characters with dashes in the title slug", () => {
    const name = deriveBranchName("T-1", "Add: OAuth2.0 / GitHub flow");
    expect(name).toMatch(/^feature\/T-1-/);
    // The title slug portion should only contain lowercase letters, digits, and dashes
    const slug = name.replace(/^feature\/T-1-/, "");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

// ─── extractPlanningTaskPayload ───────────────────────────────────────────────

describe("extractPlanningTaskPayload", () => {
  it("returns the matching task payload by planItemId", () => {
    const result = extractPlanningTaskPayload(
      SAMPLE_GENERATED_TASKS,
      "task:detect-package-manager"
    );
    expect(result).not.toBeNull();
    expect(result?.planItemId).toBe("task:detect-package-manager");
    expect(result?.acceptanceCriteria).toEqual([
      "Lockfile precedence is deterministic.",
      "Workspace packages are listed with stable names.",
    ]);
  });

  it("returns null when planItemId is not found", () => {
    const result = extractPlanningTaskPayload(SAMPLE_GENERATED_TASKS, "task:missing");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = extractPlanningTaskPayload("not-json", "task:detect-package-manager");
    expect(result).toBeNull();
  });

  it("returns null when generatedTasksJson is null", () => {
    const result = extractPlanningTaskPayload(null, "task:detect-package-manager");
    expect(result).toBeNull();
  });

  it("returns null when planItemId is null", () => {
    const result = extractPlanningTaskPayload(SAMPLE_GENERATED_TASKS, null);
    expect(result).toBeNull();
  });
});

// ─── generateClaudeImplementationBrief ───────────────────────────────────────

describe("generateClaudeImplementationBrief", () => {
  describe("brief structure", () => {
    it("returns a non-empty markdown brief string", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toBeTruthy();
      expect(typeof result.brief).toBe("string");
    });

    it("includes the task title in the brief", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Detect package manager and dependency graph");
    });

    it("includes the priority in the brief", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("URGENT");
    });

    it("includes the Linear ticket URL in the brief", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain(
        "https://linear.app/mustafas-space/issue/MUS-999"
      );
    });

    it("includes acceptance criteria from the planning task", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Lockfile precedence is deterministic.");
      expect(result.brief).toContain("Workspace packages are listed with stable names.");
    });

    it("includes definition of done when present", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("All tests pass.");
    });

    it("includes repository context", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("engineering-os");
      expect(result.brief).toContain("https://github.com/org/engineering-os");
      expect(result.brief).toContain("TypeScript");
      expect(result.brief).toContain("Next.js");
    });

    it("includes important repository files in files to inspect", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("prisma/schema.prisma");
      expect(result.brief).toContain("src/lib/repository-analyzer.ts");
    });

    it("includes required context from planning task", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Source tree model and manifest detection.");
    });

    it("includes all standard validation commands", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("npx prisma validate");
      expect(result.brief).toContain("npx prisma generate");
      expect(result.brief).toContain("npx tsc --noEmit");
      expect(result.brief).toContain("npm run lint");
      expect(result.brief).toContain("npm run build");
      expect(result.brief).toContain("npm run test");
    });

    it("includes Linear update instructions with branch and PR fields", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Linear Ticket Update Instructions");
      expect(result.brief).toContain("Pull Request");
      expect(result.brief).toContain("In Review");
    });

    it("includes review and QA handoff requirements", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Review and QA Handoff");
      expect(result.brief).toContain("review or QA as passed automatically");
    });

    it("includes task-specific review requirements", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain(
        "Independent reviewer checks correctness and regression risk."
      );
    });

    it("renders the live task description as the authoritative objective, even when a plan item exists (MUS-277)", () => {
      // A CEO edit to Task.description after the plan was applied. The plan item
      // (SAMPLE_GENERATED_TASKS) has its own description + acceptance criteria; the
      // live description must still reach the brief instead of being silently dropped.
      const edited =
        "CEO EDIT: build a Stripe webhook that reconciles refunds, not the original manifest scan.";
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        taskDescription: edited,
      });

      expect(result.brief).toContain("## Task Objective");
      expect(result.brief).toContain(edited);
      // And it is marked authoritative over the plan metadata.
      expect(result.brief).toContain("takes precedence over the plan metadata");
    });

    it("omits the objective section when the task has no description", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        taskDescription: null,
      });
      expect(result.brief).not.toContain("## Task Objective");
    });
  });

  describe("company culture (MUS-288)", () => {
    it("adds a culture section that biases the implementation for a known culture", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        cultureProfile: "enterprise",
      });
      expect(result.brief).toContain("## Company Culture");
      expect(result.brief).toContain("Enterprise");
      expect(result.brief.toLowerCase()).toMatch(/valid|security|authoriz/);
    });

    it("produces materially different briefs for different cultures", () => {
      const enterprise = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        cultureProfile: "enterprise",
      }).brief;
      const design = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        cultureProfile: "design-first",
      }).brief;
      expect(enterprise).not.toBe(design);
      expect(design.toLowerCase()).toMatch(/a11y|accessib|ux|design/);
    });

    it("omits the culture section for an unset or unknown culture", () => {
      expect(
        generateClaudeImplementationBrief(MINIMAL_INPUT).brief
      ).not.toContain("## Company Culture");
      expect(
        generateClaudeImplementationBrief({
          ...MINIMAL_INPUT,
          cultureProfile: "not-a-culture",
        }).brief
      ).not.toContain("## Company Culture");
    });
  });

  describe("scope constraints", () => {
    it("forbids unrelated changes", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Do not refactor unrelated code");
    });

    it("forbids fake status updates", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Do not fake passing tests");
    });

    it("scopes the brief to one task only", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("Implement only this ticket");
    });

    it("prohibits placeholder or fake behavior", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("placeholder, stub, or fake behavior");
    });

    it("prohibits modifying protected branches", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("release/v1");
    });
  });

  describe("branch name", () => {
    it("uses the provided branchName when given", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        branchName: "feature/custom-branch",
      });
      expect(result.branchName).toBe("feature/custom-branch");
      expect(result.brief).toContain("feature/custom-branch");
    });

    it("derives a branch name from task ID and title when branchName is null", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.branchName).toContain("task_abc123");
      expect(result.branchName).toContain("detect-package-manager");
    });

    it("includes the base branch in the branch section", () => {
      const result = generateClaudeImplementationBrief(MINIMAL_INPUT);
      expect(result.brief).toContain("master");
    });
  });

  describe("missing repository context", () => {
    it("shows a warning when no repository is attached", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        repository: null,
      });
      expect(result.brief).toContain("No repository is attached");
    });

    it("does not include undefined values for missing repo fields", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        repository: null,
      });
      expect(result.brief).not.toContain("undefined");
    });
  });

  describe("missing planning draft context", () => {
    it("uses task description as fallback acceptance criteria", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        planItemId: null,
        generatedTasksJson: null,
      });
      expect(result.brief).toContain(
        "Analyze repository manifests to detect package manager."
      );
    });

    it("does not include undefined values when planning context is missing", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        planItemId: null,
        generatedTasksJson: null,
      });
      expect(result.brief).not.toContain("undefined");
    });
  });

  describe("company memory section (MUS-258)", () => {
    it("renders company standards & lessons when memory is provided", () => {
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        companyMemory: [
          { category: "standards", content: "Always add ownership guards to new queries." },
          { category: "review", content: "Validate JSON columns before persisting." },
        ],
      });

      expect(result.brief).toContain("## Company Standards & Lessons");
      expect(result.brief).toContain("**[standards]** Always add ownership guards to new queries.");
      expect(result.brief).toContain("**[review]** Validate JSON columns before persisting.");
    });

    it("omits the section entirely without memory", () => {
      expect(generateClaudeImplementationBrief(MINIMAL_INPUT).brief).not.toContain(
        "Company Standards & Lessons"
      );
      expect(
        generateClaudeImplementationBrief({ ...MINIMAL_INPUT, companyMemory: [] }).brief
      ).not.toContain("Company Standards & Lessons");
    });

    it("caps the rendered items at eight (highest-confidence first)", () => {
      const memory = Array.from({ length: 12 }, (_, i) => ({
        category: "learnings",
        content: `Lesson number ${i + 1}.`,
      }));
      const result = generateClaudeImplementationBrief({
        ...MINIMAL_INPUT,
        companyMemory: memory,
      });

      expect(result.brief).toContain("Lesson number 8.");
      expect(result.brief).not.toContain("Lesson number 9.");
    });
  });
});
