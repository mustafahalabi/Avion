import { describe, it, expect } from "vitest";
import {
  analyzeRepositoryImpact,
  type ImpactAnalysisResult,
  type ImpactAnalysisError,
} from "./repository-impact-analysis";
import type {
  SnapshotComparisonResult,
  SnapshotComparisonError,
} from "./repository-snapshot-comparison";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_AT = "2026-06-28T00:00:00.000Z";

function makeComparisonResult(
  overrides: Partial<SnapshotComparisonResult> = {},
): SnapshotComparisonResult {
  return {
    oldSnapshotId: "snap-old",
    newSnapshotId: "snap-new",
    repositoryId: "repo-1",
    comparedAt: FIXED_AT,
    hasChanges: false,
    changeCounts: {
      addedImportantFiles: 0,
      removedImportantFiles: 0,
      addedRoutes: 0,
      removedRoutes: 0,
      changedRoutes: 0,
      addedApiRoutes: 0,
      removedApiRoutes: 0,
      addedServerActions: 0,
      removedServerActions: 0,
      addedPrismaModels: 0,
      removedPrismaModels: 0,
      addedDependencies: 0,
      removedDependencies: 0,
      addedDevDependencies: 0,
      removedDevDependencies: 0,
      addedScripts: 0,
      removedScripts: 0,
      changedScripts: 0,
      addedTestFiles: 0,
      removedTestFiles: 0,
      newRisks: 0,
      resolvedRisks: 0,
    },
    fileSummary: {
      totalFilesOld: 10,
      totalFilesNew: 10,
      totalFilesDelta: 0,
      totalDirsOld: 3,
      totalDirsNew: 3,
      categoryChanges: {},
    },
    addedFiles: [],
    removedFiles: [],
    changedFiles: [],
    routeChanges: { added: [], removed: [], changed: [] },
    apiRouteChanges: { added: [], removed: [] },
    serverActionChanges: { added: [], removed: [] },
    prismaModelChanges: { added: [], removed: [] },
    dependencyChanges: { added: [], removed: [], addedDev: [], removedDev: [] },
    scriptChanges: { added: [], removed: [], changed: [] },
    testChanges: { added: [], removed: [], oldCount: 2, newCount: 2 },
    riskChanges: { new: [], resolved: [] },
    affectedAreas: [],
    evidence: [],
    summary: "No structural changes detected between the two snapshots.",
    limitations: [
      "Dependency version changes are not detectable.",
      "File content changes are not detectable.",
    ],
    ...overrides,
  };
}

function makeComparisonError(
  overrides: Partial<SnapshotComparisonError> = {},
): SnapshotComparisonError {
  return {
    error: true,
    reason: "Old snapshot has failed status: Clone failed.",
    oldSnapshotId: "snap-old",
    newSnapshotId: "snap-new",
    repositoryId: "repo-1",
    comparedAt: FIXED_AT,
    ...overrides,
  };
}

function isResult(outcome: unknown): outcome is ImpactAnalysisResult {
  return typeof outcome === "object" && outcome !== null && !("error" in outcome);
}

function isError(outcome: unknown): outcome is ImpactAnalysisError {
  return (
    typeof outcome === "object" &&
    outcome !== null &&
    (outcome as { error?: unknown }).error === true
  );
}

// ─── Test 1: No-change comparison ────────────────────────────────────────────

describe("analyzeRepositoryImpact — no-change comparison", () => {
  it("returns overallImpactLevel none when hasChanges is false", () => {
    const result = analyzeRepositoryImpact(makeComparisonResult(), FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("none");
  });

  it("returns empty impactItems, affectedRoles, and evidence when no changes", () => {
    const result = analyzeRepositoryImpact(makeComparisonResult(), FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.impactItems).toEqual([]);
    expect(result.affectedRoles).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.blockingConcerns).toEqual([]);
    expect(result.recommendedActions).toEqual([]);
  });

  it("summary states no functional impact when no changes", () => {
    const result = analyzeRepositoryImpact(makeComparisonResult(), FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.summary).toContain("No functional impact");
  });
});

// ─── Test 2: Prisma model changes ────────────────────────────────────────────

describe("analyzeRepositoryImpact — Prisma model changes", () => {
  it("added Prisma model creates high database impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Comment"], removed: [] },
      affectedAreas: ["prismaModels"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const dbItem = result.impactItems.find((i) => i.area === "database");
    expect(dbItem).toBeDefined();
    expect(dbItem?.impactLevel).toBe("high");
    expect(dbItem?.evidence).toContain("Prisma model added: Comment");
    expect(dbItem?.affectedRoles).toContain("Backend Engineer");
    expect(dbItem?.affectedRoles).toContain("QA Engineer");
  });

  it("removed Prisma model creates critical database impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: [], removed: ["LegacyTable"] },
      affectedAreas: ["prismaModels"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const dbItem = result.impactItems.find(
      (i) => i.area === "database" && i.impactLevel === "critical",
    );
    expect(dbItem).toBeDefined();
    expect(dbItem?.evidence).toContain("Prisma model removed: LegacyTable");
    expect(dbItem?.affectedRoles).toContain("CTO");
    expect(dbItem?.affectedRoles).toContain("Release Manager");
  });

  it("removed Prisma model elevates overall impact to critical", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: [], removed: ["OldModel"] },
      affectedAreas: ["prismaModels"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("critical");
  });
});

// ─── Test 3: API route changes ────────────────────────────────────────────────

describe("analyzeRepositoryImpact — API route changes", () => {
  it("added non-auth API route creates high api impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/users/route.ts"], removed: [] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const apiItem = result.impactItems.find((i) => i.area === "api");
    expect(apiItem).toBeDefined();
    expect(apiItem?.impactLevel).toBe("high");
    expect(apiItem?.evidence).toContain("API route added: src/app/api/users/route.ts");
  });

  it("removed API route creates high api impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: [], removed: ["src/app/api/deprecated/route.ts"] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const apiItem = result.impactItems.find(
      (i) => i.area === "api" && i.title.includes("removed"),
    );
    expect(apiItem).toBeDefined();
    expect(apiItem?.impactLevel).toBe("high");
    expect(apiItem?.affectedRoles).toContain("Release Manager");
  });

  it("API route change includes QA Engineer in affected roles", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/posts/route.ts"], removed: [] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.affectedRoles).toContain("QA Engineer");
  });
});

// ─── Test 4: Server action changes ───────────────────────────────────────────

describe("analyzeRepositoryImpact — server action changes", () => {
  it("added non-auth server action creates high serverActions impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      serverActionChanges: { added: ["src/app/actions/post.ts"], removed: [] },
      affectedAreas: ["serverActions"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.area === "serverActions");
    expect(item).toBeDefined();
    expect(item?.impactLevel).toBe("high");
    expect(item?.evidence).toContain("Server action added: src/app/actions/post.ts");
  });

  it("removed server action creates high serverActions impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      serverActionChanges: { added: [], removed: ["src/app/actions/legacy.ts"] },
      affectedAreas: ["serverActions"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find(
      (i) => i.area === "serverActions" && i.title.includes("removed"),
    );
    expect(item).toBeDefined();
    expect(item?.impactLevel).toBe("high");
  });

  it("auth-related server action creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      serverActionChanges: {
        added: ["src/app/actions/auth/login.ts"],
        removed: [],
      },
      affectedAreas: ["serverActions"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const authItem = result.impactItems.find((i) => i.area === "auth");
    expect(authItem).toBeDefined();
    expect(authItem?.impactLevel).toBe("critical");
    expect(authItem?.affectedRoles).toContain("Security Engineer");
  });
});

// ─── Test 5: Auth-related paths create critical/security impact ───────────────

describe("analyzeRepositoryImpact — auth paths create critical impact", () => {
  it("auth API route addition creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/auth/signin/route.ts"], removed: [] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const authItem = result.impactItems.find((i) => i.area === "auth");
    expect(authItem?.impactLevel).toBe("critical");
    expect(authItem?.affectedRoles).toContain("Security Engineer");
    expect(authItem?.affectedRoles).toContain("CTO");
  });

  it("admin route change creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      routeChanges: {
        added: [{ path: "src/app/(admin)/admin/users/page.tsx", type: "page", evidence: "App Router page" }],
        removed: [],
        changed: [],
      },
      affectedAreas: ["routes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const authItem = result.impactItems.find((i) => i.area === "auth");
    expect(authItem?.impactLevel).toBe("critical");
  });

  it("middleware.ts added as important file creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      addedFiles: ["middleware.ts"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const authItem = result.impactItems.find((i) => i.area === "auth");
    expect(authItem?.impactLevel).toBe("critical");
    expect(authItem?.evidence).toContain("Auth/config file added: middleware.ts");
  });

  it("auth-related dependency addition creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      dependencyChanges: { added: ["next-auth"], removed: [], addedDev: [], removedDev: [] },
      affectedAreas: ["dependencies"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const authItem = result.impactItems.find((i) => i.area === "auth");
    expect(authItem?.impactLevel).toBe("critical");
    expect(authItem?.affectedRoles).toContain("Security Engineer");
  });

  it("overall impact is critical when any auth item exists", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/auth/callback/route.ts"], removed: [] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("critical");
  });

  it("hyphenated sign-in route creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      routeChanges: {
        added: [
          {
            path: "src/app/sign-in/page.tsx",
            type: "page",
            evidence: "App Router page",
          },
        ],
        removed: [],
        changed: [],
      },
      affectedAreas: ["routes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    const authItem = result.impactItems.find((i) => i.area === "auth");
    expect(authItem?.impactLevel).toBe("critical");
    expect(authItem?.evidence).toContain("Auth/admin route added: src/app/sign-in/page.tsx (page)");
  });

  it("hyphenated sign-up route creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      routeChanges: {
        added: [
          {
            path: "src/app/sign-up/page.tsx",
            type: "page",
            evidence: "App Router page",
          },
        ],
        removed: [],
        changed: [],
      },
      affectedAreas: ["routes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.impactItems.find((i) => i.area === "auth")?.impactLevel).toBe("critical");
  });

  it("actual Clerk sign-in catch-all route creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      routeChanges: {
        added: [
          {
            path: "src/app/sign-in/[[...sign-in]]/page.tsx",
            type: "page",
            evidence: "App Router page",
          },
        ],
        removed: [],
        changed: [],
      },
      affectedAreas: ["routes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("critical");
    expect(result.evidence).toContain(
      "Auth/admin route added: src/app/sign-in/[[...sign-in]]/page.tsx (page)",
    );
  });

  it("actual Clerk sign-up catch-all route creates critical auth impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      routeChanges: {
        added: [
          {
            path: "src/app/sign-up/[[...sign-up]]/page.tsx",
            type: "page",
            evidence: "App Router page",
          },
        ],
        removed: [],
        changed: [],
      },
      affectedAreas: ["routes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("critical");
    expect(result.evidence).toContain(
      "Auth/admin route added: src/app/sign-up/[[...sign-up]]/page.tsx (page)",
    );
  });

  it("critical items appear in blockingConcerns", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/auth/login/route.ts"], removed: [] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.blockingConcerns.length).toBeGreaterThan(0);
  });
});

// ─── Test 6: Dependency additions ────────────────────────────────────────────

describe("analyzeRepositoryImpact — dependency additions", () => {
  it("added production dependency creates medium impact with security review recommendation", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      dependencyChanges: { added: ["zod"], removed: [], addedDev: [], removedDev: [] },
      affectedAreas: ["dependencies"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const depItem = result.impactItems.find((i) => i.area === "dependencies");
    expect(depItem?.impactLevel).toBe("medium");
    expect(depItem?.affectedRoles).toContain("Security Engineer");
    expect(depItem?.evidence).toContain("Dependency added: zod");
  });

  it("added dev dependency creates low impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      dependencyChanges: { added: [], removed: [], addedDev: ["eslint"], removedDev: [] },
      affectedAreas: ["dependencies"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const devDepItem = result.impactItems.find(
      (i) => i.area === "dependencies" && i.title.includes("Dev dependency added"),
    );
    expect(devDepItem?.impactLevel).toBe("low");
  });

  it("recommended action for dependency addition cites the package name as evidence", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      dependencyChanges: { added: ["axios"], removed: [], addedDev: [], removedDev: [] },
      affectedAreas: ["dependencies"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const action = result.recommendedActions.find((a) => a.evidence.some((e) => e.includes("axios")));
    expect(action).toBeDefined();
    expect(action?.evidence.some((e) => e.includes("Dependency added: axios"))).toBe(true);
  });
});

// ─── Test 7: Test file removals ───────────────────────────────────────────────

describe("analyzeRepositoryImpact — test removals create QA concern", () => {
  it("removed test file creates high tests impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      testChanges: {
        added: [],
        removed: ["src/lib/user.test.ts"],
        oldCount: 3,
        newCount: 2,
      },
      affectedAreas: ["tests"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const testItem = result.impactItems.find(
      (i) => i.area === "tests" && i.title.includes("removed"),
    );
    expect(testItem?.impactLevel).toBe("high");
    expect(testItem?.affectedRoles).toContain("QA Engineer");
    expect(testItem?.affectedRoles).toContain("Engineering Manager");
    expect(testItem?.evidence).toContain("Test file removed: src/lib/user.test.ts");
  });

  it("test file removal appears in QA focus areas", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      testChanges: { added: [], removed: ["src/lib/foo.test.ts"], oldCount: 2, newCount: 1 },
      affectedAreas: ["tests"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.qaFocusAreas).toContain("tests");
  });

  it("added test file creates low impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      testChanges: { added: ["src/lib/new.test.ts"], removed: [], oldCount: 1, newCount: 2 },
      affectedAreas: ["tests"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const testItem = result.impactItems.find(
      (i) => i.area === "tests" && i.title.includes("added"),
    );
    expect(testItem?.impactLevel).toBe("low");
  });
});

// ─── Test 8: Build script changes ────────────────────────────────────────────

describe("analyzeRepositoryImpact — build script changes", () => {
  it("changed build script creates high build impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      scriptChanges: {
        added: [],
        removed: [],
        changed: [{ name: "build", oldValue: "next build", newValue: "next build --debug" }],
      },
      affectedAreas: ["scripts"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const buildItem = result.impactItems.find(
      (i) => i.area === "build" && i.title.includes("Build/dev script changed"),
    );
    expect(buildItem?.impactLevel).toBe("high");
    expect(buildItem?.affectedRoles).toContain("DevOps");
    expect(buildItem?.affectedRoles).toContain("Release Manager");
  });

  it("removed CI script creates high build impact item", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      scriptChanges: {
        added: [],
        removed: [{ name: "test", value: "vitest run" }],
        changed: [],
      },
      affectedAreas: ["scripts"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const buildItem = result.impactItems.find(
      (i) => i.area === "build" && i.title.includes("removed"),
    );
    expect(buildItem?.impactLevel).toBe("high");
    expect(buildItem?.evidence.some((e) => e.includes("test"))).toBe(true);
  });

  it("build script change appears in release risks", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      scriptChanges: {
        added: [],
        removed: [],
        changed: [{ name: "build", oldValue: "next build", newValue: "turbo build" }],
      },
      affectedAreas: ["scripts"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.releaseRisks.length).toBeGreaterThan(0);
    expect(result.releaseRisks.some((r) => r.includes("Build/dev script"))).toBe(true);
  });
});

// ─── Test 8b: Important file changes always produce impact ───────────────────

describe("analyzeRepositoryImpact — important file changes", () => {
  it("next.config.ts change creates high build impact with release risk", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: ["next.config.ts"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.title === "Next.js configuration file changed");
    expect(item?.impactLevel).toBe("high");
    expect(item?.evidence).toContain("Next.js config changed: next.config.ts");
    expect(result.releaseRisks.some((risk) => risk.includes("Next.js configuration"))).toBe(true);
    expect(result.overallImpactLevel).toBe("high");
  });

  it("tsconfig.json change creates medium build impact with evidence", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: ["tsconfig.json"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.title === "TypeScript configuration file changed");
    expect(item?.impactLevel).toBe("medium");
    expect(item?.area).toBe("build");
    expect(item?.evidence).toContain("TypeScript config changed: tsconfig.json");
  });

  it("package.json change creates high dependency impact with release risk", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: ["package.json"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.title === "Package manifest file changed");
    expect(item?.impactLevel).toBe("high");
    expect(item?.evidence).toContain("Package manifest changed: package.json");
    expect(result.releaseRisks.some((risk) => risk.includes("Package manifest"))).toBe(true);
  });

  it("lint config change creates medium build impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: ["eslint.config.js"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.title === "Lint configuration file changed");
    expect(item?.impactLevel).toBe("medium");
    expect(item?.evidence).toContain("Lint config changed: eslint.config.js");
  });

  it("test config change creates medium tests impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: ["vitest.config.ts"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.title === "Test configuration file changed");
    expect(item?.impactLevel).toBe("medium");
    expect(item?.area).toBe("tests");
    expect(item?.evidence).toContain("Test config changed: vitest.config.ts");
  });

  it("app layout file change creates high routing impact with release risk", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: ["src/app/layout.tsx"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find((i) => i.title === "App layout file changed");
    expect(item?.impactLevel).toBe("high");
    expect(item?.area).toBe("routing");
    expect(item?.evidence).toContain("App layout changed: src/app/layout.tsx");
    expect(result.releaseRisks.some((risk) => risk.includes("App layout"))).toBe(true);
  });

  it("build/deployment config change creates high deployment impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      changedFiles: [".github/workflows/ci.yml"],
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const item = result.impactItems.find(
      (i) => i.title === "Build/deployment configuration file changed",
    );
    expect(item?.impactLevel).toBe("high");
    expect(item?.area).toBe("deployment");
    expect(item?.evidence).toContain("Build/deployment config changed: .github/workflows/ci.yml");
    expect(result.releaseRisks.some((risk) => risk.includes("Build/deployment"))).toBe(true);
  });
});

// ─── Test 9: Documentation-only changes ──────────────────────────────────────

describe("analyzeRepositoryImpact — documentation-only changes remain low impact", () => {
  it("only doc category change produces low overall impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      fileSummary: {
        totalFilesOld: 10,
        totalFilesNew: 11,
        totalFilesDelta: 1,
        totalDirsOld: 3,
        totalDirsNew: 3,
        categoryChanges: { doc: { old: 2, new: 3, delta: 1 } },
      },
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("low");
  });

  it("documentation-only change produces no blocking concerns", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      fileSummary: {
        totalFilesOld: 5,
        totalFilesNew: 6,
        totalFilesDelta: 1,
        totalDirsOld: 2,
        totalDirsNew: 2,
        categoryChanges: { doc: { old: 1, new: 2, delta: 1 } },
      },
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.blockingConcerns).toEqual([]);
    expect(result.releaseRisks).toEqual([]);
  });

  it("documentation-only change has empty affectedRoles", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      fileSummary: {
        totalFilesOld: 5,
        totalFilesNew: 6,
        totalFilesDelta: 1,
        totalDirsOld: 2,
        totalDirsNew: 2,
        categoryChanges: { doc: { old: 0, new: 1, delta: 1 } },
      },
      affectedAreas: ["files"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.affectedRoles).toEqual([]);
  });
});

// ─── Test 10: Multiple changes produce highest overall impact ─────────────────

describe("analyzeRepositoryImpact — multiple changes produce highest impact", () => {
  it("critical + high changes produce critical overall impact", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Tag"], removed: [] },
      testChanges: { added: [], removed: ["src/lib/x.test.ts"], oldCount: 2, newCount: 1 },
      dependencyChanges: { added: ["zod"], removed: [], addedDev: [], removedDev: [] },
      apiRouteChanges: { added: ["src/app/api/auth/route.ts"], removed: [] },
      affectedAreas: ["prismaModels", "tests", "dependencies", "apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("critical");
  });

  it("multiple medium changes accumulate but do not escalate to critical", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      dependencyChanges: { added: ["axios", "lodash"], removed: [], addedDev: [], removedDev: [] },
      routeChanges: {
        added: [{ path: "src/app/about/page.tsx", type: "page", evidence: "page" }],
        removed: [],
        changed: [],
      },
      affectedAreas: ["dependencies", "routes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("medium");
  });

  it("multiple changes produce multiple impact items", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Comment"], removed: [] },
      testChanges: { added: [], removed: ["src/lib/y.test.ts"], oldCount: 3, newCount: 2 },
      affectedAreas: ["prismaModels", "tests"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.impactItems.length).toBeGreaterThan(1);
  });
});

// ─── Test 11: Every recommendation has evidence ───────────────────────────────

describe("analyzeRepositoryImpact — every recommendation has evidence", () => {
  it("all recommendedActions have non-empty evidence arrays", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Post"], removed: [] },
      dependencyChanges: { added: ["stripe"], removed: [], addedDev: ["prettier"], removedDev: [] },
      testChanges: { added: [], removed: ["src/lib/z.test.ts"], oldCount: 2, newCount: 1 },
      affectedAreas: ["prismaModels", "dependencies", "tests"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    for (const action of result.recommendedActions) {
      expect(action.evidence.length).toBeGreaterThan(0);
    }
  });

  it("all impactItems have non-empty evidence arrays", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/widgets/route.ts"], removed: [] },
      scriptChanges: {
        added: [],
        removed: [],
        changed: [{ name: "build", oldValue: "next build", newValue: "next build --profile" }],
      },
      affectedAreas: ["apiRoutes", "scripts"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    for (const item of result.impactItems) {
      expect(item.evidence.length).toBeGreaterThan(0);
    }
  });
});

// ─── Test 12: Deterministic ordering ─────────────────────────────────────────

describe("analyzeRepositoryImpact — deterministic ordering", () => {
  it("produces identical output for the same input called twice", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Zeta", "Alpha"], removed: ["Mango"] },
      dependencyChanges: { added: ["zod", "axios"], removed: [], addedDev: [], removedDev: [] },
      testChanges: { added: [], removed: ["src/lib/a.test.ts"], oldCount: 2, newCount: 1 },
      affectedAreas: ["prismaModels", "dependencies", "tests"],
    });
    const r1 = analyzeRepositoryImpact(comparison, FIXED_AT);
    const r2 = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("impact items are sorted by descending impact level", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Tag"], removed: [] },
      dependencyChanges: { added: ["axios"], removed: [], addedDev: [], removedDev: [] },
      testChanges: { added: ["src/lib/b.test.ts"], removed: [], oldCount: 1, newCount: 2 },
      affectedAreas: ["prismaModels", "dependencies", "tests"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;

    const levels = result.impactItems.map((i) => i.impactLevel);
    const levelOrder: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    for (let i = 0; i < levels.length - 1; i++) {
      expect(levelOrder[levels[i]!]).toBeGreaterThanOrEqual(levelOrder[levels[i + 1]!]!);
    }
  });

  it("affectedRoles are sorted alphabetically", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      apiRouteChanges: { added: ["src/app/api/auth/route.ts"], removed: [] },
      affectedAreas: ["apiRoutes"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.affectedRoles).toEqual([...result.affectedRoles].sort());
  });

  it("evidence array is sorted alphabetically", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Zeta", "Alpha", "Mango"], removed: [] },
      affectedAreas: ["prismaModels"],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.evidence).toEqual([...result.evidence].sort());
  });
});

// ─── Test 13: Comparison error is handled truthfully ─────────────────────────

describe("analyzeRepositoryImpact — comparison error handling", () => {
  it("returns ImpactAnalysisError when given a SnapshotComparisonError", () => {
    const errorInput = makeComparisonError();
    const result = analyzeRepositoryImpact(errorInput, FIXED_AT);
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error).toBe(true);
  });

  it("error result includes the original failure reason", () => {
    const errorInput = makeComparisonError({ reason: "Snapshots belong to different repositories." });
    const result = analyzeRepositoryImpact(errorInput, FIXED_AT);
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.reason).toContain("Snapshots belong to different repositories.");
  });

  it("error result threads through snapshot and repository ids", () => {
    const errorInput = makeComparisonError({
      oldSnapshotId: "snap-abc",
      newSnapshotId: "snap-xyz",
      repositoryId: "repo-99",
    });
    const result = analyzeRepositoryImpact(errorInput, FIXED_AT);
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.oldSnapshotId).toBe("snap-abc");
    expect(result.newSnapshotId).toBe("snap-xyz");
    expect(result.repositoryId).toBe("repo-99");
  });

  it("error result contains the injected analyzedAt timestamp", () => {
    const errorInput = makeComparisonError();
    const ts = "2026-01-01T00:00:00.000Z";
    const result = analyzeRepositoryImpact(errorInput, ts);
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.analyzedAt).toBe(ts);
  });
});

// ─── Test 14: Limitations from comparison are preserved ──────────────────────

describe("analyzeRepositoryImpact — limitations preserved", () => {
  it("limitations from comparison result pass through unchanged", () => {
    const customLimitations = [
      "Dependency version changes are not detectable.",
      "Custom limitation A.",
    ];
    const comparison = makeComparisonResult({ limitations: customLimitations });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.limitations).toEqual(customLimitations);
  });

  it("version mismatch limitation lowers confidence to medium", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Tag"], removed: [] },
      affectedAreas: ["prismaModels"],
      limitations: [
        "Analyzer version mismatch: old snapshot used version 1, new snapshot used version 2.",
        "Dependency version changes are not detectable.",
      ],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.confidence).toBe("medium");
    expect(result.limitations[0]).toContain("version mismatch");
  });

  it("no-change result preserves limitations from comparison", () => {
    const comparison = makeComparisonResult({
      limitations: ["Limit A.", "Limit B."],
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.limitations).toEqual(["Limit A.", "Limit B."]);
  });
});

// ─── Test 15: No fake AI or repository mutation ───────────────────────────────

describe("analyzeRepositoryImpact — purity guarantees", () => {
  it("does not mutate the input comparison result", () => {
    const comparison = makeComparisonResult({
      hasChanges: true,
      prismaModelChanges: { added: ["Frozen"], removed: [] },
      affectedAreas: ["prismaModels"],
    });
    const originalJson = JSON.stringify(comparison);
    analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(JSON.stringify(comparison)).toBe(originalJson);
  });

  it("analyzedAt in result equals the injected timestamp", () => {
    const ts = "2026-03-15T12:00:00.000Z";
    const result = analyzeRepositoryImpact(makeComparisonResult(), ts);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.analyzedAt).toBe(ts);
  });

  it("repositoryId and snapshot ids are correctly threaded through", () => {
    const comparison = makeComparisonResult({
      repositoryId: "repo-abc",
      oldSnapshotId: "snap-111",
      newSnapshotId: "snap-222",
    });
    const result = analyzeRepositoryImpact(comparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.repositoryId).toBe("repo-abc");
    expect(result.oldSnapshotId).toBe("snap-111");
    expect(result.newSnapshotId).toBe("snap-222");
  });

  it("function does not throw for any valid comparison result shape", () => {
    const emptyChanges = makeComparisonResult({ hasChanges: true, affectedAreas: [] });
    expect(() => analyzeRepositoryImpact(emptyChanges, FIXED_AT)).not.toThrow();

    const errorInput = makeComparisonError({ repositoryId: null, oldSnapshotId: null });
    expect(() => analyzeRepositoryImpact(errorInput, FIXED_AT)).not.toThrow();
  });

  it("defaults missing nested comparison fields to empty values", () => {
    const malformedComparison = {
      oldSnapshotId: "snap-old",
      newSnapshotId: "snap-new",
      repositoryId: "repo-1",
      comparedAt: FIXED_AT,
      hasChanges: true,
      changedFiles: ["next.config.ts"],
      affectedAreas: ["files"],
    } as SnapshotComparisonResult;

    const result = analyzeRepositoryImpact(malformedComparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("high");
    expect(result.evidence).toContain("Next.js config changed: next.config.ts");
    expect(result.limitations).toEqual([]);
  });

  it("missing change arrays do not throw and produce none when no evidence exists", () => {
    const malformedComparison = {
      oldSnapshotId: "snap-old",
      newSnapshotId: "snap-new",
      repositoryId: "repo-1",
      comparedAt: FIXED_AT,
      hasChanges: true,
      affectedAreas: ["files"],
    } as SnapshotComparisonResult;

    const result = analyzeRepositoryImpact(malformedComparison, FIXED_AT);
    expect(isResult(result)).toBe(true);
    if (!isResult(result)) return;
    expect(result.overallImpactLevel).toBe("none");
    expect(result.impactItems).toEqual([]);
  });
});
