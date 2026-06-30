import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { prisma as PrismaSingleton } from "./prisma";
import type {
  getLatestRepositoryChangeIntelligence as GetLatestRepositoryChangeIntelligence,
} from "./repository-change-intelligence";
import type {
  analyzeLatestRepositoryImpact as AnalyzeLatestRepositoryImpact,
  compareLatestRepositoryAnalysisSnapshots as CompareLatestRepositoryAnalysisSnapshots,
  createRepositoryAnalysisSnapshot as CreateRepositoryAnalysisSnapshot,
} from "./repository-snapshot-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

const FIXED_AT = "2026-06-28T05:20:00.000Z";
const tempDirs: string[] = [];

type PrismaClient = typeof PrismaSingleton;

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: PrismaClient;
let schema: string;
let createRepositoryAnalysisSnapshot: typeof CreateRepositoryAnalysisSnapshot;
let compareLatestRepositoryAnalysisSnapshots: typeof CompareLatestRepositoryAnalysisSnapshots;
let analyzeLatestRepositoryImpact: typeof AnalyzeLatestRepositoryImpact;
let getLatestRepositoryChangeIntelligence: typeof GetLatestRepositoryChangeIntelligence;

function copyCurrentRepositoryFixture() {
  const destination = join(tmpdir(), `engineering-os-dogfood-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempDirs.push(destination);

  cpSync(process.cwd(), destination, {
    recursive: true,
    filter: (source) => {
      const relativePath = source.slice(process.cwd().length + 1);
      if (!relativePath) return true;

      return ![
        ".git",
        ".next",
        "node_modules",
        "prisma/dev.db",
        ".turbo",
        "coverage",
      ].some((ignoredPath) => relativePath === ignoredPath || relativePath.startsWith(`${ignoredPath}/`));
    },
  });

  return destination;
}

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("repository-snapshot-dogfood"));

  // Service modules read the prisma singleton at import time, so import them
  // only after setupTestSchema has pointed the singleton at the suite schema.
  const [snapshotService, changeIntelligence] = await Promise.all([
    import("./repository-snapshot-service"),
    import("./repository-change-intelligence"),
  ]);

  createRepositoryAnalysisSnapshot = snapshotService.createRepositoryAnalysisSnapshot;
  compareLatestRepositoryAnalysisSnapshots = snapshotService.compareLatestRepositoryAnalysisSnapshots;
  analyzeLatestRepositoryImpact = snapshotService.analyzeLatestRepositoryImpact;
  getLatestRepositoryChangeIntelligence = changeIntelligence.getLatestRepositoryChangeIntelligence;
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

async function createDogfoodRepository(prisma: PrismaClient) {
  // Postgres enforces foreign keys (the old SQLite tables had none), so seed the
  // full parent chain: User -> Company -> Workspace -> Repository.
  const user = await prisma.user.create({
    data: {
      email: `repository-dogfood-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: "Repository Dogfood",
    },
  });

  const company = await prisma.company.create({
    data: {
      name: "Repository Dogfood Company",
      slug: `repository-dogfood-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerId: user.id,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      companyId: company.id,
      name: "Default",
      slug: "default",
    },
  });

  const repository = await prisma.repository.create({
    data: {
      workspaceId: workspace.id,
      name: "Avion Dogfood Fixture",
      url: "https://example.com/engineering-os",
      analysisStatus: "pending",
    },
  });

  return { company, repository };
}

describe("Repository Intelligence Slice 2 dogfood flow", () => {
  it("persists two real repository analyses, compares them, and generates CEO-readable impact", async () => {
    const { company, repository } = await createDogfoodRepository(prisma);
    const fixturePath = copyCurrentRepositoryFixture();

    const baselineSnapshot = await createRepositoryAnalysisSnapshot({
      repositoryId: repository.id,
      companyId: company.id,
      localPath: fixturePath,
    });

    const dogfoodRouteDir = join(fixturePath, "src/app/dogfood-impact");
    mkdirSync(dogfoodRouteDir, { recursive: true });
    writeFileSync(
      join(dogfoodRouteDir, "page.tsx"),
      "export default function RepositoryImpactPage() { return <main>Repository impact dogfood</main>; }\n",
    );
    writeFileSync(
      join(fixturePath, "docs/reviews/repository-dogfood-temp.md"),
      "# Repository Dogfood Temp\n\nThis file exists only in the copied dogfood fixture.\n",
    );

    const changedSnapshot = await createRepositoryAnalysisSnapshot({
      repositoryId: repository.id,
      companyId: company.id,
      localPath: fixturePath,
    });

    expect(baselineSnapshot.status).toBe("completed");
    expect(changedSnapshot.status).toBe("completed");
    expect(await prisma.repositoryAnalysisSnapshot.count({ where: { repositoryId: repository.id } })).toBe(2);

    const comparison = await compareLatestRepositoryAnalysisSnapshots({
      repositoryId: repository.id,
      companyId: company.id,
      comparedAt: FIXED_AT,
    });

    expect("error" in comparison).toBe(false);
    if ("error" in comparison) return;

    expect(comparison.hasChanges).toBe(true);
    expect(comparison.routeChanges.added.map((route) => route.path)).toContain("src/app/dogfood-impact/page.tsx");
    expect(comparison.evidence).toContainEqual(
      expect.objectContaining({
        area: "routes",
        description: "Route added: src/app/dogfood-impact/page.tsx",
        newValue: "src/app/dogfood-impact/page.tsx (page)",
      }),
    );

    const impact = await analyzeLatestRepositoryImpact({
      repositoryId: repository.id,
      companyId: company.id,
      comparedAt: FIXED_AT,
      analyzedAt: FIXED_AT,
    });

    expect("error" in impact).toBe(false);
    if ("error" in impact) return;

    expect(impact.overallImpactLevel).toBe("medium");
    expect(impact.affectedAreas).toContain("routing");
    expect(impact.affectedRoles).toEqual(expect.arrayContaining(["QA Engineer", "Release Manager"]));
    expect(impact.recommendedActions.map((action) => action.action).join(" ").toLowerCase()).toContain("smoke-test");
    expect(impact.summary).toContain("Overall impact: MEDIUM");
    expect(impact.evidence).toContain("Route added: src/app/dogfood-impact/page.tsx (page)");

    const latestChangeIntelligence = await getLatestRepositoryChangeIntelligence({
      repositoryId: repository.id,
      companyId: company.id,
      comparedAt: FIXED_AT,
      analyzedAt: FIXED_AT,
    });

    expect(latestChangeIntelligence.snapshotCount).toBe(2);
    expect(latestChangeIntelligence.latestSnapshot?.status).toBe("completed");
    expect(latestChangeIntelligence.comparison).toEqual(comparison);
    expect(latestChangeIntelligence.impact).toEqual(impact);
    // Heavy end-to-end dogfood: copies the repo fixture and persists two full
    // analyses. Each snapshot is now a series of Postgres round-trips (slower
    // than the old in-process SQLite), so this one suite needs a longer budget.
  }, 120_000);
});
