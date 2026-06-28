import { prisma } from "@/lib/prisma";
import {
  buildRepositoryIntelligenceView,
  type RepositoryIntelligenceView,
} from "@/lib/repository-intelligence-view";

export interface RepositoryIntelligenceQueryInput {
  readonly repositoryId: string;
  readonly companyId: string;
}

/**
 * Loads the latest repository intelligence dashboard view for a company-owned repository.
 *
 * @param input - Repository and company identifiers.
 * @returns Structured intelligence view derived from the latest snapshot.
 */
export async function getRepositoryIntelligenceView(
  input: RepositoryIntelligenceQueryInput
): Promise<RepositoryIntelligenceView | null> {
  const repository = await prisma.repository.findFirst({
    where: {
      id: input.repositoryId,
      workspace: { companyId: input.companyId },
    },
    select: {
      id: true,
      analysisStatus: true,
      frameworks: true,
      techStack: true,
      importantFiles: true,
    },
  });

  if (!repository) return null;

  const snapshot = await prisma.repositoryAnalysisSnapshot.findFirst({
    where: {
      repositoryId: input.repositoryId,
      companyId: input.companyId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      error: true,
      analysisSummary: true,
      createdAt: true,
      fileTree: true,
      importantFiles: true,
      routes: true,
      apiRoutes: true,
      serverActions: true,
      prismaModels: true,
      dependencies: true,
      devDependencies: true,
      scripts: true,
      risks: true,
    },
  });

  return buildRepositoryIntelligenceView(snapshot, repository);
}
