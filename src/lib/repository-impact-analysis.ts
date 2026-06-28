import type {
  ComparisonOutcome,
  SnapshotComparisonResult,
} from "./repository-snapshot-comparison";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImpactLevel = "none" | "low" | "medium" | "high" | "critical";
export type ConfidenceLevel = "high" | "medium" | "low";
export type ActionPriority = "blocking" | "high" | "medium" | "low";

export interface ImpactItem {
  title: string;
  description: string;
  area: string;
  impactLevel: ImpactLevel;
  affectedRoles: string[];
  evidence: string[];
  recommendedAction: string;
  reason: string;
}

export interface RecommendedAction {
  action: string;
  area: string;
  priority: ActionPriority;
  assignedRoles: string[];
  evidence: string[];
}

export interface ImpactAnalysisResult {
  repositoryId: string;
  oldSnapshotId: string;
  newSnapshotId: string;
  analyzedAt: string;
  overallImpactLevel: ImpactLevel;
  affectedAreas: string[];
  impactItems: ImpactItem[];
  affectedRoles: string[];
  qaFocusAreas: string[];
  releaseRisks: string[];
  recommendedActions: RecommendedAction[];
  blockingConcerns: string[];
  confidence: ConfidenceLevel;
  evidence: string[];
  summary: string;
  limitations: string[];
}

export interface ImpactAnalysisError {
  error: true;
  reason: string;
  repositoryId: string | null;
  oldSnapshotId: string | null;
  newSnapshotId: string | null;
  analyzedAt: string;
}

export type ImpactAnalysisOutcome = ImpactAnalysisResult | ImpactAnalysisError;

// ─── Role constants ───────────────────────────────────────────────────────────

const ROLE_CTO = "CTO";
const ROLE_BACKEND = "Backend Engineer";
const ROLE_SECURITY = "Security Engineer";
const ROLE_QA = "QA Engineer";
const ROLE_EM = "Engineering Manager";
const ROLE_DEVOPS = "DevOps";
const ROLE_RELEASE = "Release Manager";

// ─── Auth detection ───────────────────────────────────────────────────────────

const AUTH_ROUTE_PATTERNS: RegExp[] = [
  /\/auth\//i,
  /\/login/i,
  /\/logout/i,
  /(^|\/)\[\[\.\.\.sign-in\]\](\/|$)/i,
  /(^|\/)\[\[\.\.\.sign-up\]\](\/|$)/i,
  /(^|\/)sign-?in(\/|$|\.)/i,
  /(^|\/)sign-?up(\/|$|\.)/i,
  /\/register/i,
  /\/oauth\//i,
  /\/sso\//i,
  /\/callback/i,
  /\/token\//i,
  /\/session\//i,
];

const AUTH_ACTION_PATTERNS: RegExp[] = [
  /\/auth\//i,
  /\/actions\/auth/i,
  /login/i,
  /logout/i,
  /sign-?in/i,
  /sign-?up/i,
  /register/i,
  /password/i,
  /credential/i,
  /session/i,
];

const AUTH_FILE_PATTERNS: RegExp[] = [
  /middleware\.ts$/i,
  /middleware\.js$/i,
  /proxy\.ts$/i,
  /proxy\.js$/i,
  /auth\.ts$/i,
  /auth\.config\./i,
];

const AUTH_DEPS = new Set([
  "next-auth",
  "@auth/core",
  "@clerk/nextjs",
  "@clerk/clerk-react",
  "lucia",
  "better-auth",
  "passport",
  "passport-local",
  "jsonwebtoken",
  "bcrypt",
  "bcryptjs",
  "argon2",
  "@hapi/iron",
  "iron-session",
]);

const ADMIN_PATH_PATTERNS: RegExp[] = [
  /\/admin\//i,
  /\/superadmin/i,
];

const BUILD_CRITICAL_SCRIPTS = new Set(["build", "dev"]);
const CI_SCRIPTS = new Set(["build", "test", "lint", "typecheck", "dev"]);
const DOC_EXTENSIONS = /\.(md|mdx|txt|rst)$/i;
const PACKAGE_MANIFEST_PATTERNS = [/^package\.json$/i, /\/package\.json$/i];
const TYPESCRIPT_CONFIG_PATTERNS = [/^tsconfig(?:\.[^.]+)?\.json$/i, /\/tsconfig(?:\.[^.]+)?\.json$/i];
const NEXT_CONFIG_PATTERNS = [/^next\.config\.(?:js|mjs|cjs|ts)$/i, /\/next\.config\.(?:js|mjs|cjs|ts)$/i];
const LINT_CONFIG_PATTERNS = [
  /^eslint\.config\.(?:js|mjs|cjs|ts)$/i,
  /\/eslint\.config\.(?:js|mjs|cjs|ts)$/i,
  /^\.eslintrc(?:\.(?:json|js|cjs|yaml|yml))?$/i,
  /\/\.eslintrc(?:\.(?:json|js|cjs|yaml|yml))?$/i,
];
const TEST_CONFIG_PATTERNS = [
  /(^|\/)(?:vitest|jest|playwright|cypress)\.config\.(?:js|mjs|cjs|ts)$/i,
];
const BUILD_DEPLOY_CONFIG_PATTERNS = [
  /(^|\/)(?:vercel|netlify|docker-compose)\.(?:json|toml|ya?ml)$/i,
  /(^|\/)Dockerfile$/i,
  /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i,
  /(^|\/)turbo\.json$/i,
];
const APP_LAYOUT_PATTERNS = [
  /(^|\/)app\/layout\.(?:js|jsx|ts|tsx)$/i,
  /(^|\/)src\/app\/layout\.(?:js|jsx|ts|tsx)$/i,
  /(^|\/)app\/(?:.*\/)?layout\.(?:js|jsx|ts|tsx)$/i,
  /(^|\/)src\/app\/(?:.*\/)?layout\.(?:js|jsx|ts|tsx)$/i,
];

// ─── Level utilities ──────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<ImpactLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  blocking: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function maxLevel(a: ImpactLevel, b: ImpactLevel): ImpactLevel {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}

function levelToPriority(level: ImpactLevel): ActionPriority {
  if (level === "critical") return "blocking";
  if (level === "high") return "high";
  if (level === "medium") return "medium";
  return "low";
}

// ─── Path detection helpers ───────────────────────────────────────────────────

function isAuthRoute(path: string): boolean {
  return AUTH_ROUTE_PATTERNS.some((p) => p.test(path));
}

function isAuthAction(path: string): boolean {
  return AUTH_ACTION_PATTERNS.some((p) => p.test(path));
}

function isAuthFile(path: string): boolean {
  return AUTH_FILE_PATTERNS.some((p) => p.test(path));
}

function isAdminPath(path: string): boolean {
  return ADMIN_PATH_PATTERNS.some((p) => p.test(path));
}

function isDocFile(path: string): boolean {
  return DOC_EXTENSIONS.test(path);
}

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(path));
}

type ImportantFileCategory =
  | "package"
  | "typescript"
  | "next"
  | "lint"
  | "test"
  | "deployment"
  | "layout"
  | "middleware";

interface ImportantFileChange {
  path: string;
  changeType: "added" | "removed" | "changed";
}

function classifyImportantFile(path: string): ImportantFileCategory | null {
  if (isAuthFile(path)) return "middleware";
  if (matchesAny(path, PACKAGE_MANIFEST_PATTERNS)) return "package";
  if (matchesAny(path, TYPESCRIPT_CONFIG_PATTERNS)) return "typescript";
  if (matchesAny(path, NEXT_CONFIG_PATTERNS)) return "next";
  if (matchesAny(path, LINT_CONFIG_PATTERNS)) return "lint";
  if (matchesAny(path, TEST_CONFIG_PATTERNS)) return "test";
  if (matchesAny(path, BUILD_DEPLOY_CONFIG_PATTERNS)) return "deployment";
  if (matchesAny(path, APP_LAYOUT_PATTERNS)) return "layout";
  return null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, T>)
    : {};
}

function isMissingNestedField(value: unknown, field: string): boolean {
  return !value || typeof value !== "object" || !(field in value);
}

function normalizeSnapshotComparisonResult(
  comparisonResult: SnapshotComparisonResult,
): SnapshotComparisonResult {
  const partial = comparisonResult as Partial<SnapshotComparisonResult>;
  const routeChanges = (partial.routeChanges ?? {}) as Partial<SnapshotComparisonResult["routeChanges"]>;
  const apiRouteChanges = (partial.apiRouteChanges ?? {}) as Partial<SnapshotComparisonResult["apiRouteChanges"]>;
  const serverActionChanges = (partial.serverActionChanges ?? {}) as Partial<SnapshotComparisonResult["serverActionChanges"]>;
  const prismaModelChanges = (partial.prismaModelChanges ?? {}) as Partial<SnapshotComparisonResult["prismaModelChanges"]>;
  const dependencyChanges = (partial.dependencyChanges ?? {}) as Partial<SnapshotComparisonResult["dependencyChanges"]>;
  const scriptChanges = (partial.scriptChanges ?? {}) as Partial<SnapshotComparisonResult["scriptChanges"]>;
  const testChanges = (partial.testChanges ?? {}) as Partial<SnapshotComparisonResult["testChanges"]>;
  const riskChanges = (partial.riskChanges ?? {}) as Partial<SnapshotComparisonResult["riskChanges"]>;
  const fileSummary = (partial.fileSummary ?? {}) as Partial<SnapshotComparisonResult["fileSummary"]>;

  const normalizedLimitations = normalizeStringArray(partial.limitations);
  const normalizedMissingPaths = [
    ["changeCounts", partial.changeCounts],
    ["fileSummary", partial.fileSummary],
    ["fileSummary.categoryChanges", partial.fileSummary?.categoryChanges],
    ["addedFiles", partial.addedFiles],
    ["removedFiles", partial.removedFiles],
    ["changedFiles", partial.changedFiles],
    ["routeChanges", partial.routeChanges],
    ["routeChanges.added", partial.routeChanges?.added],
    ["routeChanges.removed", partial.routeChanges?.removed],
    ["routeChanges.changed", partial.routeChanges?.changed],
    ["apiRouteChanges", partial.apiRouteChanges],
    ["apiRouteChanges.added", partial.apiRouteChanges?.added],
    ["apiRouteChanges.removed", partial.apiRouteChanges?.removed],
    ["serverActionChanges", partial.serverActionChanges],
    ["serverActionChanges.added", partial.serverActionChanges?.added],
    ["serverActionChanges.removed", partial.serverActionChanges?.removed],
    ["prismaModelChanges", partial.prismaModelChanges],
    ["prismaModelChanges.added", partial.prismaModelChanges?.added],
    ["prismaModelChanges.removed", partial.prismaModelChanges?.removed],
    ["dependencyChanges", partial.dependencyChanges],
    ["dependencyChanges.added", partial.dependencyChanges?.added],
    ["dependencyChanges.removed", partial.dependencyChanges?.removed],
    ["dependencyChanges.addedDev", partial.dependencyChanges?.addedDev],
    ["dependencyChanges.removedDev", partial.dependencyChanges?.removedDev],
    ["scriptChanges", partial.scriptChanges],
    ["scriptChanges.added", partial.scriptChanges?.added],
    ["scriptChanges.removed", partial.scriptChanges?.removed],
    ["scriptChanges.changed", partial.scriptChanges?.changed],
    ["testChanges", partial.testChanges],
    ["testChanges.added", partial.testChanges?.added],
    ["testChanges.removed", partial.testChanges?.removed],
    ["testChanges.oldCount", isMissingNestedField(partial.testChanges, "oldCount") ? undefined : partial.testChanges?.oldCount],
    ["testChanges.newCount", isMissingNestedField(partial.testChanges, "newCount") ? undefined : partial.testChanges?.newCount],
    ["riskChanges", partial.riskChanges],
    ["riskChanges.new", partial.riskChanges?.new],
    ["riskChanges.resolved", partial.riskChanges?.resolved],
    ["affectedAreas", partial.affectedAreas],
    ["evidence", partial.evidence],
    ["limitations", partial.limitations],
  ]
    .filter(([, value]) => value === undefined)
    .map(([path]) => path);

  const limitations =
    normalizedMissingPaths.length > 0
      ? [
          ...normalizedLimitations,
          `Partial comparison data was normalized with safe empty defaults for missing field(s): ${normalizedMissingPaths.join(", ")}. Impact may be understated for areas without comparison data.`,
        ]
      : normalizedLimitations;

  return {
    oldSnapshotId: partial.oldSnapshotId ?? "",
    newSnapshotId: partial.newSnapshotId ?? "",
    repositoryId: partial.repositoryId ?? "",
    comparedAt: partial.comparedAt ?? "",
    hasChanges: partial.hasChanges ?? false,
    changeCounts: partial.changeCounts ?? {
      addedImportantFiles: 0,
      removedImportantFiles: 0,
      addedRoutes: 0,
      removedRoutes: 0,
      changedRoutes: 0,
      addedApiRoutes: 0,
      removedApiRoutes: 0,
      addedServerActions: 0,
      removedServerActions: 0,
      addedPrismaModels: 0,
      removedPrismaModels: 0,
      addedDependencies: 0,
      removedDependencies: 0,
      addedDevDependencies: 0,
      removedDevDependencies: 0,
      addedScripts: 0,
      removedScripts: 0,
      changedScripts: 0,
      addedTestFiles: 0,
      removedTestFiles: 0,
      newRisks: 0,
      resolvedRisks: 0,
    },
    fileSummary: {
      totalFilesOld: normalizeNumber(fileSummary.totalFilesOld),
      totalFilesNew: normalizeNumber(fileSummary.totalFilesNew),
      totalFilesDelta: normalizeNumber(fileSummary.totalFilesDelta),
      totalDirsOld: normalizeNumber(fileSummary.totalDirsOld),
      totalDirsNew: normalizeNumber(fileSummary.totalDirsNew),
      categoryChanges: normalizeRecord(fileSummary.categoryChanges),
    },
    addedFiles: normalizeStringArray(partial.addedFiles),
    removedFiles: normalizeStringArray(partial.removedFiles),
    changedFiles: normalizeStringArray(partial.changedFiles),
    routeChanges: {
      added: normalizeArray(routeChanges.added),
      removed: normalizeArray(routeChanges.removed),
      changed: normalizeArray(routeChanges.changed),
    },
    apiRouteChanges: {
      added: normalizeStringArray(apiRouteChanges.added),
      removed: normalizeStringArray(apiRouteChanges.removed),
    },
    serverActionChanges: {
      added: normalizeStringArray(serverActionChanges.added),
      removed: normalizeStringArray(serverActionChanges.removed),
    },
    prismaModelChanges: {
      added: normalizeStringArray(prismaModelChanges.added),
      removed: normalizeStringArray(prismaModelChanges.removed),
    },
    dependencyChanges: {
      added: normalizeStringArray(dependencyChanges.added),
      removed: normalizeStringArray(dependencyChanges.removed),
      addedDev: normalizeStringArray(dependencyChanges.addedDev),
      removedDev: normalizeStringArray(dependencyChanges.removedDev),
    },
    scriptChanges: {
      added: normalizeArray(scriptChanges.added),
      removed: normalizeArray(scriptChanges.removed),
      changed: normalizeArray(scriptChanges.changed),
    },
    testChanges: {
      added: normalizeStringArray(testChanges.added),
      removed: normalizeStringArray(testChanges.removed),
      oldCount: normalizeNumber(testChanges.oldCount),
      newCount: normalizeNumber(testChanges.newCount),
    },
    riskChanges: {
      new: normalizeArray(riskChanges.new),
      resolved: normalizeArray(riskChanges.resolved),
    },
    affectedAreas: normalizeStringArray(partial.affectedAreas),
    evidence: normalizeArray(partial.evidence),
    summary: partial.summary ?? "",
    limitations,
  };
}

// ─── Documentation-only detection ────────────────────────────────────────────

function isDocumentationOnlyChange(result: SnapshotComparisonResult): boolean {
  const functionalAreas = [
    "apiRoutes",
    "serverActions",
    "prismaModels",
    "routes",
    "dependencies",
    "scripts",
    "tests",
    "risks",
  ];
  if (functionalAreas.some((area) => result.affectedAreas.includes(area))) return false;

  // No important file adds/removes
  if (result.addedFiles.length > 0 || result.removedFiles.length > 0) return false;

  // Only doc category changes in file summary
  if (!result.affectedAreas.includes("files")) return false;
  const categoryKeys = Object.keys(result.fileSummary.categoryChanges);
  return categoryKeys.length > 0 && categoryKeys.every((k) => k === "doc");
}

// ─── Impact Item Builders ─────────────────────────────────────────────────────

function buildDatabaseImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { prismaModelChanges } = result;

  if (prismaModelChanges.added.length > 0) {
    items.push({
      title: "Prisma model(s) added",
      description: `${prismaModelChanges.added.length} Prisma model(s) added: ${prismaModelChanges.added.join(", ")}.`,
      area: "database",
      impactLevel: "high",
      affectedRoles: [ROLE_CTO, ROLE_BACKEND, ROLE_QA, ROLE_RELEASE],
      evidence: prismaModelChanges.added.map((m) => `Prisma model added: ${m}`),
      recommendedAction:
        "Backend Engineer should verify that migration files exist and are compatible with existing data. QA Engineer should regression-test all flows that read or write the affected models.",
      reason:
        "New Prisma models introduce database schema changes that require migration and compatibility review.",
    });
  }

  if (prismaModelChanges.removed.length > 0) {
    items.push({
      title: "Prisma model(s) removed",
      description: `${prismaModelChanges.removed.length} Prisma model(s) removed: ${prismaModelChanges.removed.join(", ")}.`,
      area: "database",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_BACKEND, ROLE_QA, ROLE_RELEASE],
      evidence: prismaModelChanges.removed.map((m) => `Prisma model removed: ${m}`),
      recommendedAction:
        "CTO and Backend Engineer must confirm that model removal is intentional and that no active code paths depend on the removed model. Release Manager should block deployment until migration safety is verified.",
      reason:
        "Removing a Prisma model drops the corresponding database table and can cause irreversible data loss if not planned.",
    });
  }

  return items;
}

function buildApiRouteImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { apiRouteChanges } = result;

  const authAdded = apiRouteChanges.added.filter(isAuthRoute);
  const authRemoved = apiRouteChanges.removed.filter(isAuthRoute);
  const regularAdded = apiRouteChanges.added.filter((p) => !isAuthRoute(p));
  const regularRemoved = apiRouteChanges.removed.filter((p) => !isAuthRoute(p));

  if (authAdded.length > 0 || authRemoved.length > 0) {
    items.push({
      title: "Auth-related API route(s) changed",
      description: `Authentication-sensitive API route(s) changed. Added: ${authAdded.join(", ") || "none"}. Removed: ${authRemoved.join(", ") || "none"}.`,
      area: "auth",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_SECURITY, ROLE_BACKEND, ROLE_QA],
      evidence: [
        ...authAdded.map((p) => `Auth API route added: ${p}`),
        ...authRemoved.map((p) => `Auth API route removed: ${p}`),
      ],
      recommendedAction:
        "Security Engineer must review authentication API route changes for proper authorization checks, input validation, and rate limiting before release.",
      reason:
        "Authentication API routes are high-value attack targets. Changes require security sign-off.",
    });
  }

  if (regularAdded.length > 0) {
    items.push({
      title: "API route(s) added",
      description: `${regularAdded.length} API route(s) added: ${regularAdded.join(", ")}.`,
      area: "api",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_QA, ROLE_RELEASE],
      evidence: regularAdded.map((p) => `API route added: ${p}`),
      recommendedAction:
        "QA Engineer should add regression coverage for all new API routes. Backend Engineer should confirm authorization is applied to each new route.",
      reason:
        "New API routes extend the application's public surface area and require access control and regression testing.",
    });
  }

  if (regularRemoved.length > 0) {
    items.push({
      title: "API route(s) removed",
      description: `${regularRemoved.length} API route(s) removed: ${regularRemoved.join(", ")}.`,
      area: "api",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_QA, ROLE_RELEASE],
      evidence: regularRemoved.map((p) => `API route removed: ${p}`),
      recommendedAction:
        "Backend Engineer should verify that removed API routes are no longer consumed by any active client or integration. Release Manager should check for breaking changes.",
      reason:
        "Removing API routes can break existing consumers and integrations that depend on those endpoints.",
    });
  }

  return items;
}

function buildServerActionImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { serverActionChanges } = result;

  const authAdded = serverActionChanges.added.filter(isAuthAction);
  const authRemoved = serverActionChanges.removed.filter(isAuthAction);
  const regularAdded = serverActionChanges.added.filter((p) => !isAuthAction(p));
  const regularRemoved = serverActionChanges.removed.filter((p) => !isAuthAction(p));

  if (authAdded.length > 0 || authRemoved.length > 0) {
    items.push({
      title: "Auth-related server action(s) changed",
      description: `Authentication-sensitive server action(s) changed. Added: ${authAdded.join(", ") || "none"}. Removed: ${authRemoved.join(", ") || "none"}.`,
      area: "auth",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_SECURITY, ROLE_BACKEND, ROLE_QA],
      evidence: [
        ...authAdded.map((p) => `Auth server action added: ${p}`),
        ...authRemoved.map((p) => `Auth server action removed: ${p}`),
      ],
      recommendedAction:
        "Security Engineer must review authentication-related server action changes. Verify authorization, input validation, and error handling are correct.",
      reason:
        "Server actions touching authentication or session logic are a frequent source of privilege escalation vulnerabilities.",
    });
  }

  if (regularAdded.length > 0) {
    items.push({
      title: "Server action(s) added",
      description: `${regularAdded.length} server action module(s) added: ${regularAdded.join(", ")}.`,
      area: "serverActions",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_QA],
      evidence: regularAdded.map((p) => `Server action added: ${p}`),
      recommendedAction:
        "QA Engineer should verify that new server actions are covered by tests and that authorization is applied where required.",
      reason:
        "New server actions introduce mutation paths that must be tested and access-controlled.",
    });
  }

  if (regularRemoved.length > 0) {
    items.push({
      title: "Server action(s) removed",
      description: `${regularRemoved.length} server action module(s) removed: ${regularRemoved.join(", ")}.`,
      area: "serverActions",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_QA],
      evidence: regularRemoved.map((p) => `Server action removed: ${p}`),
      recommendedAction:
        "Backend Engineer should confirm that removed server actions are no longer referenced from any client component or page. QA Engineer should test affected UI flows.",
      reason:
        "Removing server actions can silently break form submissions and mutation flows if clients still reference them.",
    });
  }

  return items;
}

function buildRoutingImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { routeChanges } = result;

  const sensitiveAdded = routeChanges.added.filter((r) => isAuthRoute(r.path) || isAdminPath(r.path));
  const sensitiveRemoved = routeChanges.removed.filter((r) => isAuthRoute(r.path) || isAdminPath(r.path));
  const regularAdded = routeChanges.added.filter((r) => !isAuthRoute(r.path) && !isAdminPath(r.path));
  const regularRemoved = routeChanges.removed.filter((r) => !isAuthRoute(r.path) && !isAdminPath(r.path));

  if (sensitiveAdded.length > 0 || sensitiveRemoved.length > 0) {
    items.push({
      title: "Auth/admin page route(s) changed",
      description: `Security-sensitive page route(s) changed. Added: ${sensitiveAdded.map((r) => r.path).join(", ") || "none"}. Removed: ${sensitiveRemoved.map((r) => r.path).join(", ") || "none"}.`,
      area: "auth",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_SECURITY, ROLE_BACKEND, ROLE_QA],
      evidence: [
        ...sensitiveAdded.map((r) => `Auth/admin route added: ${r.path} (${r.type})`),
        ...sensitiveRemoved.map((r) => `Auth/admin route removed: ${r.path} (${r.type})`),
      ],
      recommendedAction:
        "Security Engineer must verify that authentication and authorization guards are correctly applied to all changed auth/admin routes.",
      reason:
        "Auth and admin routes control access to privileged functionality. Changes require security review.",
    });
  }

  if (regularAdded.length > 0) {
    items.push({
      title: "Page route(s) added",
      description: `${regularAdded.length} page route(s) added: ${regularAdded.map((r) => r.path).join(", ")}.`,
      area: "routing",
      impactLevel: "medium",
      affectedRoles: [ROLE_QA, ROLE_RELEASE],
      evidence: regularAdded.map((r) => `Route added: ${r.path} (${r.type})`),
      recommendedAction:
        "QA Engineer should smoke-test all new pages and verify that navigation and access control are working correctly.",
      reason:
        "New pages extend the application's navigational surface and require functional testing.",
    });
  }

  if (regularRemoved.length > 0) {
    items.push({
      title: "Page route(s) removed",
      description: `${regularRemoved.length} page route(s) removed: ${regularRemoved.map((r) => r.path).join(", ")}.`,
      area: "routing",
      impactLevel: "medium",
      affectedRoles: [ROLE_QA, ROLE_RELEASE],
      evidence: regularRemoved.map((r) => `Route removed: ${r.path} (${r.type})`),
      recommendedAction:
        "Release Manager should verify that removed pages have appropriate redirects in place to avoid broken links for existing users.",
      reason:
        "Removed pages can create broken navigation flows or dead bookmarks for existing users.",
    });
  }

  if (routeChanges.changed.length > 0) {
    items.push({
      title: "Route type(s) changed",
      description: `${routeChanges.changed.length} route(s) changed type: ${routeChanges.changed.map((c) => c.path).join(", ")}.`,
      area: "routing",
      impactLevel: "medium",
      affectedRoles: [ROLE_BACKEND, ROLE_QA],
      evidence: routeChanges.changed.map((c) => `Route type changed: ${c.path} (${c.oldValue} → ${c.newValue})`),
      recommendedAction:
        "Backend Engineer should verify that route type changes are intentional and that Next.js rendering behavior is correct for all affected paths.",
      reason:
        "Route type changes (e.g., page → layout) alter rendering behavior and may affect data loading.",
    });
  }

  return items;
}

function buildDependencyImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { dependencyChanges } = result;

  const authDepsAdded = dependencyChanges.added.filter((d) => AUTH_DEPS.has(d));
  const authDepsRemoved = dependencyChanges.removed.filter((d) => AUTH_DEPS.has(d));
  const regularAdded = dependencyChanges.added.filter((d) => !AUTH_DEPS.has(d));
  const regularRemoved = dependencyChanges.removed.filter((d) => !AUTH_DEPS.has(d));

  if (authDepsAdded.length > 0 || authDepsRemoved.length > 0) {
    items.push({
      title: "Authentication library dependency changed",
      description: `Auth-related dependencies changed. Added: ${authDepsAdded.join(", ") || "none"}. Removed: ${authDepsRemoved.join(", ") || "none"}.`,
      area: "auth",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_SECURITY, ROLE_BACKEND, ROLE_QA],
      evidence: [
        ...authDepsAdded.map((d) => `Auth dependency added: ${d}`),
        ...authDepsRemoved.map((d) => `Auth dependency removed: ${d}`),
      ],
      recommendedAction:
        "Security Engineer must review all changes to authentication library dependencies, including known vulnerabilities, version pinning, and migration impact.",
      reason:
        "Authentication library changes directly affect session management, credential handling, and access control.",
    });
  }

  if (regularAdded.length > 0) {
    items.push({
      title: "Production dependency added",
      description: `${regularAdded.length} production dependency(-ies) added: ${regularAdded.join(", ")}.`,
      area: "dependencies",
      impactLevel: "medium",
      affectedRoles: [ROLE_SECURITY, ROLE_DEVOPS, ROLE_BACKEND],
      evidence: regularAdded.map((d) => `Dependency added: ${d}`),
      recommendedAction:
        "Security Engineer should review each added package for known vulnerabilities (CVEs). DevOps should verify that lockfile changes are committed and that the build pipeline accepts the new dependencies.",
      reason:
        "New production dependencies expand the application's attack surface and require supply chain review.",
    });
  }

  if (regularRemoved.length > 0) {
    items.push({
      title: "Production dependency removed",
      description: `${regularRemoved.length} production dependency(-ies) removed: ${regularRemoved.join(", ")}.`,
      area: "dependencies",
      impactLevel: "medium",
      affectedRoles: [ROLE_BACKEND, ROLE_QA],
      evidence: regularRemoved.map((d) => `Dependency removed: ${d}`),
      recommendedAction:
        "Backend Engineer should verify that no remaining code imports from the removed package(s). QA Engineer should run full regression to detect missing module errors at runtime.",
      reason:
        "Removing dependencies can cause runtime import errors if any code paths still reference the removed package.",
    });
  }

  if (dependencyChanges.addedDev.length > 0) {
    items.push({
      title: "Dev dependency added",
      description: `${dependencyChanges.addedDev.length} dev dependency(-ies) added: ${dependencyChanges.addedDev.join(", ")}.`,
      area: "dependencies",
      impactLevel: "low",
      affectedRoles: [ROLE_BACKEND, ROLE_DEVOPS],
      evidence: dependencyChanges.addedDev.map((d) => `Dev dependency added: ${d}`),
      recommendedAction:
        "DevOps should verify that new dev dependencies do not conflict with the build pipeline or CI configuration.",
      reason:
        "Dev dependencies affect build tooling and CI pipelines even though they are not bundled into production.",
    });
  }

  if (dependencyChanges.removedDev.length > 0) {
    items.push({
      title: "Dev dependency removed",
      description: `${dependencyChanges.removedDev.length} dev dependency(-ies) removed: ${dependencyChanges.removedDev.join(", ")}.`,
      area: "dependencies",
      impactLevel: "low",
      affectedRoles: [ROLE_BACKEND, ROLE_DEVOPS],
      evidence: dependencyChanges.removedDev.map((d) => `Dev dependency removed: ${d}`),
      recommendedAction:
        "DevOps should confirm that removed dev dependencies are not referenced in any build scripts, CI workflows, or configuration files.",
      reason:
        "Removing dev dependencies can break build scripts and CI pipelines if they are still referenced.",
    });
  }

  return items;
}

function buildScriptImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { scriptChanges } = result;

  const buildScriptsChanged = scriptChanges.changed.filter((s) => BUILD_CRITICAL_SCRIPTS.has(s.name));
  const ciScriptsChanged = scriptChanges.changed.filter((s) => CI_SCRIPTS.has(s.name) && !BUILD_CRITICAL_SCRIPTS.has(s.name));
  const ciScriptsRemoved = scriptChanges.removed.filter((s) => CI_SCRIPTS.has(s.name));

  if (buildScriptsChanged.length > 0) {
    items.push({
      title: "Build/dev script changed",
      description: `Critical script(s) changed: ${buildScriptsChanged.map((s) => `${s.name} ("${s.oldValue}" → "${s.newValue}")`).join("; ")}.`,
      area: "build",
      impactLevel: "high",
      affectedRoles: [ROLE_DEVOPS, ROLE_RELEASE, ROLE_BACKEND],
      evidence: buildScriptsChanged.map((s) => `Script changed: ${s.name} (oldValue: ${s.oldValue ?? "none"}, newValue: ${s.newValue ?? "none"})`),
      recommendedAction:
        "DevOps must verify that the changed build/dev script produces the expected output locally and in CI. Release Manager should delay deployment until build stability is confirmed.",
      reason:
        "Changes to build scripts can cause CI pipeline failures or produce incorrect build artifacts.",
    });
  }

  if (ciScriptsChanged.length > 0) {
    items.push({
      title: "CI/test script changed",
      description: `CI-relevant script(s) changed: ${ciScriptsChanged.map((s) => s.name).join(", ")}.`,
      area: "build",
      impactLevel: "medium",
      affectedRoles: [ROLE_DEVOPS, ROLE_QA],
      evidence: ciScriptsChanged.map((s) => `Script changed: ${s.name} (${s.oldValue} → ${s.newValue})`),
      recommendedAction:
        "DevOps and QA Engineer should verify that CI pipeline steps using the changed scripts still pass correctly.",
      reason:
        "Changes to test, lint, or typecheck scripts affect CI reliability and quality gates.",
    });
  }

  if (ciScriptsRemoved.length > 0) {
    items.push({
      title: "CI/build script removed",
      description: `Script(s) removed: ${ciScriptsRemoved.map((s) => s.name).join(", ")}.`,
      area: "build",
      impactLevel: "high",
      affectedRoles: [ROLE_DEVOPS, ROLE_RELEASE],
      evidence: ciScriptsRemoved.map((s) => `Script removed: ${s.name} (was: ${s.value})`),
      recommendedAction:
        "DevOps must verify that no CI pipeline step depends on the removed script(s). Release Manager should block release if a critical pipeline step is missing.",
      reason:
        "Removing build or CI scripts can silently break deployment pipelines.",
    });
  }

  // Scripts added (non-CI) are low impact
  const newNonCiScripts = scriptChanges.added.filter((s) => !CI_SCRIPTS.has(s.name));
  if (newNonCiScripts.length > 0) {
    items.push({
      title: "Non-CI script(s) added",
      description: `${newNonCiScripts.length} script(s) added: ${newNonCiScripts.map((s) => s.name).join(", ")}.`,
      area: "build",
      impactLevel: "low",
      affectedRoles: [ROLE_BACKEND],
      evidence: newNonCiScripts.map((s) => `Script added: ${s.name} (${s.value})`),
      recommendedAction:
        "Backend Engineer should document the purpose of newly added scripts if they are intended for CI or release workflows.",
      reason:
        "New scripts with unknown CI intent should be documented to prevent accidental misuse.",
    });
  }

  return items;
}

function buildTestImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { testChanges } = result;

  if (testChanges.removed.length > 0) {
    items.push({
      title: "Test file(s) removed",
      description: `${testChanges.removed.length} test file(s) removed: ${testChanges.removed.join(", ")}.`,
      area: "tests",
      impactLevel: "high",
      affectedRoles: [ROLE_QA, ROLE_EM],
      evidence: testChanges.removed.map((f) => `Test file removed: ${f}`),
      recommendedAction:
        "QA Engineer and Engineering Manager must review removed test files. Block release until it is confirmed that coverage for affected functionality is maintained or the tested code was also removed.",
      reason:
        "Removing test files creates coverage gaps that can allow regressions to reach production undetected.",
    });
  }

  if (testChanges.added.length > 0) {
    items.push({
      title: "Test file(s) added",
      description: `${testChanges.added.length} test file(s) added: ${testChanges.added.join(", ")}.`,
      area: "tests",
      impactLevel: "low",
      affectedRoles: [ROLE_QA],
      evidence: testChanges.added.map((f) => `Test file added: ${f}`),
      recommendedAction:
        "QA Engineer should verify that new tests pass and are included in the CI pipeline.",
      reason:
        "New test files improve coverage and should be confirmed as working in CI.",
    });
  }

  return items;
}

function buildRiskImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { riskChanges } = result;

  const securityRisks = riskChanges.new.filter((r) => r.category === "security");
  const highNonSecurityRisks = riskChanges.new.filter((r) => r.severity === "high" && r.category !== "security");
  const otherNewRisks = riskChanges.new.filter((r) => r.severity !== "high" && r.category !== "security");

  if (securityRisks.length > 0) {
    items.push({
      title: "New security risk finding(s)",
      description: `${securityRisks.length} new security risk(s) introduced: ${securityRisks.map((r) => r.description).join("; ")}.`,
      area: "security",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_SECURITY, ROLE_BACKEND],
      evidence: securityRisks.map((r) => `New risk (${r.severity}/security): ${r.description}`),
      recommendedAction:
        "Security Engineer must review and remediate all new security risk findings before release.",
      reason:
        "New security risk findings indicate potential vulnerabilities that could be exploited if left unaddressed.",
    });
  }

  if (highNonSecurityRisks.length > 0) {
    items.push({
      title: "New high-severity risk finding(s)",
      description: `${highNonSecurityRisks.length} new high-severity risk(s): ${highNonSecurityRisks.map((r) => r.description).join("; ")}.`,
      area: "risks",
      impactLevel: "high",
      affectedRoles: [ROLE_CTO, ROLE_BACKEND, ROLE_QA],
      evidence: highNonSecurityRisks.map((r) => `New risk (high/${r.category}): ${r.description}`),
      recommendedAction:
        "CTO and Backend Engineer should review new high-severity risk findings and create remediation tasks before the next release.",
      reason:
        "High-severity risks indicate systemic issues that are likely to cause incidents if not addressed.",
    });
  }

  if (otherNewRisks.length > 0) {
    items.push({
      title: "New medium/low risk finding(s)",
      description: `${otherNewRisks.length} new medium/low-severity risk(s) introduced.`,
      area: "risks",
      impactLevel: "medium",
      affectedRoles: [ROLE_QA, ROLE_BACKEND],
      evidence: otherNewRisks.map((r) => `New risk (${r.severity}/${r.category}): ${r.description}`),
      recommendedAction:
        "QA Engineer should log the new risk findings as improvement tasks and schedule them for the next sprint.",
      reason:
        "New risk findings, even at lower severity, should be tracked and addressed to prevent escalation.",
    });
  }

  if (riskChanges.resolved.length > 0) {
    items.push({
      title: "Risk finding(s) resolved",
      description: `${riskChanges.resolved.length} risk finding(s) resolved: ${riskChanges.resolved.map((r) => r.description).join("; ")}.`,
      area: "risks",
      impactLevel: "low",
      affectedRoles: [ROLE_QA],
      evidence: riskChanges.resolved.map((r) => `Resolved risk (${r.severity}/${r.category}): ${r.description}`),
      recommendedAction:
        "QA Engineer should verify that the resolved risks are genuinely addressed and not merely suppressed.",
      reason:
        "Resolved risks indicate improvement. Verification ensures the resolution is substantive.",
    });
  }

  return items;
}

function buildFileImpactItems(result: SnapshotComparisonResult): ImpactItem[] {
  const items: ImpactItem[] = [];
  const { addedFiles, removedFiles, changedFiles } = result;

  // Auth/middleware config files are security-critical
  const authFilesAdded = addedFiles.filter(isAuthFile);
  const authFilesRemoved = removedFiles.filter(isAuthFile);
  const authFilesChanged = changedFiles.filter(isAuthFile);

  if (authFilesAdded.length > 0 || authFilesRemoved.length > 0 || authFilesChanged.length > 0) {
    items.push({
      title: "Auth/middleware configuration file(s) changed",
      description: `Security-sensitive configuration files changed. Added: ${authFilesAdded.join(", ") || "none"}. Removed: ${authFilesRemoved.join(", ") || "none"}. Changed: ${authFilesChanged.join(", ") || "none"}.`,
      area: "auth",
      impactLevel: "critical",
      affectedRoles: [ROLE_CTO, ROLE_SECURITY, ROLE_BACKEND],
      evidence: [
        ...authFilesAdded.map((f) => `Auth/config file added: ${f}`),
        ...authFilesRemoved.map((f) => `Auth/config file removed: ${f}`),
        ...authFilesChanged.map((f) => `Auth/config file changed: ${f}`),
      ],
      recommendedAction:
        "Security Engineer must review all changes to middleware and auth configuration files to ensure access control policies remain correct.",
      reason:
        "Middleware and auth configuration files control application-wide access control. Changes require security sign-off.",
    });
  }

  const allFileChanges: ImportantFileChange[] = [
    ...addedFiles.map((path) => ({ path, changeType: "added" as const })),
    ...removedFiles.map((path) => ({ path, changeType: "removed" as const })),
    ...changedFiles.map((path) => ({ path, changeType: "changed" as const })),
  ];
  const fileChangesByCategory = new Map<ImportantFileCategory, ImportantFileChange[]>();

  for (const change of allFileChanges) {
    const category = classifyImportantFile(change.path);
    if (!category || category === "middleware") continue;
    const existing = fileChangesByCategory.get(category) ?? [];
    existing.push(change);
    fileChangesByCategory.set(category, existing);
  }

  const evidenceFor = (label: string, changes: ImportantFileChange[]) =>
    changes.map((change) => `${label} ${change.changeType}: ${change.path}`);

  const packageChanges = fileChangesByCategory.get("package") ?? [];
  if (packageChanges.length > 0) {
    items.push({
      title: "Package manifest file changed",
      description: `Package manifest changes detected: ${packageChanges.map((c) => c.path).join(", ")}.`,
      area: "dependencies",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_DEVOPS, ROLE_SECURITY, ROLE_RELEASE],
      evidence: evidenceFor("Package manifest", packageChanges),
      recommendedAction:
        "Backend Engineer and DevOps must verify dependency, script, and package manager implications. Security Engineer should review supply-chain impact before release.",
      reason:
        "Package manifest changes can alter dependencies, scripts, package manager behavior, and build reproducibility.",
    });
  }

  const typescriptChanges = fileChangesByCategory.get("typescript") ?? [];
  if (typescriptChanges.length > 0) {
    items.push({
      title: "TypeScript configuration file changed",
      description: `TypeScript configuration changes detected: ${typescriptChanges.map((c) => c.path).join(", ")}.`,
      area: "build",
      impactLevel: "medium",
      affectedRoles: [ROLE_BACKEND, ROLE_DEVOPS],
      evidence: evidenceFor("TypeScript config", typescriptChanges),
      recommendedAction:
        "Backend Engineer should run type checking and confirm compiler settings still match application and CI expectations.",
      reason:
        "TypeScript configuration changes can alter type safety, module resolution, emitted code, and CI behavior.",
    });
  }

  const nextChanges = fileChangesByCategory.get("next") ?? [];
  if (nextChanges.length > 0) {
    items.push({
      title: "Next.js configuration file changed",
      description: `Next.js configuration changes detected: ${nextChanges.map((c) => c.path).join(", ")}.`,
      area: "build",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_DEVOPS, ROLE_RELEASE, ROLE_QA],
      evidence: evidenceFor("Next.js config", nextChanges),
      recommendedAction:
        "DevOps and Backend Engineer must verify production build output, runtime configuration, redirects/headers, and deployment behavior before release.",
      reason:
        "Next.js configuration controls build and runtime behavior and can create release-impacting regressions.",
    });
  }

  const lintChanges = fileChangesByCategory.get("lint") ?? [];
  if (lintChanges.length > 0) {
    items.push({
      title: "Lint configuration file changed",
      description: `Lint configuration changes detected: ${lintChanges.map((c) => c.path).join(", ")}.`,
      area: "build",
      impactLevel: "medium",
      affectedRoles: [ROLE_BACKEND, ROLE_DEVOPS],
      evidence: evidenceFor("Lint config", lintChanges),
      recommendedAction:
        "Backend Engineer should run lint locally and in CI to confirm quality gates still enforce the intended rules.",
      reason:
        "Lint configuration changes can weaken or break automated quality gates.",
    });
  }

  const testConfigChanges = fileChangesByCategory.get("test") ?? [];
  if (testConfigChanges.length > 0) {
    items.push({
      title: "Test configuration file changed",
      description: `Test configuration changes detected: ${testConfigChanges.map((c) => c.path).join(", ")}.`,
      area: "tests",
      impactLevel: "medium",
      affectedRoles: [ROLE_QA, ROLE_BACKEND, ROLE_DEVOPS],
      evidence: evidenceFor("Test config", testConfigChanges),
      recommendedAction:
        "QA Engineer should run the full test suite and confirm test discovery, environment setup, and coverage behavior remain correct.",
      reason:
        "Test runner configuration changes can hide tests, change environments, or destabilize CI.",
    });
  }

  const deploymentChanges = fileChangesByCategory.get("deployment") ?? [];
  if (deploymentChanges.length > 0) {
    items.push({
      title: "Build/deployment configuration file changed",
      description: `Build or deployment configuration changes detected: ${deploymentChanges.map((c) => c.path).join(", ")}.`,
      area: "deployment",
      impactLevel: "high",
      affectedRoles: [ROLE_DEVOPS, ROLE_RELEASE, ROLE_BACKEND],
      evidence: evidenceFor("Build/deployment config", deploymentChanges),
      recommendedAction:
        "DevOps must verify CI/CD and production deployment behavior. Release Manager should hold release until the deployment path is validated.",
      reason:
        "Build and deployment configuration changes can break delivery pipelines or alter production infrastructure behavior.",
    });
  }

  const layoutChanges = fileChangesByCategory.get("layout") ?? [];
  if (layoutChanges.length > 0) {
    items.push({
      title: "App layout file changed",
      description: `App Router layout changes detected: ${layoutChanges.map((c) => c.path).join(", ")}.`,
      area: "routing",
      impactLevel: "high",
      affectedRoles: [ROLE_BACKEND, ROLE_QA, ROLE_RELEASE],
      evidence: evidenceFor("App layout", layoutChanges),
      recommendedAction:
        "QA Engineer should regression-test navigation, auth boundaries, and shared UI shell behavior. Release Manager should verify no global rendering regressions before release.",
      reason:
        "App layout files can affect every nested page, shared metadata, providers, and route-level rendering behavior.",
    });
  }

  // Documentation-only file changes in important files
  const docFilesAdded = addedFiles.filter((f) => !isAuthFile(f) && isDocFile(f));
  const docFilesRemoved = removedFiles.filter((f) => !isAuthFile(f) && isDocFile(f));
  if (docFilesAdded.length > 0 || docFilesRemoved.length > 0) {
    items.push({
      title: "Documentation file(s) changed",
      description: `Documentation changes detected. Added: ${docFilesAdded.join(", ") || "none"}. Removed: ${docFilesRemoved.join(", ") || "none"}.`,
      area: "documentation",
      impactLevel: "low",
      affectedRoles: [],
      evidence: [
        ...docFilesAdded.map((f) => `Doc file added: ${f}`),
        ...docFilesRemoved.map((f) => `Doc file removed: ${f}`),
      ],
      recommendedAction:
        "No action required. Documentation changes carry no functional risk.",
      reason:
        "Documentation-only changes do not affect application behavior.",
    });
  }

  return items;
}

function buildDocumentationOnlyItem(result: SnapshotComparisonResult): ImpactItem {
  const docDelta = result.fileSummary.categoryChanges["doc"];
  const direction = docDelta && docDelta.delta > 0 ? "added" : "changed";
  return {
    title: "Documentation-only changes",
    description: `Only documentation files were ${direction} (doc file count changed by ${docDelta?.delta ?? 0}).`,
    area: "documentation",
    impactLevel: "low",
    affectedRoles: [],
    evidence: [`File category change: doc (old: ${docDelta?.old ?? 0}, new: ${docDelta?.new ?? 0}, delta: ${docDelta?.delta ?? 0})`],
    recommendedAction:
      "No action required. Documentation changes carry no functional risk.",
    reason:
      "Documentation-only changes do not affect application behavior.",
  };
}

// ─── Aggregate Builders ───────────────────────────────────────────────────────

function computeOverallLevel(items: ImpactItem[]): ImpactLevel {
  if (items.length === 0) return "none";
  return items.reduce<ImpactLevel>((acc, item) => maxLevel(acc, item.impactLevel), "none");
}

function aggregateAffectedRoles(items: ImpactItem[]): string[] {
  const roles = new Set<string>();
  for (const item of items) {
    for (const role of item.affectedRoles) {
      roles.add(role);
    }
  }
  return [...roles].sort();
}

function buildQaFocusAreas(items: ImpactItem[]): string[] {
  const areas = new Set<string>();
  for (const item of items) {
    if (item.impactLevel === "critical" || item.impactLevel === "high") {
      areas.add(item.area);
    }
    if (item.affectedRoles.includes(ROLE_QA)) {
      areas.add(item.area);
    }
  }
  return [...areas].sort();
}

function buildReleaseRisks(items: ImpactItem[]): string[] {
  return items
    .filter((item) => item.impactLevel === "critical" || item.impactLevel === "high")
    .map((item) => `[${item.impactLevel.toUpperCase()}] ${item.title}: ${item.description}`)
    .sort();
}

function buildBlockingConcerns(items: ImpactItem[]): string[] {
  return items
    .filter((item) => item.impactLevel === "critical")
    .map((item) => `${item.title} — ${item.recommendedAction}`)
    .sort();
}

function buildRecommendedActions(items: ImpactItem[]): RecommendedAction[] {
  const actions: RecommendedAction[] = items
    .filter((item) => item.evidence.length > 0)
    .map((item) => ({
      action: item.recommendedAction,
      area: item.area,
      priority: levelToPriority(item.impactLevel),
      assignedRoles: [...item.affectedRoles].sort(),
      evidence: [...item.evidence].sort(),
    }));

  return actions.sort((a, b) => {
    const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (diff !== 0) return diff;
    return a.area.localeCompare(b.area);
  });
}

function computeConfidence(result: SnapshotComparisonResult): ConfidenceLevel {
  const hasVersionMismatch = result.limitations.some(
    (l) => l.toLowerCase().includes("version mismatch") || l.toLowerCase().includes("analyzer version"),
  );
  if (hasVersionMismatch) return "medium";
  if (result.limitations.length > 6) return "medium";
  return "high";
}

function buildEvidenceRefs(items: ImpactItem[]): string[] {
  const refs = new Set<string>();
  for (const item of items) {
    for (const ev of item.evidence) {
      refs.add(ev);
    }
  }
  return [...refs].sort();
}

function buildSummary(overallLevel: ImpactLevel, items: ImpactItem[]): string {
  if (overallLevel === "none") {
    return "No functional impact detected. The comparison found no structural changes.";
  }

  const criticalCount = items.filter((i) => i.impactLevel === "critical").length;
  const highCount = items.filter((i) => i.impactLevel === "high").length;
  const areas = [...new Set(items.map((i) => i.area))].sort().join(", ");

  const parts: string[] = [];
  parts.push(`Overall impact: ${overallLevel.toUpperCase()}.`);
  parts.push(`${items.length} impact item(s) identified across: ${areas}.`);
  if (criticalCount > 0) {
    parts.push(`${criticalCount} critical item(s) require immediate review before release.`);
  }
  if (highCount > 0) {
    parts.push(`${highCount} high-impact item(s) require review.`);
  }

  return parts.join(" ");
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * Analyzes the impact of a repository snapshot comparison.
 *
 * Pure function: no database access, no filesystem reads, no AI, no external calls.
 * The `analyzedAt` timestamp must be injected by the caller.
 * Same input always produces the same output.
 */
export function analyzeRepositoryImpact(
  comparisonResult: ComparisonOutcome,
  analyzedAt: string,
): ImpactAnalysisOutcome {
  if ("error" in comparisonResult && comparisonResult.error === true) {
    return {
      error: true,
      reason: `Cannot analyze impact: comparison failed — ${comparisonResult.reason}`,
      repositoryId: comparisonResult.repositoryId,
      oldSnapshotId: comparisonResult.oldSnapshotId,
      newSnapshotId: comparisonResult.newSnapshotId,
      analyzedAt,
    };
  }

  const result = normalizeSnapshotComparisonResult(comparisonResult as SnapshotComparisonResult);

  if (!result.hasChanges) {
    return {
      repositoryId: result.repositoryId,
      oldSnapshotId: result.oldSnapshotId,
      newSnapshotId: result.newSnapshotId,
      analyzedAt,
      overallImpactLevel: "none",
      affectedAreas: [],
      impactItems: [],
      affectedRoles: [],
      qaFocusAreas: [],
      releaseRisks: [],
      recommendedActions: [],
      blockingConcerns: [],
      confidence: "high",
      evidence: [],
      summary: "No functional impact detected. The comparison found no structural changes.",
      limitations: result.limitations,
    };
  }

  // Documentation-only fast path
  if (isDocumentationOnlyChange(result)) {
    const docItem = buildDocumentationOnlyItem(result);
    return {
      repositoryId: result.repositoryId,
      oldSnapshotId: result.oldSnapshotId,
      newSnapshotId: result.newSnapshotId,
      analyzedAt,
      overallImpactLevel: "low",
      affectedAreas: ["documentation"],
      impactItems: [docItem],
      affectedRoles: [],
      qaFocusAreas: [],
      releaseRisks: [],
      recommendedActions: [],
      blockingConcerns: [],
      confidence: computeConfidence(result),
      evidence: [...docItem.evidence],
      summary: "Low impact: documentation-only changes detected. No functional areas affected.",
      limitations: result.limitations,
    };
  }

  // Full analysis
  const impactItems: ImpactItem[] = [
    ...buildDatabaseImpactItems(result),
    ...buildApiRouteImpactItems(result),
    ...buildServerActionImpactItems(result),
    ...buildRoutingImpactItems(result),
    ...buildDependencyImpactItems(result),
    ...buildScriptImpactItems(result),
    ...buildTestImpactItems(result),
    ...buildRiskImpactItems(result),
    ...buildFileImpactItems(result),
  ].sort((a, b) => {
    const levelDiff = LEVEL_ORDER[b.impactLevel] - LEVEL_ORDER[a.impactLevel];
    if (levelDiff !== 0) return levelDiff;
    return a.area.localeCompare(b.area);
  });

  const overallImpactLevel = computeOverallLevel(impactItems);
  const affectedAreas = [...new Set(impactItems.map((i) => i.area))].sort();
  const affectedRoles = aggregateAffectedRoles(impactItems);
  const qaFocusAreas = buildQaFocusAreas(impactItems);
  const releaseRisks = buildReleaseRisks(impactItems);
  const blockingConcerns = buildBlockingConcerns(impactItems);
  const recommendedActions = buildRecommendedActions(impactItems);
  const confidence = computeConfidence(result);
  const evidence = buildEvidenceRefs(impactItems);
  const summary = buildSummary(overallImpactLevel, impactItems);

  return {
    repositoryId: result.repositoryId,
    oldSnapshotId: result.oldSnapshotId,
    newSnapshotId: result.newSnapshotId,
    analyzedAt,
    overallImpactLevel,
    affectedAreas,
    impactItems,
    affectedRoles,
    qaFocusAreas,
    releaseRisks,
    recommendedActions,
    blockingConcerns,
    confidence,
    evidence,
    summary,
    limitations: result.limitations,
  };
}
