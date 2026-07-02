import { describe, expect, it } from "vitest";

import {
  buildTaskRepositoryContext,
  pickTaskRepository,
  resolveTaskRepository,
  toBriefRepositoryContext,
  toRepositoryInput,
  type TaskRepositoryRow,
} from "@/lib/task-repository-context";

function makeRow(overrides: Partial<TaskRepositoryRow> = {}): TaskRepositoryRow {
  return {
    id: "repo_1",
    name: "engineering-os",
    url: "https://github.com/org/engineering-os",
    primaryLanguage: "TypeScript",
    frameworks: JSON.stringify(["Next.js"]),
    techStack: JSON.stringify(["Prisma"]),
    importantFiles: JSON.stringify(["prisma/schema.prisma"]),
    analysisStatus: "completed",
    ...overrides,
  };
}

describe("resolveTaskRepository", () => {
  it("returns null for null input", () => {
    expect(resolveTaskRepository(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(resolveTaskRepository(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(resolveTaskRepository([])).toBeNull();
  });

  it("returns the only repository when one exists", () => {
    const row = makeRow();
    expect(resolveTaskRepository([row])).toBe(row);
  });

  it("picks the first repository when several exist", () => {
    const first = makeRow({ id: "repo_1", name: "first" });
    const second = makeRow({ id: "repo_2", name: "second" });
    const third = makeRow({ id: "repo_3", name: "third" });
    expect(resolveTaskRepository([first, second, third])).toBe(first);
  });
});

describe("pickTaskRepository", () => {
  it("prefers the project's explicit repository link over every fallback", () => {
    const linked = makeRow({ id: "linked" });
    const fallback = makeRow({ id: "fallback" });
    const result = pickTaskRepository({
      projectRepository: linked,
      featureProjectRepository: makeRow({ id: "feature-linked" }),
      projectWorkspaceRepositories: [fallback],
      featureProjectWorkspaceRepositories: [fallback],
    });
    expect(result).toBe(linked);
  });

  it("falls back to the feature's project link when the task has no direct project", () => {
    const featureLinked = makeRow({ id: "feature-linked" });
    const result = pickTaskRepository({
      projectRepository: null,
      featureProjectRepository: featureLinked,
      projectWorkspaceRepositories: [makeRow({ id: "ws-fallback" })],
    });
    expect(result).toBe(featureLinked);
  });

  it("falls back to the project workspace's first repo when no explicit link exists", () => {
    const wsRepo = makeRow({ id: "ws-repo" });
    const result = pickTaskRepository({
      projectRepository: null,
      featureProjectRepository: null,
      projectWorkspaceRepositories: [wsRepo],
    });
    expect(result).toBe(wsRepo);
  });

  it("falls back to the feature project workspace as the last resort", () => {
    const featureWsRepo = makeRow({ id: "feature-ws-repo" });
    const result = pickTaskRepository({
      featureProjectWorkspaceRepositories: [featureWsRepo],
    });
    expect(result).toBe(featureWsRepo);
  });

  it("returns null when nothing resolves", () => {
    expect(
      pickTaskRepository({
        projectRepository: null,
        featureProjectRepository: null,
        projectWorkspaceRepositories: [],
        featureProjectWorkspaceRepositories: null,
      })
    ).toBeNull();
  });
});

describe("toBriefRepositoryContext", () => {
  it("maps all fields and parses JSON array columns", () => {
    const ctx = toBriefRepositoryContext(makeRow());
    expect(ctx).toEqual({
      name: "engineering-os",
      url: "https://github.com/org/engineering-os",
      primaryLanguage: "TypeScript",
      frameworks: ["Next.js"],
      techStack: ["Prisma"],
      importantFiles: ["prisma/schema.prisma"],
      analysisStatus: "completed",
    });
  });

  it("normalizes null url and primaryLanguage to null", () => {
    const ctx = toBriefRepositoryContext(makeRow({ url: null, primaryLanguage: null }));
    expect(ctx.url).toBeNull();
    expect(ctx.primaryLanguage).toBeNull();
  });

  it("returns empty arrays for invalid JSON metadata", () => {
    const ctx = toBriefRepositoryContext(
      makeRow({ frameworks: "not json", techStack: "{}", importantFiles: "" })
    );
    expect(ctx.frameworks).toEqual([]);
    expect(ctx.techStack).toEqual([]);
    expect(ctx.importantFiles).toEqual([]);
  });

  it("drops non-string entries and normalizes whitespace in array columns", () => {
    const ctx = toBriefRepositoryContext(
      makeRow({ frameworks: JSON.stringify(["  React   Native ", 42, "Vue"]) })
    );
    expect(ctx.frameworks).toEqual(["React Native", "Vue"]);
  });

  it("preserves the raw analysisStatus string", () => {
    expect(toBriefRepositoryContext(makeRow({ analysisStatus: "pending" })).analysisStatus).toBe(
      "pending"
    );
  });
});

describe("toRepositoryInput", () => {
  it("maps a row into repository task context input", () => {
    expect(toRepositoryInput(makeRow())).toEqual({
      name: "engineering-os",
      url: "https://github.com/org/engineering-os",
      primaryLanguage: "TypeScript",
      frameworks: ["Next.js"],
      techStack: ["Prisma"],
      importantFiles: ["prisma/schema.prisma"],
      analysisStatus: "completed",
    });
  });

  it("coerces missing url/language to null and bad JSON to empty arrays", () => {
    const input = toRepositoryInput(
      makeRow({ url: null, primaryLanguage: null, techStack: "oops" })
    );
    expect(input.url).toBeNull();
    expect(input.primaryLanguage).toBeNull();
    expect(input.techStack).toEqual([]);
  });

  it("produces the same shape as toBriefRepositoryContext for the same row", () => {
    const row = makeRow();
    expect(toRepositoryInput(row)).toEqual(toBriefRepositoryContext(row));
  });
});

describe("buildTaskRepositoryContext", () => {
  it("resolves a full context when a repository is attached", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-153",
      taskTitle: "Generate repository-safe task context",
      repository: makeRow(),
    });

    expect(ctx.repositoryName).toBe("engineering-os");
    expect(ctx.repositoryUrl).toBe("https://github.com/org/engineering-os");
    expect(ctx.primaryLanguage).toBe("TypeScript");
    expect(ctx.techStack).toEqual(["Next.js", "Prisma"]);
    expect(ctx.relevantFiles).toEqual(["prisma/schema.prisma"]);
    expect(ctx.hasAnalysis).toBe(true);
    expect(ctx.analysisStatus).toBe("completed");
  });

  it("derives the implementation branch from task id + title by default", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-153",
      taskTitle: "Generate Repository Safe Task Context",
      repository: makeRow(),
    });
    expect(ctx.intendedBranch).toBe("feature/MUS-153-generate-repository-safe-task-context");
    expect(ctx.baseBranch).toBe("master");
  });

  it("honors explicit branchName and baseBranch overrides", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-153",
      taskTitle: "anything",
      branchName: "feature/custom-branch",
      baseBranch: "develop",
      repository: makeRow(),
    });
    expect(ctx.intendedBranch).toBe("feature/custom-branch");
    expect(ctx.baseBranch).toBe("develop");
  });

  it("links to the repository intelligence dashboard via the repository id", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-153",
      taskTitle: "task",
      repository: makeRow({ id: "repo_42" }),
    });
    expect(ctx.intelligenceDashboardUrl).toContain("repo_42");
  });

  it("emits a 'no repository attached' warning and null repo fields when repository is null", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-153",
      taskTitle: "task",
      repository: null,
    });
    expect(ctx.repositoryName).toBeNull();
    expect(ctx.repositoryUrl).toBeNull();
    expect(ctx.analysisStatus).toBeNull();
    expect(ctx.hasAnalysis).toBe(false);
    expect(ctx.intelligenceDashboardUrl).toBeNull();
    expect(ctx.warnings.some((w) => /No repository is attached/.test(w))).toBe(true);
  });

  it("treats omitted repository the same as null", () => {
    const ctx = buildTaskRepositoryContext({ taskId: "MUS-1", taskTitle: "x" });
    expect(ctx.repositoryName).toBeNull();
    expect(ctx.hasAnalysis).toBe(false);
  });

  it("warns about a protected branch when the override targets one", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-1",
      taskTitle: "x",
      branchName: "main",
      repository: makeRow(),
    });
    expect(ctx.warnings.some((w) => /protected branch/i.test(w))).toBe(true);
  });

  it("warns when analysis is pending and reflects hasAnalysis=false", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-1",
      taskTitle: "x",
      repository: makeRow({ analysisStatus: "pending" }),
    });
    expect(ctx.hasAnalysis).toBe(false);
    expect(ctx.analysisStatus).toBe("pending");
    expect(ctx.warnings.some((w) => /analysis is still pending/i.test(w))).toBe(true);
  });

  it("warns when the repository url and primary language are missing", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-1",
      taskTitle: "x",
      repository: makeRow({ url: null, primaryLanguage: null }),
    });
    expect(ctx.repositoryUrl).toBeNull();
    expect(ctx.primaryLanguage).toBeNull();
    expect(ctx.warnings.some((w) => /Repository URL is not set/.test(w))).toBe(true);
    expect(ctx.warnings.some((w) => /Primary language is not detected/.test(w))).toBe(true);
  });

  it("deduplicates frameworks and tech stack into the combined stack", () => {
    const ctx = buildTaskRepositoryContext({
      taskId: "MUS-1",
      taskTitle: "x",
      repository: makeRow({
        frameworks: JSON.stringify(["Next.js", "Prisma"]),
        techStack: JSON.stringify(["Prisma", "Tailwind"]),
      }),
    });
    expect(ctx.techStack).toEqual(["Next.js", "Prisma", "Tailwind"]);
  });

  it("always includes validation commands even without a repository", () => {
    const ctx = buildTaskRepositoryContext({ taskId: "MUS-1", taskTitle: "x" });
    expect(ctx.validationCommands.length).toBeGreaterThan(0);
  });
});
