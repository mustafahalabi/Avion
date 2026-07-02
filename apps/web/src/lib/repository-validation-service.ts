import { prisma } from "@/lib/prisma";
import type { PackageManagerInfo, ScriptInfo } from "@/lib/repository-analyzer";
import {
  assessRepositoryValidation,
  type RepositoryValidationAssessment,
} from "@/lib/repository-validation-profile";

export interface RepositoryValidationQueryInput {
  readonly repositoryId: string;
  readonly companyId: string;
}

export interface RepositoryValidationView {
  readonly assessment: RepositoryValidationAssessment;
  readonly snapshotId: string | null;
  readonly snapshotStatus: string | null;
  readonly analyzedAt: Date | null;
  readonly hasAnalysis: boolean;
  readonly missingData: readonly string[];
}

/**
 * Parses a JSON snapshot field safely, returning a fallback on failure.
 *
 * @param value - JSON string from snapshot storage.
 * @param fallback - Fallback value when parsing fails.
 * @returns Parsed value or fallback.
 */
function parseJsonField<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Extracts the package manager name from the deterministic analysis summary.
 *
 * @param summary - Analyzer-generated summary string, if any.
 * @returns Recognised package manager name, or null when unavailable.
 */
function parsePackageManagerName(
  summary: string | null
): PackageManagerInfo["name"] | null {
  if (!summary) return null;
  const match = summary.match(/Package manager: ([a-z]+)\./i);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") {
    return name;
  }
  return null;
}

/**
 * Loads the repository validation & environment view for a company-owned repository.
 *
 * Mirrors `getRepositoryIntelligenceView`: it resolves the company-scoped
 * repository plus its latest analysis snapshot, safely parses the stored JSON
 * fields, feeds the pure assessment core, and returns an honest readiness view —
 * including a `blocked` assessment with explicit missing data when no analysis
 * has run yet.
 *
 * @param input - Repository and company identifiers.
 * @returns Validation view, or null when the repository is not found.
 */
export async function getRepositoryValidationView(
  input: RepositoryValidationQueryInput
): Promise<RepositoryValidationView | null> {
  const repository = await prisma.repository.findFirst({
    where: {
      id: input.repositoryId,
      workspace: { companyId: input.companyId },
    },
    select: {
      id: true,
      analysisStatus: true,
      primaryLanguage: true,
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
      analysisSummary: true,
      createdAt: true,
      scripts: true,
      dependencies: true,
      importantFiles: true,
      envInventory: true,
    },
  });

  const frameworks = parseJsonField<string[]>(repository.frameworks, []);
  const techStack = parseJsonField<string[]>(repository.techStack, []);

  if (snapshot === null) {
    const assessment = assessRepositoryValidation({
      scripts: null,
      packageManager: null,
      primaryLanguage: repository.primaryLanguage,
      frameworks,
      techStack,
      hasAnalysis: false,
      hasPackageManifest: false,
    });

    return {
      assessment,
      snapshotId: null,
      snapshotStatus: repository.analysisStatus,
      analyzedAt: null,
      hasAnalysis: false,
      missingData: ["No repository analysis snapshot exists yet."],
    };
  }

  const scripts = parseJsonField<ScriptInfo | null>(snapshot.scripts, null);
  const dependencies = parseJsonField<string[]>(snapshot.dependencies, []);
  const importantFiles = parseJsonField<string[]>(snapshot.importantFiles, []);

  const hasPackageManifest =
    importantFiles.includes("package.json") ||
    importantFiles.includes("src/package.json") ||
    dependencies.length > 0 ||
    (scripts !== null &&
      (scripts.dev !== null ||
        scripts.build !== null ||
        scripts.test !== null ||
        scripts.lint !== null ||
        scripts.typecheck !== null));

  // The analyzer never ingests .env *values*, but since MUS-225 it records the
  // env-var *names* the source references (process.env.X / import.meta.env.X).
  // Older snapshots have no inventory (null) — passed through as "not captured".
  const hasEnvExample = importantFiles.some((file) =>
    /\.env\.example$/i.test(file)
  );
  const referencedEnvVars =
    snapshot.envInventory === null
      ? null
      : parseJsonField<string[]>(snapshot.envInventory, []);

  const assessment = assessRepositoryValidation({
    scripts,
    packageManager: parsePackageManagerName(snapshot.analysisSummary),
    primaryLanguage: repository.primaryLanguage,
    frameworks,
    techStack,
    hasAnalysis: true,
    hasPackageManifest,
    hasEnvExample: hasEnvExample ? true : undefined,
    referencedEnvVars,
  });

  const missingData: string[] = [];
  if (scripts === null) {
    missingData.push("Package scripts unavailable in latest snapshot.");
  }
  if (!hasPackageManifest) {
    missingData.push("No package.json manifest detected in latest snapshot.");
  }

  return {
    assessment,
    snapshotId: snapshot.id,
    snapshotStatus: snapshot.status,
    analyzedAt: snapshot.createdAt,
    hasAnalysis: true,
    missingData,
  };
}
