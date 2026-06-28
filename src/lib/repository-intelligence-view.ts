import type { RouteInfo, RiskFinding, ScriptInfo } from "@/lib/repository-analyzer";

export const REPOSITORY_INTELLIGENCE_ANCHOR = "repository-intelligence" as const;

export interface FileTreeView {
  readonly totalFiles: number | null;
  readonly totalDirs: number | null;
  readonly topLevelDirs: readonly string[];
  readonly byExtension: Readonly<Record<string, number>>;
  readonly importantPaths: readonly string[];
}

export interface PackageManagerView {
  readonly name: string | null;
  readonly evidence: string | null;
}

export interface DatabaseLayerView {
  readonly technology: string | null;
  readonly schemaPaths: readonly string[];
  readonly migrationPaths: readonly string[];
  readonly models: readonly string[];
  readonly unknowns: readonly string[];
}

export interface ApiSurfaceView {
  readonly pages: readonly RouteInfo[];
  readonly apiRoutes: readonly RouteInfo[];
  readonly serverActions: readonly string[];
  readonly middleware: readonly RouteInfo[];
  readonly unknowns: readonly string[];
}

export interface RepositoryIntelligenceView {
  readonly snapshotId: string | null;
  readonly snapshotStatus: string | null;
  readonly snapshotError: string | null;
  readonly analyzedAt: Date | null;
  readonly analysisSummary: string | null;
  readonly reanalysisAvailable: boolean;
  readonly missingData: readonly string[];
  readonly unknowns: readonly string[];
  readonly fileTree: FileTreeView;
  readonly packageManager: PackageManagerView;
  readonly scripts: ScriptInfo | null;
  readonly frameworks: readonly string[];
  readonly techStack: readonly string[];
  readonly apiSurface: ApiSurfaceView;
  readonly databaseLayer: DatabaseLayerView;
  readonly risks: readonly RiskFinding[];
  readonly importantFiles: readonly string[];
}

export interface RepositoryIntelligenceSnapshotInput {
  readonly id: string;
  readonly status: string;
  readonly error: string | null;
  readonly analysisSummary: string | null;
  readonly createdAt: Date;
  readonly fileTree: string;
  readonly importantFiles: string;
  readonly routes: string;
  readonly apiRoutes: string;
  readonly serverActions: string;
  readonly prismaModels: string;
  readonly dependencies: string;
  readonly devDependencies: string;
  readonly scripts: string;
  readonly risks: string;
}

export interface RepositoryIntelligenceRepositoryInput {
  readonly id: string;
  readonly analysisStatus: string;
  readonly frameworks: string;
  readonly techStack: string;
  readonly importantFiles: string;
}

/**
 * Builds the canonical repository intelligence dashboard URL for task briefs.
 *
 * @param repositoryId - Repository identifier.
 * @returns Dashboard URL with intelligence anchor.
 * @example
 * ```ts
 * buildRepositoryIntelligenceUrl("repo_123");
 * // → "/work/repositories/repo_123#repository-intelligence"
 * ```
 */
export function buildRepositoryIntelligenceUrl(repositoryId: string): string {
  return `/work/repositories/${repositoryId}#${REPOSITORY_INTELLIGENCE_ANCHOR}`;
}

/**
 * Parses JSON snapshot fields safely.
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
 * Extracts package manager name from deterministic intelligence summary text.
 *
 * @param summary - Analyzer-generated summary string.
 * @returns Package manager name when present.
 */
function parsePackageManagerFromSummary(summary: string | null): PackageManagerView {
  if (!summary) {
    return { name: null, evidence: null };
  }

  const match = summary.match(/Package manager: ([a-z]+)\./i);
  if (!match) {
    return { name: null, evidence: null };
  }

  return {
    name: match[1].toLowerCase(),
    evidence: "Parsed from latest analysis summary",
  };
}

/**
 * Builds a structured repository intelligence view from the latest analysis snapshot.
 *
 * @param snapshot - Latest repository analysis snapshot row, if any.
 * @param repository - Repository metadata row.
 * @returns Truthful intelligence view with explicit missing data markers.
 */
export function buildRepositoryIntelligenceView(
  snapshot: RepositoryIntelligenceSnapshotInput | null,
  repository: RepositoryIntelligenceRepositoryInput
): RepositoryIntelligenceView {
  const missingData: string[] = [];
  const unknowns: string[] = [];

  if (snapshot === null) {
    missingData.push("No repository analysis snapshot exists yet.");
    return {
      snapshotId: null,
      snapshotStatus: repository.analysisStatus,
      snapshotError: null,
      analyzedAt: null,
      analysisSummary: null,
      reanalysisAvailable: true,
      missingData,
      unknowns,
      fileTree: {
        totalFiles: null,
        totalDirs: null,
        topLevelDirs: [],
        byExtension: {},
        importantPaths: [],
      },
      packageManager: { name: null, evidence: null },
      scripts: null,
      frameworks: parseJsonField<string[]>(repository.frameworks, []),
      techStack: parseJsonField<string[]>(repository.techStack, []),
      apiSurface: {
        pages: [],
        apiRoutes: [],
        serverActions: [],
        middleware: [],
        unknowns: ["Run repository analysis to detect routes and API surface."],
      },
      databaseLayer: {
        technology: null,
        schemaPaths: [],
        migrationPaths: [],
        models: [],
        unknowns: ["Run repository analysis to detect database layer."],
      },
      risks: [],
      importantFiles: parseJsonField<string[]>(repository.importantFiles, []),
    };
  }

  if (snapshot.status === "failed") {
    missingData.push("Latest analysis snapshot failed.");
    if (snapshot.error) {
      unknowns.push(snapshot.error);
    }
  }

  const fileTreeRaw = parseJsonField<Record<string, unknown>>(snapshot.fileTree, {});
  const routes = parseJsonField<RouteInfo[]>(snapshot.routes, []);
  const apiRoutePaths = parseJsonField<string[]>(snapshot.apiRoutes, []);
  const serverActions = parseJsonField<string[]>(snapshot.serverActions, []);
  const scripts = parseJsonField<ScriptInfo | null>(snapshot.scripts, null);
  const prismaModels = parseJsonField<string[] | { name: string }[]>(snapshot.prismaModels, []);
  const risks = parseJsonField<RiskFinding[]>(snapshot.risks, []);
  const importantFiles = parseJsonField<string[]>(snapshot.importantFiles, []);

  const fileTree: FileTreeView = {
    totalFiles: typeof fileTreeRaw.totalFiles === "number" ? fileTreeRaw.totalFiles : null,
    totalDirs: typeof fileTreeRaw.totalDirs === "number" ? fileTreeRaw.totalDirs : null,
    topLevelDirs: Array.isArray(fileTreeRaw.topLevelDirs)
      ? fileTreeRaw.topLevelDirs.filter((item): item is string => typeof item === "string")
      : [],
    byExtension:
      typeof fileTreeRaw.byExtension === "object" && fileTreeRaw.byExtension !== null
        ? (fileTreeRaw.byExtension as Record<string, number>)
        : {},
    importantPaths: Array.isArray(fileTreeRaw.importantPaths)
      ? fileTreeRaw.importantPaths.filter((item): item is string => typeof item === "string")
      : importantFiles,
  };

  if (fileTree.totalFiles === null) {
    missingData.push("File tree summary unavailable in latest snapshot.");
  }

  const packageManager = parsePackageManagerFromSummary(snapshot.analysisSummary);
  if (packageManager.name === null) {
    missingData.push("Package manager not captured in latest snapshot summary.");
  }

  if (scripts === null) {
    missingData.push("Package scripts unavailable in latest snapshot.");
  }

  const modelNames = prismaModels.map((model) => (typeof model === "string" ? model : model.name));
  const schemaPaths = importantFiles.filter((path) => path.includes("schema.prisma"));
  const databaseLayer: DatabaseLayerView = {
    technology: modelNames.length > 0 || schemaPaths.length > 0 ? "prisma" : null,
    schemaPaths,
    migrationPaths: importantFiles.filter((path) => path.includes("prisma/migrations")),
    models: modelNames,
    unknowns:
      modelNames.length > 0
        ? []
        : ["No Prisma models detected in latest snapshot."],
  };

  const apiRoutes = routes.filter((route) => route.type === "api");
  const pages = routes.filter((route) => route.type === "page");
  const middleware = routes.filter((route) => route.type === "middleware");
  const apiSurfaceUnknowns: string[] = [];

  if (pages.length === 0 && apiRoutes.length === 0 && serverActions.length === 0) {
    apiSurfaceUnknowns.push("No routes or server actions detected in latest snapshot.");
  }

  if (apiRoutePaths.length > 0 && apiRoutes.length === 0) {
    apiSurfaceUnknowns.push("API route paths exist but structured route evidence is incomplete.");
  }

  const summaryUnknowns = (snapshot.analysisSummary ?? "")
    .split("Routing unknowns:")
    .slice(1)
    .join("Routing unknowns:")
    .split("Database unknowns:")
    .shift()
    ?.trim();

  if (summaryUnknowns) {
    unknowns.push(summaryUnknowns);
  }

  return {
    snapshotId: snapshot.id,
    snapshotStatus: snapshot.status,
    snapshotError: snapshot.error,
    analyzedAt: snapshot.createdAt,
    analysisSummary: snapshot.analysisSummary,
    reanalysisAvailable: true,
    missingData,
    unknowns,
    fileTree,
    packageManager,
    scripts,
    frameworks: parseJsonField<string[]>(repository.frameworks, []),
    techStack: parseJsonField<string[]>(repository.techStack, []),
    apiSurface: {
      pages,
      apiRoutes,
      serverActions,
      middleware,
      unknowns: apiSurfaceUnknowns,
    },
    databaseLayer,
    risks,
    importantFiles,
  };
}
