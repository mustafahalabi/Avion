import { afterEach, describe, expect, it } from "vitest";
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

const FIXED_AT = "2026-06-28T05:20:00.000Z";
const createdCompanyIds: string[] = [];
const tempDirs: string[] = [];

type PrismaClient = typeof PrismaSingleton;

interface DogfoodRuntime {
  prisma: PrismaClient;
  createRepositoryAnalysisSnapshot: typeof CreateRepositoryAnalysisSnapshot;
  compareLatestRepositoryAnalysisSnapshots: typeof CompareLatestRepositoryAnalysisSnapshots;
  analyzeLatestRepositoryImpact: typeof AnalyzeLatestRepositoryImpact;
  getLatestRepositoryChangeIntelligence: typeof GetLatestRepositoryChangeIntelligence;
}

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

async function createDogfoodRuntime(): Promise<DogfoodRuntime> {
  const databasePath = join(tmpdir(), `engineering-os-dogfood-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  tempDirs.push(databasePath);
  process.env.ENGINEERING_OS_DATABASE_PATH = databasePath;

  const [{ prisma }, snapshotService, changeIntelligence] = await Promise.all([
    import("./prisma"),
    import("./repository-snapshot-service"),
    import("./repository-change-intelligence"),
  ]);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clerkId" TEXT,
      "name" TEXT,
      "email" TEXT NOT NULL,
      "image" TEXT,
      "role" TEXT NOT NULL DEFAULT 'member',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "logoUrl" TEXT,
      "website" TEXT,
      "industry" TEXT,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Workspace" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Workspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Workspace_companyId_slug_key" ON "Workspace"("companyId", "slug");`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Workspace_companyId_id_key" ON "Workspace"("companyId", "id");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Repository" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "url" TEXT,
      "description" TEXT,
      "primaryLanguage" TEXT,
      "techStack" TEXT NOT NULL DEFAULT '[]',
      "frameworks" TEXT NOT NULL DEFAULT '[]',
      "dependencies" TEXT NOT NULL DEFAULT '[]',
      "importantFiles" TEXT NOT NULL DEFAULT '[]',
      "fileCount" INTEGER,
      "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
      "analysisNotes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Repository_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "RepositoryAnalysisSnapshot" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "repositoryId" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "analyzerVersion" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'completed',
      "error" TEXT,
      "localPath" TEXT,
      "fileTree" TEXT NOT NULL DEFAULT '{}',
      "importantFiles" TEXT NOT NULL DEFAULT '[]',
      "routes" TEXT NOT NULL DEFAULT '[]',
      "apiRoutes" TEXT NOT NULL DEFAULT '[]',
      "serverActions" TEXT NOT NULL DEFAULT '[]',
      "prismaModels" TEXT NOT NULL DEFAULT '[]',
      "dependencies" TEXT NOT NULL DEFAULT '[]',
      "devDependencies" TEXT NOT NULL DEFAULT '[]',
      "scripts" TEXT NOT NULL DEFAULT '{}',
      "testFiles" TEXT NOT NULL DEFAULT '[]',
      "fileFingerprints" TEXT NOT NULL DEFAULT '[]',
      "risks" TEXT NOT NULL DEFAULT '[]',
      "ignoredPaths" TEXT NOT NULL DEFAULT '[]',
      "analysisSummary" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "RepositoryAnalysisSnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "RepositoryAnalysisSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX "RepositoryAnalysisSnapshot_repositoryId_createdAt_idx" ON "RepositoryAnalysisSnapshot"("repositoryId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX "RepositoryAnalysisSnapshot_companyId_createdAt_idx" ON "RepositoryAnalysisSnapshot"("companyId", "createdAt");`);

  return {
    prisma,
    createRepositoryAnalysisSnapshot: snapshotService.createRepositoryAnalysisSnapshot,
    compareLatestRepositoryAnalysisSnapshots: snapshotService.compareLatestRepositoryAnalysisSnapshots,
    analyzeLatestRepositoryImpact: snapshotService.analyzeLatestRepositoryImpact,
    getLatestRepositoryChangeIntelligence: changeIntelligence.getLatestRepositoryChangeIntelligence,
  };
}

async function createDogfoodRepository(prisma: PrismaClient) {
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
  createdCompanyIds.push(company.id);

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

afterEach(async () => {
  const { prisma } = await import("./prisma");

  for (const companyId of createdCompanyIds.splice(0)) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { ownerId: true },
    });

    await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    if (company?.ownerId) {
      await prisma.user.delete({ where: { id: company.ownerId } }).catch(() => undefined);
    }
  }

  await prisma.$disconnect();
  (globalThis as typeof globalThis & { prisma?: unknown }).prisma = undefined;
  delete process.env.ENGINEERING_OS_DATABASE_PATH;

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("Repository Intelligence Slice 2 dogfood flow", () => {
  it("persists two real repository analyses, compares them, and generates CEO-readable impact", async () => {
    const {
      prisma,
      createRepositoryAnalysisSnapshot,
      compareLatestRepositoryAnalysisSnapshots,
      analyzeLatestRepositoryImpact,
      getLatestRepositoryChangeIntelligence,
    } = await createDogfoodRuntime();
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
  });
});
