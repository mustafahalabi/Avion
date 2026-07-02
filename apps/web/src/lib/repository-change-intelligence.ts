import { analyzeRepositoryImpact, type ImpactAnalysisOutcome } from "./repository-impact-analysis";
import { compareSnapshots, type ComparisonOutcome, type SnapshotForComparison } from "./repository-snapshot-comparison";
import { prisma } from "./prisma";

export interface RepositoryChangeSnapshotSummary {
  readonly id: string;
  readonly status: string;
  readonly error: string | null;
  readonly analysisSummary: string | null;
  readonly createdAt: Date;
}

export interface RepositoryChangeIntelligence {
  readonly repositoryId: string;
  readonly snapshotCount: number;
  readonly latestSnapshot: RepositoryChangeSnapshotSummary | null;
  readonly previousSnapshot: RepositoryChangeSnapshotSummary | null;
  readonly comparison: ComparisonOutcome | null;
  readonly impact: ImpactAnalysisOutcome | null;
}

export interface RepositoryChangeIntelligenceInput {
  readonly repositoryId: string;
  readonly companyId: string;
  readonly comparedAt?: string;
  readonly analyzedAt?: string;
}

type SnapshotRow = {
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
  analysisSummary: string | null;
  createdAt: Date;
};

function toSnapshotSummary(snapshot: SnapshotRow): RepositoryChangeSnapshotSummary {
  return {
    id: snapshot.id,
    status: snapshot.status,
    error: snapshot.error,
    analysisSummary: snapshot.analysisSummary,
    createdAt: snapshot.createdAt,
  };
}

function toSnapshotForComparison(snapshot: SnapshotRow): SnapshotForComparison {
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

export async function getLatestRepositoryChangeIntelligence(
  input: RepositoryChangeIntelligenceInput
): Promise<RepositoryChangeIntelligence> {
  const [snapshotCount, snapshots] = await Promise.all([
    prisma.repositoryAnalysisSnapshot.count({
      where: {
        repositoryId: input.repositoryId,
        companyId: input.companyId,
      },
    }),
    prisma.repositoryAnalysisSnapshot.findMany({
      where: {
        repositoryId: input.repositoryId,
        companyId: input.companyId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
    }),
  ]);

  const [latestSnapshot, previousSnapshot] = snapshots;
  const comparedAt = input.comparedAt ?? new Date().toISOString();
  const analyzedAt = input.analyzedAt ?? comparedAt;
  const comparison =
    latestSnapshot && previousSnapshot
      ? compareSnapshots(
          toSnapshotForComparison(previousSnapshot),
          toSnapshotForComparison(latestSnapshot),
          comparedAt
        )
      : null;
  const impact = comparison ? analyzeRepositoryImpact(comparison, analyzedAt) : null;

  return {
    repositoryId: input.repositoryId,
    snapshotCount,
    latestSnapshot: latestSnapshot ? toSnapshotSummary(latestSnapshot) : null,
    previousSnapshot: previousSnapshot ? toSnapshotSummary(previousSnapshot) : null,
    comparison,
    impact,
  };
}
