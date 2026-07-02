import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock prisma. The pure compareSnapshots / analyzeRepositoryImpact functions
//     are intentionally NOT mocked — they run against the mocked snapshot rows. ──

const mockSnapshotCount = vi.fn();
const mockSnapshotFindMany = vi.fn();
vi.mock("./prisma", () => ({
  prisma: {
    repositoryAnalysisSnapshot: {
      count: (...args: unknown[]) => mockSnapshotCount(...args),
      findMany: (...args: unknown[]) => mockSnapshotFindMany(...args),
    },
  },
}));

import { getLatestRepositoryChangeIntelligence } from "./repository-change-intelligence";

interface SnapshotOverrides {
  id?: string;
  repositoryId?: string;
  companyId?: string;
  status?: string;
  error?: string | null;
  analyzerVersion?: string;
  prismaModels?: string[];
  analysisSummary?: string | null;
  createdAt?: Date;
}

function makeSnapshot(overrides: SnapshotOverrides = {}) {
  return {
    id: overrides.id ?? "snap-1",
    repositoryId: overrides.repositoryId ?? "repo-1",
    companyId: overrides.companyId ?? "company-1",
    analyzerVersion: overrides.analyzerVersion ?? "1.0.0",
    status: overrides.status ?? "completed",
    error: overrides.error ?? null,
    fileTree: JSON.stringify({
      totalFiles: 10,
      totalDirs: 3,
      byCategory: {},
      byExtension: {},
      topLevelDirs: [],
    }),
    importantFiles: "[]",
    routes: "[]",
    apiRoutes: "[]",
    serverActions: "[]",
    prismaModels: JSON.stringify(overrides.prismaModels ?? ["User"]),
    dependencies: "[]",
    devDependencies: "[]",
    scripts: JSON.stringify({ dev: null, build: null, test: null, lint: null, typecheck: null }),
    testFiles: "[]",
    fileFingerprints: "[]",
    risks: "[]",
    ignoredPaths: "[]",
    analysisSummary: overrides.analysisSummary ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
  };
}

const INPUT = { repositoryId: "repo-1", companyId: "company-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockSnapshotCount.mockResolvedValue(0);
  mockSnapshotFindMany.mockResolvedValue([]);
});

describe("getLatestRepositoryChangeIntelligence", () => {
  it("returns an empty intelligence object when there are no snapshots", async () => {
    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.repositoryId).toBe("repo-1");
    expect(result.snapshotCount).toBe(0);
    expect(result.latestSnapshot).toBeNull();
    expect(result.previousSnapshot).toBeNull();
    expect(result.comparison).toBeNull();
    expect(result.impact).toBeNull();
  });

  it("scopes count and findMany queries to repository + company and takes the two newest", async () => {
    await getLatestRepositoryChangeIntelligence(INPUT);

    expect(mockSnapshotCount).toHaveBeenCalledWith({
      where: { repositoryId: "repo-1", companyId: "company-1" },
    });
    const findArgs = mockSnapshotFindMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({ repositoryId: "repo-1", companyId: "company-1" });
    expect(findArgs.take).toBe(2);
    expect(findArgs.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("returns the latest snapshot summary but no comparison with a single snapshot", async () => {
    mockSnapshotCount.mockResolvedValue(1);
    mockSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ id: "snap-1", analysisSummary: "Initial scan" }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.snapshotCount).toBe(1);
    expect(result.latestSnapshot).toEqual({
      id: "snap-1",
      status: "completed",
      error: null,
      analysisSummary: "Initial scan",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(result.previousSnapshot).toBeNull();
    expect(result.comparison).toBeNull();
    expect(result.impact).toBeNull();
  });

  it("projects only the summary fields and omits raw snapshot payload fields", async () => {
    mockSnapshotCount.mockResolvedValue(1);
    mockSnapshotFindMany.mockResolvedValue([makeSnapshot({ id: "snap-1" })]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.latestSnapshot).not.toBeNull();
    expect(Object.keys(result.latestSnapshot!).sort()).toEqual([
      "analysisSummary",
      "createdAt",
      "error",
      "id",
      "status",
    ]);
  });

  it("reports no functional impact when the two snapshots are identical", async () => {
    mockSnapshotCount.mockResolvedValue(2);
    mockSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ id: "snap-2", createdAt: new Date("2026-02-01T00:00:00Z") }),
      makeSnapshot({ id: "snap-1", createdAt: new Date("2026-01-01T00:00:00Z") }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.snapshotCount).toBe(2);
    expect(result.previousSnapshot?.id).toBe("snap-1");
    expect(result.latestSnapshot?.id).toBe("snap-2");
    expect(result.comparison).not.toBeNull();
    expect((result.comparison as { hasChanges: boolean }).hasChanges).toBe(false);
    expect(result.impact).not.toBeNull();
    expect((result.impact as { overallImpactLevel: string }).overallImpactLevel).toBe("none");
  });

  it("derives a high-impact database change when a prisma model is added", async () => {
    mockSnapshotCount.mockResolvedValue(2);
    mockSnapshotFindMany.mockResolvedValue([
      // newest first → latest has the added model
      makeSnapshot({
        id: "snap-2",
        prismaModels: ["User", "Post"],
        createdAt: new Date("2026-02-01T00:00:00Z"),
      }),
      makeSnapshot({
        id: "snap-1",
        prismaModels: ["User"],
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    const comparison = result.comparison as {
      hasChanges: boolean;
      prismaModelChanges: { added: string[] };
    };
    expect(comparison.hasChanges).toBe(true);
    expect(comparison.prismaModelChanges.added).toEqual(["Post"]);

    const impact = result.impact as {
      overallImpactLevel: string;
      affectedAreas: string[];
    };
    expect(impact.overallImpactLevel).toBe("high");
    expect(impact.affectedAreas).toContain("database");
  });

  it("surfaces a comparison error (and error impact) when the latest snapshot failed", async () => {
    mockSnapshotCount.mockResolvedValue(2);
    mockSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ id: "snap-2", status: "failed", error: "analysis crashed" }),
      makeSnapshot({ id: "snap-1" }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.comparison).not.toBeNull();
    expect((result.comparison as { error?: boolean }).error).toBe(true);
    expect((result.impact as { error?: boolean }).error).toBe(true);
  });

  it("injects the provided comparedAt and analyzedAt timestamps", async () => {
    mockSnapshotCount.mockResolvedValue(2);
    mockSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ id: "snap-2", prismaModels: ["User", "Post"] }),
      makeSnapshot({ id: "snap-1", prismaModels: ["User"] }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence({
      ...INPUT,
      comparedAt: "2026-06-01T12:00:00.000Z",
      analyzedAt: "2026-06-02T12:00:00.000Z",
    });

    expect((result.comparison as { comparedAt: string }).comparedAt).toBe(
      "2026-06-01T12:00:00.000Z",
    );
    expect((result.impact as { analyzedAt: string }).analyzedAt).toBe(
      "2026-06-02T12:00:00.000Z",
    );
  });

  it("reports snapshotCount from the count query independently of returned rows", async () => {
    mockSnapshotCount.mockResolvedValue(17);
    mockSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ id: "snap-2", createdAt: new Date("2026-02-01T00:00:00Z") }),
      makeSnapshot({ id: "snap-1", createdAt: new Date("2026-01-01T00:00:00Z") }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.snapshotCount).toBe(17);
    expect(result.previousSnapshot).not.toBeNull();
  });

  it("maps the error field of a snapshot into its summary", async () => {
    mockSnapshotCount.mockResolvedValue(1);
    mockSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ id: "snap-1", status: "failed", error: "boom" }),
    ]);

    const result = await getLatestRepositoryChangeIntelligence(INPUT);

    expect(result.latestSnapshot?.error).toBe("boom");
    expect(result.latestSnapshot?.status).toBe("failed");
  });
});
