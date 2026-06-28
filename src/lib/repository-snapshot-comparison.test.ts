import { describe, expect, it } from "vitest";
import { analyzeRepositoryImpact } from "./repository-impact-analysis";
import { compareSnapshots, type SnapshotForComparison } from "./repository-snapshot-comparison";

const FIXED_AT = "2026-06-28T00:00:00.000Z";

function makeSnapshot(overrides: Partial<SnapshotForComparison> = {}): SnapshotForComparison {
  return {
    id: "snap-1",
    repositoryId: "repo-1",
    companyId: "company-1",
    analyzerVersion: "1",
    status: "completed",
    error: null,
    fileTree: JSON.stringify({
      totalFiles: 1,
      totalDirs: 0,
      byCategory: { source: 1 },
      byExtension: { ".ts": 1 },
      topLevelDirs: ["src"],
    }),
    importantFiles: "[]",
    routes: "[]",
    apiRoutes: "[]",
    serverActions: "[]",
    prismaModels: "[]",
    dependencies: "[]",
    devDependencies: "[]",
    scripts: JSON.stringify({ dev: null, build: null, test: null, lint: null, typecheck: null }),
    testFiles: "[]",
    fileFingerprints: JSON.stringify([
      {
        path: "src/lib/example.ts",
        extension: ".ts",
        size: 24,
        category: "source",
        contentHash: "old-hash",
      },
    ]),
    risks: "[]",
    ignoredPaths: "[]",
    ...overrides,
  };
}

describe("compareSnapshots — file fingerprints", () => {
  it("detects same-path content hash changes as changed files", () => {
    const oldSnapshot = makeSnapshot({ id: "snap-old" });
    const newSnapshot = makeSnapshot({
      id: "snap-new",
      fileFingerprints: JSON.stringify([
        {
          path: "src/lib/example.ts",
          extension: ".ts",
          size: 25,
          category: "source",
          contentHash: "new-hash",
        },
      ]),
    });

    const comparison = compareSnapshots(oldSnapshot, newSnapshot, FIXED_AT);

    expect("error" in comparison).toBe(false);
    if ("error" in comparison) return;
    expect(comparison.hasChanges).toBe(true);
    expect(comparison.changedFiles).toEqual(["src/lib/example.ts"]);
    expect(comparison.changeCounts.changedFiles).toBe(1);
    expect(comparison.evidence).toContainEqual({
      area: "files",
      description: "File content changed: src/lib/example.ts",
      oldValue: "previous hash",
      newValue: "new hash",
    });
  });

  it("turns content-only source changes into impact evidence", () => {
    const oldSnapshot = makeSnapshot({ id: "snap-old" });
    const newSnapshot = makeSnapshot({
      id: "snap-new",
      fileFingerprints: JSON.stringify([
        {
          path: "src/lib/example.ts",
          extension: ".ts",
          size: 25,
          category: "source",
          contentHash: "new-hash",
        },
      ]),
    });

    const comparison = compareSnapshots(oldSnapshot, newSnapshot, FIXED_AT);
    const impact = analyzeRepositoryImpact(comparison, FIXED_AT);

    expect("error" in impact).toBe(false);
    if ("error" in impact) return;
    expect(impact.overallImpactLevel).toBe("medium");
    expect(impact.evidence).toContain("File content changed: src/lib/example.ts");
    expect(impact.affectedRoles).toEqual(["Engineering Manager", "QA Engineer"]);
  });
});
