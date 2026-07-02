import { ANALYZER_VERSION, analyzeRepositoryPath, type RepositoryAnalysisOutcome } from "./repository-analyzer";
import { analyzeRepositoryImpact, type ImpactAnalysisOutcome } from "./repository-impact-analysis";
import { compareSnapshots, type ComparisonOutcome, type SnapshotForComparison } from "./repository-snapshot-comparison";
import { prisma } from "./prisma";

const IGNORED_PATHS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  ".env.test",
  ".envrc",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
];

export interface CreateRepositorySnapshotInput {
  repositoryId: string;
  companyId: string;
  localPath: string;
}

export interface LatestRepositoryImpactInput {
  repositoryId: string;
  companyId: string;
  comparedAt?: string;
  analyzedAt?: string;
}

export type LatestRepositoryComparisonOutcome =
  | ComparisonOutcome
  | {
      error: true;
      reason: string;
      oldSnapshotId: string | null;
      newSnapshotId: string | null;
      repositoryId: string | null;
      comparedAt: string;
    };

function json(value: unknown): string {
  return JSON.stringify(value);
}

function prismaModelNames(outcome: Extract<RepositoryAnalysisOutcome, { ok: true }>): string[] {
  return outcome.prismaModels.map((model) => model.name).sort();
}

async function ensureRepositoryForCompany(repositoryId: string, companyId: string) {
  return prisma.repository.findFirst({
    where: {
      id: repositoryId,
      workspace: { companyId },
    },
    include: {
      workspace: { select: { companyId: true } },
    },
  });
}

function toSnapshotForComparison(snapshot: {
  id: string;
  repositoryId: string;
  companyId: string;
  analyzerVersion: string;
  status: string;
  error: string | null;
  fileTree: string;
  importantFiles: string;
  routes: string;
  apiRoutes: string;
  serverActions: string;
  prismaModels: string;
  dependencies: string;
  devDependencies: string;
  scripts: string;
  testFiles: string;
  fileFingerprints: string;
  risks: string;
  ignoredPaths: string;
}): SnapshotForComparison {
  return {
    id: snapshot.id,
    repositoryId: snapshot.repositoryId,
    companyId: snapshot.companyId,
    analyzerVersion: snapshot.analyzerVersion,
    status: snapshot.status,
    error: snapshot.error,
    fileTree: snapshot.fileTree,
    importantFiles: snapshot.importantFiles,
    routes: snapshot.routes,
    apiRoutes: snapshot.apiRoutes,
    serverActions: snapshot.serverActions,
    prismaModels: snapshot.prismaModels,
    dependencies: snapshot.dependencies,
    devDependencies: snapshot.devDependencies,
    scripts: snapshot.scripts,
    testFiles: snapshot.testFiles,
    fileFingerprints: snapshot.fileFingerprints,
    risks: snapshot.risks,
    ignoredPaths: snapshot.ignoredPaths,
  };
}

export async function createRepositoryAnalysisSnapshot(input: CreateRepositorySnapshotInput) {
  const repository = await ensureRepositoryForCompany(input.repositoryId, input.companyId);
  if (!repository) {
    throw new Error("Repository not found for company.");
  }

  await prisma.repository.update({
    where: { id: input.repositoryId },
    data: { analysisStatus: "analyzing", analysisNotes: "Repository analysis started." },
  });

  const outcome = analyzeRepositoryPath(input.localPath);

  if (!outcome.ok) {
    const snapshot = await prisma.repositoryAnalysisSnapshot.create({
      data: {
        repositoryId: input.repositoryId,
        companyId: input.companyId,
        analyzerVersion: ANALYZER_VERSION,
        status: "failed",
        error: outcome.error,
        localPath: input.localPath,
        ignoredPaths: json(IGNORED_PATHS),
      },
    });

    await prisma.repository.update({
      where: { id: input.repositoryId },
      data: {
        analysisStatus: "failed",
        analysisNotes: outcome.error,
      },
    });

    return snapshot;
  }

  const snapshot = await prisma.repositoryAnalysisSnapshot.create({
    data: {
      repositoryId: input.repositoryId,
      companyId: input.companyId,
      analyzerVersion: ANALYZER_VERSION,
      status: "completed",
      error: null,
      localPath: input.localPath,
      fileTree: json(outcome.fileTree),
      importantFiles: json(outcome.importantFiles),
      routes: json(outcome.routes),
      apiRoutes: json(outcome.apiRoutes),
      serverActions: json(outcome.serverActions),
      prismaModels: json(prismaModelNames(outcome)),
      dependencies: json(outcome.dependencies),
      devDependencies: json(outcome.devDependencies),
      scripts: json(outcome.scripts),
      testFiles: json(outcome.testFiles),
      fileFingerprints: json(outcome.fileFingerprints),
      risks: json(outcome.risks),
      ignoredPaths: json(IGNORED_PATHS),
      analysisSummary: outcome.intelligenceSummary,
    },
  });

  await prisma.repository.update({
    where: { id: input.repositoryId },
    data: {
      primaryLanguage: outcome.primaryLanguage,
      techStack: json(outcome.techStack),
      frameworks: json(outcome.frameworks.map((framework) => framework.name)),
      dependencies: json(outcome.dependencies),
      importantFiles: json(outcome.importantFiles),
      fileCount: outcome.fileTree.totalFiles,
      analysisStatus: "complete",
      analysisNotes: outcome.intelligenceSummary,
    },
  });

  return snapshot;
}

export async function compareLatestRepositoryAnalysisSnapshots(
  input: LatestRepositoryImpactInput,
): Promise<LatestRepositoryComparisonOutcome> {
  const comparedAt = input.comparedAt ?? new Date().toISOString();
  const repository = await ensureRepositoryForCompany(input.repositoryId, input.companyId);
  if (!repository) {
    return {
      error: true,
      reason: "Repository not found for company.",
      oldSnapshotId: null,
      newSnapshotId: null,
      repositoryId: input.repositoryId,
      comparedAt,
    };
  }

  const snapshots = await prisma.repositoryAnalysisSnapshot.findMany({
    where: {
      repositoryId: input.repositoryId,
      companyId: input.companyId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 2,
  });

  if (snapshots.length < 2) {
    return {
      error: true,
      reason: "At least two repository analysis snapshots are required for comparison.",
      oldSnapshotId: snapshots[1]?.id ?? null,
      newSnapshotId: snapshots[0]?.id ?? null,
      repositoryId: input.repositoryId,
      comparedAt,
    };
  }

  const [newSnapshot, oldSnapshot] = snapshots;
  return compareSnapshots(
    toSnapshotForComparison(oldSnapshot),
    toSnapshotForComparison(newSnapshot),
    comparedAt,
  );
}

export async function analyzeLatestRepositoryImpact(
  input: LatestRepositoryImpactInput,
): Promise<ImpactAnalysisOutcome> {
  const comparedAt = input.comparedAt ?? new Date().toISOString();
  const analyzedAt = input.analyzedAt ?? comparedAt;
  const comparison = await compareLatestRepositoryAnalysisSnapshots({ ...input, comparedAt });
  return analyzeRepositoryImpact(comparison, analyzedAt);
}
