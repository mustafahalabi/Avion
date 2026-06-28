import { describe, expect, it } from "vitest";
import {
  generateRepositoryTaskContext,
  formatRepositoryTaskContext,
  type RepositoryInput,
  type RepositoryTaskContextInput,
} from "./repository-task-context";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPLETE_REPO: RepositoryInput = {
  name: "engineering-os",
  url: "https://github.com/org/engineering-os",
  primaryLanguage: "TypeScript",
  frameworks: ["Next.js"],
  techStack: ["Prisma", "Tailwind CSS"],
  importantFiles: ["prisma/schema.prisma", "src/lib/execution-session-service.ts"],
  analysisStatus: "completed",
};

const BASE_INPUT: RepositoryTaskContextInput = {
  taskId: "MUS-153",
  taskTitle: "Generate repository-safe task context",
  repository: COMPLETE_REPO,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("generateRepositoryTaskContext", () => {
  // ── Missing repository ──────────────────────────────────────────────────────

  describe("missing repository", () => {
    it("returns null repositoryName and repositoryUrl", () => {
      const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
      expect(ctx.repositoryName).toBeNull();
      expect(ctx.repositoryUrl).toBeNull();
      expect(ctx.analysisStatus).toBeNull();
      expect(ctx.hasAnalysis).toBe(false);
    });

    it("emits a warning about missing repository", () => {
      const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
      expect(ctx.warnings.some((w) => /no repository/i.test(w))).toBe(true);
    });

    it("still provides standard validation commands", () => {
      const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
      expect(ctx.validationCommands).toContain("npx tsc --noEmit");
      expect(ctx.validationCommands).toContain("npm run test");
    });

    it("still provides standard constraints", () => {
      const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
      expect(ctx.constraints.length).toBeGreaterThan(0);
    });

    it("derives intendedBranch from taskId and taskTitle", () => {
      const ctx = generateRepositoryTaskContext({
        taskId: "MUS-153",
        taskTitle: "Generate repository-safe task context",
      });
      expect(ctx.intendedBranch).toBe(
        "feature/MUS-153-generate-repository-safe-task-context"
      );
    });

    it("uses default baseBranch of master", () => {
      const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
      expect(ctx.baseBranch).toBe("master");
    });
  });

  // ── Attached repository (analysis completed) ────────────────────────────────

  describe("attached repository with completed analysis", () => {
    it("returns repository name and URL", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.repositoryName).toBe("engineering-os");
      expect(ctx.repositoryUrl).toBe("https://github.com/org/engineering-os");
    });

    it("sets hasAnalysis true and stores analysisStatus", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.hasAnalysis).toBe(true);
      expect(ctx.analysisStatus).toBe("completed");
    });

    it("returns the primary language", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.primaryLanguage).toBe("TypeScript");
    });

    it("merges frameworks and techStack into deduplicated techStack", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.techStack).toContain("Next.js");
      expect(ctx.techStack).toContain("Prisma");
      expect(ctx.techStack).toContain("Tailwind CSS");
    });

    it("deduplicates overlapping frameworks and techStack entries", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: {
          ...COMPLETE_REPO,
          frameworks: ["Next.js", "Prisma"],
          techStack: ["Prisma", "Tailwind CSS"],
        },
      });
      const prismaCount = ctx.techStack.filter((t) => t === "Prisma").length;
      expect(prismaCount).toBe(1);
    });

    it("includes important files in relevantFiles", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.relevantFiles).toContain("prisma/schema.prisma");
      expect(ctx.relevantFiles).toContain("src/lib/execution-session-service.ts");
    });

    it("includes all standard validation commands", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.validationCommands).toContain("npx prisma validate");
      expect(ctx.validationCommands).toContain("npx tsc --noEmit");
      expect(ctx.validationCommands).toContain("npm run lint");
      expect(ctx.validationCommands).toContain("npm run build");
      expect(ctx.validationCommands).toContain("npm run test");
    });

    it("appends repo-specific validation commands not already in the standard list", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: {
          ...COMPLETE_REPO,
          validationCommands: ["npm run e2e", "npm run test"],
        },
      });
      expect(ctx.validationCommands).toContain("npm run e2e");
      const testCount = ctx.validationCommands.filter((c) => c === "npm run test").length;
      expect(testCount).toBe(1);
    });

    it("emits no warnings for a fully populated repository", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.warnings).toHaveLength(0);
    });
  });

  // ── Attached repository with incomplete/missing metadata ────────────────────

  describe("attached repository with incomplete metadata", () => {
    it("warns when analysisStatus is pending", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: { ...COMPLETE_REPO, analysisStatus: "pending" },
      });
      expect(ctx.hasAnalysis).toBe(false);
      expect(ctx.warnings.some((w) => /pending/i.test(w))).toBe(true);
    });

    it("warns when analysisStatus is failed", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: { ...COMPLETE_REPO, analysisStatus: "failed" },
      });
      expect(ctx.warnings.some((w) => /failed/i.test(w))).toBe(true);
    });

    it("warns when url is missing", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: { ...COMPLETE_REPO, url: null },
      });
      expect(ctx.warnings.some((w) => /url/i.test(w))).toBe(true);
    });

    it("warns when primaryLanguage is missing", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: { ...COMPLETE_REPO, primaryLanguage: null },
      });
      expect(ctx.warnings.some((w) => /language/i.test(w))).toBe(true);
    });

    it("returns empty techStack when frameworks and techStack are empty", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: { ...COMPLETE_REPO, frameworks: [], techStack: [] },
      });
      expect(ctx.techStack).toHaveLength(0);
    });

    it("returns empty relevantFiles when importantFiles is empty", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        repository: { ...COMPLETE_REPO, importantFiles: [] },
      });
      expect(ctx.relevantFiles).toHaveLength(0);
    });
  });

  // ── Branch handling ─────────────────────────────────────────────────────────

  describe("branch handling", () => {
    it("uses explicit branchName when provided", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        branchName: "feature/custom-branch",
      });
      expect(ctx.intendedBranch).toBe("feature/custom-branch");
    });

    it("derives intendedBranch when branchName is omitted", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.intendedBranch).toBe(
        "feature/MUS-153-generate-repository-safe-task-context"
      );
    });

    it("uses explicit baseBranch when provided", () => {
      const ctx = generateRepositoryTaskContext({ ...BASE_INPUT, baseBranch: "main" });
      expect(ctx.baseBranch).toBe("main");
    });

    it("defaults baseBranch to master", () => {
      const ctx = generateRepositoryTaskContext(BASE_INPUT);
      expect(ctx.baseBranch).toBe("master");
    });

    it("warns when intendedBranch is a protected branch", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        branchName: "main",
      });
      expect(ctx.warnings.some((w) => /protected/i.test(w))).toBe(true);
    });

    it("warns for release/* as intendedBranch", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        branchName: "release/v1",
      });
      expect(ctx.warnings.some((w) => /protected/i.test(w))).toBe(true);
    });

    it("does not warn for a normal feature branch", () => {
      const ctx = generateRepositoryTaskContext({
        ...BASE_INPUT,
        branchName: "feature/MUS-153-foo",
      });
      expect(ctx.warnings.some((w) => /protected/i.test(w))).toBe(false);
    });
  });
});

// ─── formatRepositoryTaskContext ──────────────────────────────────────────────

describe("formatRepositoryTaskContext", () => {
  it("includes repository name in output", () => {
    const ctx = generateRepositoryTaskContext(BASE_INPUT);
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("engineering-os");
  });

  it("includes the intended branch", () => {
    const ctx = generateRepositoryTaskContext(BASE_INPUT);
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("feature/MUS-153-generate-repository-safe-task-context");
  });

  it("includes base branch", () => {
    const ctx = generateRepositoryTaskContext(BASE_INPUT);
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("master");
  });

  it("includes validation commands", () => {
    const ctx = generateRepositoryTaskContext(BASE_INPUT);
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("npx tsc --noEmit");
    expect(md).toContain("npm run test");
  });

  it("surfaces warnings at the top of the section", () => {
    const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
    const md = formatRepositoryTaskContext(ctx);
    const warningIdx = md.indexOf("⚠️");
    const repoIdx = md.indexOf("Repository:");
    expect(warningIdx).toBeLessThan(repoIdx);
  });

  it("shows no repository placeholder when repo is missing", () => {
    const ctx = generateRepositoryTaskContext({ taskId: "T-1", taskTitle: "Do something" });
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("_(not attached)_");
  });

  it("includes relevant files when present", () => {
    const ctx = generateRepositoryTaskContext(BASE_INPUT);
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("prisma/schema.prisma");
  });

  it("includes constraints section", () => {
    const ctx = generateRepositoryTaskContext(BASE_INPUT);
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("Constraints:");
  });

  it("includes repository intelligence dashboard link when repositoryId is provided", () => {
    const ctx = generateRepositoryTaskContext({
      ...BASE_INPUT,
      repositoryId: "repo-123",
    });
    expect(ctx.intelligenceDashboardUrl).toBe(
      "/work/repositories/repo-123#repository-intelligence"
    );
    const md = formatRepositoryTaskContext(ctx);
    expect(md).toContain("/work/repositories/repo-123#repository-intelligence");
  });
});
