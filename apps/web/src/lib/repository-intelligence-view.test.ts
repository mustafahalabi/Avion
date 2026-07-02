import { describe, expect, it } from "vitest";

import {
  buildRepositoryIntelligenceUrl,
  buildRepositoryIntelligenceView,
  REPOSITORY_INTELLIGENCE_ANCHOR,
  type RepositoryIntelligenceRepositoryInput,
  type RepositoryIntelligenceSnapshotInput,
} from "./repository-intelligence-view";

const REPOSITORY: RepositoryIntelligenceRepositoryInput = {
  id: "repo-1",
  analysisStatus: "pending",
  frameworks: JSON.stringify(["Next.js"]),
  techStack: JSON.stringify(["Prisma"]),
  importantFiles: JSON.stringify(["prisma/schema.prisma"]),
};

describe("buildRepositoryIntelligenceUrl", () => {
  it("builds a dashboard URL with the intelligence anchor", () => {
    expect(buildRepositoryIntelligenceUrl("repo-1")).toBe(
      `/work/repositories/repo-1#${REPOSITORY_INTELLIGENCE_ANCHOR}`
    );
  });
});

describe("buildRepositoryIntelligenceView", () => {
  it("returns truthful missing-data markers when no snapshot exists", () => {
    const view = buildRepositoryIntelligenceView(null, REPOSITORY);

    expect(view.snapshotId).toBeNull();
    expect(view.missingData).toContain("No repository analysis snapshot exists yet.");
    expect(view.fileTree.totalFiles).toBeNull();
    expect(view.apiSurface.unknowns).toContain(
      "Run repository analysis to detect routes and API surface."
    );
    expect(view.databaseLayer.unknowns).toContain(
      "Run repository analysis to detect database layer."
    );
  });

  it("surfaces failed snapshot errors and partial data", () => {
    const snapshot: RepositoryIntelligenceSnapshotInput = {
      id: "snap-1",
      status: "failed",
      error: "Local path not found",
      analysisSummary: null,
      createdAt: new Date("2026-06-28T12:00:00.000Z"),
      fileTree: JSON.stringify({ totalFiles: 42, totalDirs: 8, topLevelDirs: ["src"] }),
      importantFiles: JSON.stringify([]),
      routes: JSON.stringify([]),
      apiRoutes: JSON.stringify([]),
      serverActions: JSON.stringify([]),
      prismaModels: JSON.stringify([]),
      dependencies: JSON.stringify([]),
      devDependencies: JSON.stringify([]),
      scripts: JSON.stringify(null),
      risks: JSON.stringify([]),
    };

    const view = buildRepositoryIntelligenceView(snapshot, REPOSITORY);

    expect(view.snapshotStatus).toBe("failed");
    expect(view.snapshotError).toBe("Local path not found");
    expect(view.missingData).toContain("Latest analysis snapshot failed.");
    expect(view.unknowns).toContain("Local path not found");
    expect(view.fileTree.totalFiles).toBe(42);
  });

  it("parses a complete snapshot into structured dashboard sections", () => {
    const snapshot: RepositoryIntelligenceSnapshotInput = {
      id: "snap-2",
      status: "completed",
      error: null,
      analysisSummary:
        "Package manager: pnpm. Routing unknowns: dynamic segments not resolved.",
      createdAt: new Date("2026-06-28T13:00:00.000Z"),
      fileTree: JSON.stringify({
        totalFiles: 120,
        totalDirs: 20,
        topLevelDirs: ["src", "prisma"],
        byExtension: { ".ts": 80, ".tsx": 40 },
        importantPaths: ["prisma/schema.prisma"],
      }),
      importantFiles: JSON.stringify(["prisma/schema.prisma", "prisma/migrations/001_init"]),
      routes: JSON.stringify([
        { type: "page", path: "/dashboard", evidence: "src/app/dashboard/page.tsx" },
        { type: "api", path: "/api/health", evidence: "src/app/api/health/route.ts" },
      ]),
      apiRoutes: JSON.stringify(["/api/health"]),
      serverActions: JSON.stringify(["src/app/actions/repository.ts"]),
      prismaModels: JSON.stringify([{ name: "Repository" }, { name: "Company" }]),
      dependencies: JSON.stringify(["next"]),
      devDependencies: JSON.stringify(["vitest"]),
      scripts: JSON.stringify({
        lint: "eslint .",
        build: "next build",
        test: "vitest run",
        typecheck: "tsc --noEmit",
      }),
      risks: JSON.stringify([
        {
          category: "schema",
          severity: "medium",
          description: "Missing ownership fields",
          evidence: "prisma/schema.prisma",
          mitigation: "Add companyId to tenant models",
        },
      ]),
    };

    const view = buildRepositoryIntelligenceView(snapshot, REPOSITORY);

    expect(view.packageManager.name).toBe("pnpm");
    expect(view.fileTree.totalFiles).toBe(120);
    expect(view.apiSurface.pages).toHaveLength(1);
    expect(view.apiSurface.apiRoutes).toHaveLength(1);
    expect(view.databaseLayer.technology).toBe("prisma");
    expect(view.databaseLayer.models).toEqual(["Repository", "Company"]);
    expect(view.scripts?.test).toBe("vitest run");
    expect(view.risks).toHaveLength(1);
    expect(view.unknowns.some((item) => item.includes("dynamic segments"))).toBe(true);
    expect(view.reanalysisAvailable).toBe(true);
  });
});
