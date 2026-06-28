import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ANALYZER_VERSION = "1";
export const ANALYZER_MAX_FILES = 2000;
export const ANALYZER_MAX_DEPTH = 6;

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "dist",
  "build",
  "out",
  ".cache",
  ".turbo",
  "coverage",
  ".nyc_output",
  "__pycache__",
  ".pytest_cache",
  "vendor",
  ".vendor",
  "tmp",
  ".tmp",
  ".vercel",
  ".pnp",
  ".yarn",
  "storybook-static",
  ".docusaurus",
]);

const IGNORED_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  ".env.test",
  ".env.example",
  ".envrc",
]);

const IGNORED_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".cert",
  ".crt",
  ".der",
  ".p8",
  ".jks",
]);

const MAX_WALK_DEPTH = ANALYZER_MAX_DEPTH;
const MAX_FILES = ANALYZER_MAX_FILES;
const MAX_FILE_READ_BYTES = 512 * 1024; // 512 KB

// Extensions considered source code
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);
// Note: .config.* files are detected by name patterns below, not by extension set
const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less", ".styl"]);
const DOC_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);
const TEST_PATTERNS = [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /__tests__/];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileEntry {
  readonly path: string;
  readonly type: "file" | "dir";
  readonly extension: string;
  readonly size: number;
  readonly category: "source" | "config" | "style" | "doc" | "test" | "asset" | "other";
  readonly purposeGuess: string;
  readonly contentHash?: string;
}

export interface FileTreeSummary {
  readonly totalFiles: number;
  readonly totalDirs: number;
  readonly byCategory: Record<string, number>;
  readonly byExtension: Record<string, number>;
  readonly topLevelDirs: readonly string[];
}

export interface PackageManagerInfo {
  readonly name: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  readonly version: string | null;
  readonly workspaces: readonly string[];
}

export interface ScriptInfo {
  readonly dev: string | null;
  readonly build: string | null;
  readonly test: string | null;
  readonly lint: string | null;
  readonly typecheck: string | null;
}

export interface FrameworkInfo {
  readonly name: string;
  readonly version: string | null;
  readonly confidence: "high" | "medium" | "low";
  readonly evidence: readonly string[];
}

export interface RouteInfo {
  readonly path: string;
  readonly urlPath?: string | null;
  readonly type: "page" | "layout" | "api" | "action" | "middleware" | "other";
  readonly evidence: string;
}

export interface ApiSurfaceSummary {
  readonly frameworks: readonly FrameworkInfo[];
  readonly pages: readonly RouteInfo[];
  readonly layouts: readonly RouteInfo[];
  readonly apiRoutes: readonly RouteInfo[];
  readonly middleware: readonly RouteInfo[];
  readonly serverActionModules: readonly string[];
  readonly entryPointPaths: readonly string[];
  readonly unknowns: readonly string[];
}

export interface PrismaModelInfo {
  readonly name: string;
  readonly schemaPath: string;
  readonly ownershipFields: readonly string[];
}

export interface DatabaseLayerSummary {
  readonly technology: "prisma" | "drizzle" | "typeorm" | "mongoose" | "none";
  readonly ormEvidence: readonly string[];
  readonly schemaPaths: readonly string[];
  readonly migrationPaths: readonly string[];
  readonly seedPaths: readonly string[];
  readonly models: readonly PrismaModelInfo[];
  readonly ownershipRisks: readonly string[];
  readonly unknowns: readonly string[];
}

export interface RiskFinding {
  readonly severity: "high" | "medium" | "low";
  readonly category: "testing" | "documentation" | "security" | "dependencies" | "structure" | "database";
  readonly description: string;
  readonly evidence: string;
  readonly mitigation: string;
}

export interface FileFingerprint {
  readonly path: string;
  readonly extension: string;
  readonly size: number;
  readonly category: FileEntry["category"];
  readonly contentHash: string;
}

export interface RepositoryAnalysisResult {
  readonly localPath: string;
  readonly fileTree: FileTreeSummary;
  readonly packageManager: PackageManagerInfo;
  readonly scripts: ScriptInfo;
  readonly primaryLanguage: string | null;
  readonly techStack: readonly string[];
  readonly frameworks: readonly FrameworkInfo[];
  readonly dependencies: readonly string[];
  readonly devDependencies: readonly string[];
  readonly importantFiles: readonly string[];
  readonly routes: readonly RouteInfo[];
  readonly apiSurface: ApiSurfaceSummary;
  readonly serverActions: readonly string[];
  readonly apiRoutes: readonly string[];
  readonly prismaModels: readonly PrismaModelInfo[];
  readonly databaseLayer: DatabaseLayerSummary;
  readonly testFiles: readonly string[];
  readonly fileFingerprints: readonly FileFingerprint[];
  readonly risks: readonly RiskFinding[];
  readonly intelligenceSummary: string;
}

export interface RepositoryAnalysisError {
  readonly error: string;
  readonly localPath: string;
}

export type RepositoryAnalysisOutcome =
  | ({ readonly ok: true } & RepositoryAnalysisResult)
  | ({ readonly ok: false } & RepositoryAnalysisError);

// ─── Entry Point ─────────────────────────────────────────────────────────────

/**
 * Analyzes a local repository path deterministically.
 * Reads only; never mutates the repository.
 * Excludes secrets, env files, node_modules, and generated outputs.
 */
export function analyzeRepositoryPath(localPath: string): RepositoryAnalysisOutcome {
  if (!existsSync(localPath)) {
    return { ok: false, error: `Path does not exist: ${localPath}`, localPath };
  }

  const stat = (() => {
    try {
      return statSync(localPath);
    } catch {
      return null;
    }
  })();

  if (!stat || !stat.isDirectory()) {
    return { ok: false, error: `Path is not a directory: ${localPath}`, localPath };
  }

  const entries = walkDirectory(localPath, localPath, 0, { count: 0 });
  const fileTree = buildFileTreeSummary(entries, localPath);
  const packageManager = detectPackageManager(localPath);
  const { scripts, dependencies, devDependencies, frameworks, techStack, primaryLanguage } = parseManifests(localPath);
  const routes = detectRoutes(localPath, entries);
  const serverActions = detectServerActions(localPath, entries);
  const apiSurface = buildApiSurfaceSummary(routes, serverActions, frameworks);
  const apiRoutes = apiSurface.apiRoutes.map((route) => route.urlPath ?? route.path);
  const prismaModels = detectPrismaModels(localPath);
  const databaseLayer = detectDatabaseLayer(localPath, dependencies, devDependencies, prismaModels);
  const testFiles = detectTestFiles(entries);
  const fileFingerprints = buildFileFingerprints(entries);
  const importantFiles = buildImportantFiles(localPath, entries, prismaModels);
  const risks = buildRisks({
    entries,
    testFiles,
    prismaModels,
    dependencies,
    devDependencies,
    localPath,
  });
  const intelligenceSummary = buildIntelligenceSummary({
    localPath,
    packageManager,
    frameworks,
    routes,
    apiSurface,
    serverActions,
    apiRoutes,
    prismaModels,
    databaseLayer,
    testFiles,
    risks,
    fileTree,
  });

  return {
    ok: true,
    localPath,
    fileTree,
    packageManager,
    scripts,
    primaryLanguage,
    techStack,
    frameworks,
    dependencies,
    devDependencies,
    importantFiles,
    routes,
    apiSurface,
    serverActions,
    apiRoutes,
    prismaModels,
    databaseLayer,
    testFiles,
    fileFingerprints,
    risks,
    intelligenceSummary,
  };
}

// ─── File Tree Walk ───────────────────────────────────────────────────────────

function walkDirectory(
  root: string,
  dir: string,
  depth: number,
  counter: { count: number }
): FileEntry[] {
  if (depth > MAX_WALK_DEPTH || counter.count >= MAX_FILES) return [];

  let dirEntries: string[];
  try {
    dirEntries = readdirSync(dir);
  } catch {
    return [];
  }

  const results: FileEntry[] = [];

  for (const name of dirEntries.sort()) {
    if (counter.count >= MAX_FILES) break;

    const fullPath = join(dir, name);
    const relativePath = relative(root, fullPath);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (IGNORED_DIRS.has(name)) continue;
      counter.count++;
      results.push({
        path: relativePath,
        type: "dir",
        extension: "",
        size: 0,
        category: "other",
        purposeGuess: guessDirPurpose(name),
      });
      results.push(...walkDirectory(root, fullPath, depth + 1, counter));
    } else if (stat.isFile()) {
      if (IGNORED_FILE_NAMES.has(name)) continue;
      const ext = extname(name).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) continue;
      const category = categorizeFile(name, relativePath, ext);

      counter.count++;
      results.push({
        path: relativePath,
        type: "file",
        extension: ext,
        size: stat.size,
        category,
        purposeGuess: guessFilePurpose(name, relativePath, ext),
        contentHash: buildContentHash(fullPath, stat.size, category),
      });
    }
  }

  return results;
}

function buildContentHash(
  fullPath: string,
  size: number,
  category: FileEntry["category"],
): string | undefined {
  if (size > MAX_FILE_READ_BYTES) return undefined;
  if (!["source", "config", "style", "doc", "test"].includes(category)) return undefined;

  try {
    const content = readFileSync(fullPath);
    if (content.includes(0)) return undefined;
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return undefined;
  }
}

function buildFileFingerprints(entries: readonly FileEntry[]): readonly FileFingerprint[] {
  return entries
    .filter((entry): entry is FileEntry & { contentHash: string } =>
      entry.type === "file" && typeof entry.contentHash === "string",
    )
    .map((entry) => ({
      path: entry.path.replace(/\\/g, "/"),
      extension: entry.extension,
      size: entry.size,
      category: entry.category,
      contentHash: entry.contentHash,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function categorizeFile(name: string, relativePath: string, ext: string): FileEntry["category"] {
  if (TEST_PATTERNS.some((p) => p.test(relativePath) || p.test(name))) return "test";
  if (SOURCE_EXTENSIONS.has(ext)) return "source";
  if (ext === ".json" || ext === ".yaml" || ext === ".yml" || ext === ".toml") return "config";
  if (name.endsWith(".config.ts") || name.endsWith(".config.js") || name.endsWith(".config.mjs")) return "config";
  if (STYLE_EXTENSIONS.has(ext)) return "style";
  if (DOC_EXTENSIONS.has(ext)) return "doc";
  return "asset";
}

function guessFilePurpose(name: string, relativePath: string, ext: string): string {
  if (name === "package.json") return "Package manifest";
  if (name === "tsconfig.json") return "TypeScript configuration";
  if (name === "schema.prisma") return "Prisma database schema";
  if (name.startsWith("next.config")) return "Next.js configuration";
  if (name === "tailwind.config.ts" || name === "tailwind.config.js") return "Tailwind CSS configuration";
  if (name === "vitest.config.ts" || name === "jest.config.ts") return "Test runner configuration";
  if (name === "eslint.config.js" || name === ".eslintrc.json") return "ESLint configuration";
  if (TEST_PATTERNS.some((p) => p.test(relativePath))) return "Test file";
  if (relativePath.includes("/app/") && name === "page.tsx") return "App Router page";
  if (relativePath.includes("/app/") && name === "layout.tsx") return "App Router layout";
  if (relativePath.includes("/app/") && name === "route.ts") return "API route handler";
  if (name === "middleware.ts" || name === "proxy.ts") return "Middleware";
  if (relativePath.includes("/actions/") && SOURCE_EXTENSIONS.has(ext)) return "Server action module";
  if (relativePath.includes("/lib/") && SOURCE_EXTENSIONS.has(ext)) return "Shared library";
  if (relativePath.includes("/components/") && SOURCE_EXTENSIONS.has(ext)) return "UI component";
  return "Source file";
}

function guessDirPurpose(name: string): string {
  const map: Record<string, string> = {
    src: "Source root",
    app: "Next.js App Router root",
    pages: "Next.js Pages Router root",
    components: "UI components",
    lib: "Shared library utilities",
    actions: "Server actions",
    api: "API routes",
    prisma: "Prisma database files",
    migrations: "Database migrations",
    tests: "Test suite",
    __tests__: "Test suite",
    docs: "Documentation",
    public: "Static assets",
    styles: "Stylesheets",
    hooks: "React hooks",
    utils: "Utility functions",
    types: "TypeScript type definitions",
    services: "Service layer",
    config: "Configuration",
  };
  return map[name] ?? "Directory";
}

function buildFileTreeSummary(entries: FileEntry[], root: string): FileTreeSummary {
  const byCategory: Record<string, number> = {};
  const byExtension: Record<string, number> = {};
  let totalFiles = 0;
  let totalDirs = 0;

  let topLevelDirEntries: string[];
  try {
    topLevelDirEntries = readdirSync(root)
      .filter((name) => {
        try {
          return statSync(join(root, name)).isDirectory() && !IGNORED_DIRS.has(name);
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    topLevelDirEntries = [];
  }

  for (const entry of entries) {
    if (entry.type === "dir") {
      totalDirs++;
    } else {
      totalFiles++;
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      if (entry.extension) {
        byExtension[entry.extension] = (byExtension[entry.extension] ?? 0) + 1;
      }
    }
  }

  return { totalFiles, totalDirs, byCategory, byExtension, topLevelDirs: topLevelDirEntries };
}

// ─── Package Manager Detection ────────────────────────────────────────────────

export function detectPackageManager(root: string): PackageManagerInfo {
  // Lockfile precedence: bun > pnpm > yarn > npm
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) {
    return { name: "bun", version: null, workspaces: detectWorkspaces(root) };
  }
  if (existsSync(join(root, "pnpm-lock.yaml"))) {
    return { name: "pnpm", version: null, workspaces: detectPnpmWorkspaces(root) };
  }
  if (existsSync(join(root, "yarn.lock"))) {
    return { name: "yarn", version: null, workspaces: detectWorkspaces(root) };
  }
  if (existsSync(join(root, "package-lock.json"))) {
    return { name: "npm", version: null, workspaces: detectWorkspaces(root) };
  }
  // Fallback: check package.json for packageManager field
  const pkg = readJsonFile(join(root, "package.json"));
  if (pkg && typeof pkg.packageManager === "string") {
    const pm = pkg.packageManager as string;
    if (pm.startsWith("pnpm")) return { name: "pnpm", version: null, workspaces: detectPnpmWorkspaces(root) };
    if (pm.startsWith("yarn")) return { name: "yarn", version: null, workspaces: detectWorkspaces(root) };
    if (pm.startsWith("bun")) return { name: "bun", version: null, workspaces: detectWorkspaces(root) };
    if (pm.startsWith("npm")) return { name: "npm", version: null, workspaces: detectWorkspaces(root) };
  }
  if (existsSync(join(root, "package.json"))) {
    return { name: "npm", version: null, workspaces: detectWorkspaces(root) };
  }
  return { name: "unknown", version: null, workspaces: [] };
}

function detectWorkspaces(root: string): readonly string[] {
  const pkg = readJsonFile(join(root, "package.json"));
  if (!pkg) return [];
  const ws = pkg.workspaces;
  if (Array.isArray(ws)) return ws.filter((w): w is string => typeof w === "string").sort();
  if (ws && typeof ws === "object" && Array.isArray((ws as { packages?: unknown }).packages)) {
    return ((ws as { packages: unknown[] }).packages as string[]).filter((w): w is string => typeof w === "string").sort();
  }
  return [];
}

function detectPnpmWorkspaces(root: string): readonly string[] {
  const yamlPath = join(root, "pnpm-workspace.yaml");
  if (!existsSync(yamlPath)) return detectWorkspaces(root);
  try {
    const content = readFileSafe(yamlPath);
    if (!content) return [];
    const packages: string[] = [];
    for (const line of content.split("\n")) {
      const match = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
      if (match) packages.push(match[1]);
    }
    return packages.sort();
  } catch {
    return [];
  }
}

// ─── Manifest Parsing ─────────────────────────────────────────────────────────

interface ManifestResult {
  readonly scripts: ScriptInfo;
  readonly dependencies: readonly string[];
  readonly devDependencies: readonly string[];
  readonly frameworks: readonly FrameworkInfo[];
  readonly techStack: readonly string[];
  readonly primaryLanguage: string | null;
}

function parseManifests(root: string): ManifestResult {
  const pkg = readJsonFile(join(root, "package.json"));
  if (!pkg) {
    return {
      scripts: { dev: null, build: null, test: null, lint: null, typecheck: null },
      dependencies: [],
      devDependencies: [],
      frameworks: [],
      techStack: [],
      primaryLanguage: null,
    };
  }

  const rawDeps: Record<string, string> = typeof pkg.dependencies === "object" && pkg.dependencies !== null
    ? (pkg.dependencies as Record<string, string>)
    : {};
  const rawDevDeps: Record<string, string> = typeof pkg.devDependencies === "object" && pkg.devDependencies !== null
    ? (pkg.devDependencies as Record<string, string>)
    : {};
  const rawScripts: Record<string, string> = typeof pkg.scripts === "object" && pkg.scripts !== null
    ? (pkg.scripts as Record<string, string>)
    : {};

  const dependencies = Object.keys(rawDeps).sort();
  const devDependencies = Object.keys(rawDevDeps).sort();
  const allDeps = new Set([...dependencies, ...devDependencies]);

  const scripts: ScriptInfo = {
    dev: rawScripts["dev"] ?? rawScripts["start"] ?? null,
    build: rawScripts["build"] ?? null,
    test: rawScripts["test"] ?? rawScripts["test:unit"] ?? null,
    lint: rawScripts["lint"] ?? null,
    typecheck: rawScripts["typecheck"] ?? rawScripts["type-check"] ?? rawScripts["check"] ?? null,
  };

  const frameworks = detectFrameworksFromDeps(allDeps, root);
  const techStack = buildTechStack(allDeps, frameworks);
  const primaryLanguage = detectPrimaryLanguage(allDeps, devDependencies);

  return { scripts, dependencies, devDependencies, frameworks, techStack, primaryLanguage };
}

function detectFrameworksFromDeps(allDeps: Set<string>, root: string): readonly FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];

  if (allDeps.has("next")) {
    const version = readPackageVersion(root, "next");
    const hasAppDir = existsSync(join(root, "src", "app")) || existsSync(join(root, "app"));
    const hasPagesDir = existsSync(join(root, "src", "pages")) || existsSync(join(root, "pages"));
    const router = hasAppDir ? "App Router" : hasPagesDir ? "Pages Router" : "Unknown Router";
    frameworks.push({
      name: `Next.js (${router})`,
      version,
      confidence: hasAppDir || hasPagesDir ? "high" : "medium",
      evidence: [
        "next in dependencies",
        ...(hasAppDir ? ["src/app or app directory found"] : []),
        ...(hasPagesDir ? ["pages directory found"] : []),
        ...(!hasAppDir && !hasPagesDir ? ["No app/ or pages/ directory detected"] : []),
      ],
    });
  }

  if (allDeps.has("react") && !allDeps.has("next")) {
    frameworks.push({
      name: "React",
      version: readPackageVersion(root, "react"),
      confidence: "high",
      evidence: ["react in dependencies"],
    });
  }

  if (allDeps.has("vue")) {
    frameworks.push({
      name: "Vue",
      version: readPackageVersion(root, "vue"),
      confidence: "high",
      evidence: ["vue in dependencies"],
    });
  }

  if (allDeps.has("svelte")) {
    frameworks.push({
      name: "Svelte",
      version: readPackageVersion(root, "svelte"),
      confidence: "high",
      evidence: ["svelte in dependencies"],
    });
  }

  if (allDeps.has("express")) {
    frameworks.push({
      name: "Express",
      version: readPackageVersion(root, "express"),
      confidence: "high",
      evidence: ["express in dependencies"],
    });
  }

  if (allDeps.has("fastify")) {
    frameworks.push({
      name: "Fastify",
      version: readPackageVersion(root, "fastify"),
      confidence: "high",
      evidence: ["fastify in dependencies"],
    });
  }

  return frameworks;
}

function buildTechStack(allDeps: Set<string>, frameworks: readonly FrameworkInfo[]): readonly string[] {
  const stack = new Set<string>(frameworks.map((f) => f.name));

  if (allDeps.has("@prisma/client") || allDeps.has("prisma")) stack.add("Prisma");
  if (allDeps.has("drizzle-orm")) stack.add("Drizzle ORM");
  if (allDeps.has("typeorm")) stack.add("TypeORM");
  if (allDeps.has("mongoose")) stack.add("Mongoose");
  if (allDeps.has("@clerk/nextjs") || allDeps.has("@clerk/clerk-react")) stack.add("Clerk");
  if (allDeps.has("next-auth")) stack.add("NextAuth.js");
  if (allDeps.has("@auth/core")) stack.add("Auth.js");
  if (allDeps.has("tailwindcss")) stack.add("Tailwind CSS");
  if (allDeps.has("zod")) stack.add("Zod");
  if (allDeps.has("vitest")) stack.add("Vitest");
  if (allDeps.has("jest")) stack.add("Jest");
  if (allDeps.has("playwright")) stack.add("Playwright");
  if (allDeps.has("cypress")) stack.add("Cypress");

  return [...stack].sort();
}

function detectPrimaryLanguage(deps: Set<string>, devDeps: readonly string[]): string | null {
  const hasTypeScript = devDeps.includes("typescript") || deps.has("typescript");
  if (hasTypeScript) return "TypeScript";
  if (deps.has("@types/node") || deps.has("@types/react")) return "TypeScript";
  return "JavaScript";
}

function readPackageVersion(root: string, packageName: string): string | null {
  const pkg = readJsonFile(join(root, "package.json"));
  if (!pkg) return null;
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
    ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
  };
  return deps[packageName] ?? null;
}

// ─── Route Detection ──────────────────────────────────────────────────────────

/**
 * Maps a Next.js App Router file path to a public URL path when possible.
 *
 * @param filePath - Repository-relative route file path.
 * @param appDir - App Router root directory (`src/app` or `app`).
 * @param routeType - Detected route artifact type.
 * @returns Public URL path or `null` when mapping is unavailable.
 */
export function mapNextJsAppRouterFileToUrlPath(
  filePath: string,
  appDir: string,
  routeType: RouteInfo["type"]
): string | null {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const prefix = `${appDir}/`;
  if (!normalizedPath.startsWith(prefix)) return null;

  const relativeSegments = normalizedPath.slice(prefix.length).split("/");
  const fileName = relativeSegments.pop();
  if (!fileName) return null;

  const segmentMatchesType =
    (routeType === "page" && /^page\.(tsx|ts|jsx|js)$/.test(fileName)) ||
    (routeType === "layout" && /^layout\.(tsx|ts|jsx|js)$/.test(fileName)) ||
    (routeType === "api" && /^route\.(tsx|ts|jsx|js)$/.test(fileName));

  if (!segmentMatchesType) return null;

  const cleanedSegments = relativeSegments.filter(
    (segment) => !(segment.startsWith("@") || (segment.startsWith("(") && segment.endsWith(")")))
  );

  if (cleanedSegments.length === 0) return "/";
  return `/${cleanedSegments.join("/")}`;
}

/**
 * Builds a structured API and routing surface summary for repository intelligence output.
 *
 * @param routes - Detected route artifacts.
 * @param serverActions - Detected server action module paths.
 * @param frameworks - Detected framework metadata.
 * @returns Structured routing summary with explicit unknowns.
 */
export function buildApiSurfaceSummary(
  routes: readonly RouteInfo[],
  serverActions: readonly string[],
  frameworks: readonly FrameworkInfo[]
): ApiSurfaceSummary {
  const pages = routes.filter((route) => route.type === "page");
  const layouts = routes.filter((route) => route.type === "layout");
  const apiRoutes = routes.filter((route) => route.type === "api");
  const middleware = routes.filter((route) => route.type === "middleware");
  const unknowns: string[] = [];

  const nextFramework = frameworks.find((framework) => framework.name.startsWith("Next.js"));
  if (nextFramework !== undefined && nextFramework.confidence !== "high") {
    unknowns.push("Next.js dependency found but App Router or Pages Router directories were not confirmed.");
  }

  if (pages.length === 0 && layouts.length === 0 && apiRoutes.length === 0 && nextFramework !== undefined) {
    unknowns.push("No Next.js route files were detected under app/ or pages/.");
  }

  if (serverActions.length === 0 && nextFramework !== undefined) {
    unknowns.push("No server action modules with a top-level 'use server' directive were detected.");
  }

  const entryPointPaths = [
    ...middleware.map((route) => route.path),
    ...apiRoutes.map((route) => route.path),
    ...serverActions,
    ...layouts.filter((route) => route.path.endsWith("app/layout.tsx") || route.path.endsWith("src/app/layout.tsx")).map(
      (route) => route.path
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    frameworks,
    pages,
    layouts,
    apiRoutes,
    middleware,
    serverActionModules: serverActions,
    entryPointPaths: [...new Set(entryPointPaths)],
    unknowns,
  };
}

export function detectRoutes(root: string, entries: FileEntry[]): readonly RouteInfo[] {
  const routes: RouteInfo[] = [];
  const appDirCandidates = ["src/app", "app"];

  let appDir: string | null = null;
  for (const candidate of appDirCandidates) {
    if (existsSync(join(root, candidate))) {
      appDir = candidate;
      break;
    }
  }

  if (appDir) {
    for (const entry of entries) {
      if (entry.type !== "file") continue;
      const p = entry.path.replace(/\\/g, "/");

      if (!p.startsWith(appDir + "/")) continue;

      const name = p.split("/").pop() ?? "";

      if (name === "page.tsx" || name === "page.ts" || name === "page.jsx" || name === "page.js") {
        routes.push({
          path: p,
          urlPath: mapNextJsAppRouterFileToUrlPath(p, appDir, "page"),
          type: "page",
          evidence: "Next.js App Router page file",
        });
      } else if (name === "layout.tsx" || name === "layout.ts") {
        routes.push({
          path: p,
          urlPath: mapNextJsAppRouterFileToUrlPath(p, appDir, "layout"),
          type: "layout",
          evidence: "Next.js App Router layout file",
        });
      } else if (name === "route.ts" || name === "route.js" || name === "route.tsx") {
        routes.push({
          path: p,
          urlPath: mapNextJsAppRouterFileToUrlPath(p, appDir, "api"),
          type: "api",
          evidence: "Next.js App Router API route handler",
        });
      }
    }
  }

  // Pages router detection
  const pagesDirCandidates = ["src/pages", "pages"];
  for (const candidate of pagesDirCandidates) {
    if (existsSync(join(root, candidate))) {
      for (const entry of entries) {
        if (entry.type !== "file") continue;
        const p = entry.path.replace(/\\/g, "/");
        if (!p.startsWith(candidate + "/")) continue;
        if (!SOURCE_EXTENSIONS.has(entry.extension)) continue;
        if (p.includes("/api/")) {
          routes.push({
            path: p,
            urlPath: null,
            type: "api",
            evidence: "Next.js Pages Router API route",
          });
        } else {
          routes.push({
            path: p,
            urlPath: null,
            type: "page",
            evidence: "Next.js Pages Router page",
          });
        }
      }
      break;
    }
  }

  // Middleware
  for (const entry of entries) {
    const name = entry.path.split("/").pop() ?? "";
    if ((name === "middleware.ts" || name === "middleware.js" || name === "proxy.ts") && entry.type === "file") {
      routes.push({
        path: entry.path.replace(/\\/g, "/"),
        urlPath: null,
        type: "middleware",
        evidence: "Middleware file",
      });
    }
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

// ─── Server Action Detection ──────────────────────────────────────────────────

export function detectServerActions(root: string, entries: FileEntry[]): readonly string[] {
  const actions: string[] = [];

  for (const entry of entries) {
    if (entry.type !== "file" || !SOURCE_EXTENSIONS.has(entry.extension)) continue;
    if (entry.size > MAX_FILE_READ_BYTES) continue;

    const fullPath = join(root, entry.path);
    const content = readFileSafe(fullPath);
    if (!content) continue;

    // Check for 'use server' directive at top of file or inside function
    if (/^\s*["']use server["']/m.test(content)) {
      actions.push(entry.path.replace(/\\/g, "/"));
    }
  }

  return actions.sort();
}

// ─── Prisma Model Detection ───────────────────────────────────────────────────

// ─── Database Layer Detection ─────────────────────────────────────────────────

const OWNERSHIP_FIELD_NAMES = ["companyId", "tenantId", "organizationId"] as const;
const OWNERSHIP_EXEMPT_MODELS = new Set([
  "User",
  "Company",
  "Department",
  "Role",
  "Employee",
  "CompanySettings",
  "Session",
  "Account",
  "VerificationToken",
]);

/**
 * Parses ownership-related scalar fields declared on a Prisma model block.
 *
 * @param modelBody - Prisma model block body without the outer braces.
 * @returns Detected ownership field names.
 */
export function parsePrismaModelOwnershipFields(modelBody: string): readonly string[] {
  return OWNERSHIP_FIELD_NAMES.filter((fieldName) =>
    new RegExp(`^\\s*${fieldName}\\s+`, "m").test(modelBody)
  );
}

/**
 * Detects database technology, schema paths, migrations, seeds, models, and ownership risks.
 *
 * @param root - Repository root path.
 * @param dependencies - Runtime dependency names.
 * @param devDependencies - Development dependency names.
 * @param models - Parsed Prisma model metadata.
 * @returns Structured database layer summary for planning and repository intelligence output.
 */
export function detectDatabaseLayer(
  root: string,
  dependencies: readonly string[],
  devDependencies: readonly string[],
  models: readonly PrismaModelInfo[]
): DatabaseLayerSummary {
  const allDeps = new Set([...dependencies, ...devDependencies]);
  const schemaPaths: string[] = [];
  const migrationPaths: string[] = [];
  const seedPaths: string[] = [];
  const ormEvidence: string[] = [];
  const unknowns: string[] = [];
  let technology: DatabaseLayerSummary["technology"] = "none";

  if (allDeps.has("prisma") || allDeps.has("@prisma/client")) {
    technology = "prisma";
    ormEvidence.push("prisma or @prisma/client in dependencies");
  } else if (allDeps.has("drizzle-orm")) {
    technology = "drizzle";
    ormEvidence.push("drizzle-orm in dependencies");
  } else if (allDeps.has("typeorm")) {
    technology = "typeorm";
    ormEvidence.push("typeorm in dependencies");
  } else if (allDeps.has("mongoose")) {
    technology = "mongoose";
    ormEvidence.push("mongoose in dependencies");
  }

  for (const candidate of ["prisma/schema.prisma", "schema.prisma"]) {
    if (existsSync(join(root, candidate))) schemaPaths.push(candidate);
  }

  const migrationsDir = join(root, "prisma", "migrations");
  if (existsSync(migrationsDir)) {
    try {
      for (const entry of readdirSync(migrationsDir).sort()) {
        if (statSync(join(migrationsDir, entry)).isDirectory()) {
          migrationPaths.push(`prisma/migrations/${entry}`);
        }
      }
    } catch {
      unknowns.push("prisma/migrations exists but migration folders could not be read.");
    }
  }

  for (const seedCandidate of ["prisma/seed.ts", "prisma/seed.js", "prisma/seed.mjs"]) {
    if (existsSync(join(root, seedCandidate))) seedPaths.push(seedCandidate);
  }

  const pkg = readJsonFile(join(root, "package.json"));
  const prismaSeed = pkg?.prisma;
  if (
    prismaSeed &&
    typeof prismaSeed === "object" &&
    !Array.isArray(prismaSeed) &&
    typeof (prismaSeed as { seed?: unknown }).seed === "string"
  ) {
    seedPaths.push(`package.json#prisma.seed:${(prismaSeed as { seed: string }).seed}`);
  }

  if (technology === "none" && schemaPaths.length > 0) {
    technology = "prisma";
    ormEvidence.push("Prisma schema file detected without prisma dependency declaration");
  }

  if (technology === "prisma" && schemaPaths.length === 0) {
    unknowns.push("Prisma dependency detected but no schema.prisma file was found.");
  }

  if (technology === "prisma" && schemaPaths.length > 0 && migrationPaths.length === 0) {
    unknowns.push("Prisma schema detected without a prisma/migrations directory.");
  }

  const ownershipRisks = buildDatabaseOwnershipRisks(models);

  return {
    technology,
    ormEvidence,
    schemaPaths,
    migrationPaths,
    seedPaths: [...new Set(seedPaths)].sort(),
    models,
    ownershipRisks,
    unknowns,
  };
}

/**
 * Builds ownership risk messages when company-scoped models coexist with unscoped entities.
 *
 * @param models - Parsed model metadata.
 * @returns Ownership risk descriptions.
 */
function buildDatabaseOwnershipRisks(models: readonly PrismaModelInfo[]): readonly string[] {
  const companyScopedModels = models.filter((model) => model.ownershipFields.includes("companyId"));
  if (companyScopedModels.length === 0) return [];

  const risks: string[] = [];
  for (const model of models) {
    if (model.ownershipFields.length > 0 || OWNERSHIP_EXEMPT_MODELS.has(model.name)) continue;
    risks.push(
      `Model ${model.name} has no companyId/tenantId/organizationId field while other models are company-scoped.`
    );
  }

  return risks.sort();
}

export function detectPrismaModels(root: string): readonly PrismaModelInfo[] {
  const schemaCandidates = [
    join(root, "prisma", "schema.prisma"),
    join(root, "schema.prisma"),
  ];

  for (const schemaPath of schemaCandidates) {
    if (!existsSync(schemaPath)) continue;

    const content = readFileSafe(schemaPath);
    if (!content) continue;

    const models: PrismaModelInfo[] = [];
    const modelBlockRegex = /^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm;
    let match;

    while ((match = modelBlockRegex.exec(content)) !== null) {
      models.push({
        name: match[1],
        schemaPath: relative(root, schemaPath).replace(/\\/g, "/"),
        ownershipFields: parsePrismaModelOwnershipFields(match[2]),
      });
    }

    return models.sort((a, b) => a.name.localeCompare(b.name));
  }

  return [];
}

// ─── Test File Detection ──────────────────────────────────────────────────────

function detectTestFiles(entries: FileEntry[]): readonly string[] {
  return entries
    .filter((e) => e.type === "file" && e.category === "test")
    .map((e) => e.path.replace(/\\/g, "/"))
    .sort();
}

// ─── Important Files ──────────────────────────────────────────────────────────

function buildImportantFiles(
  root: string,
  entries: FileEntry[],
  prismaModels: readonly PrismaModelInfo[]
): readonly string[] {
  const important = new Set<string>();

  const knownImportant = [
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
    "tailwind.config.ts",
    "tailwind.config.js",
    "vitest.config.ts",
    "jest.config.ts",
    "eslint.config.js",
    ".eslintrc.json",
    "middleware.ts",
    "proxy.ts",
  ];

  for (const name of knownImportant) {
    if (existsSync(join(root, name))) important.add(name);
    if (existsSync(join(root, "src", name))) important.add(`src/${name}`);
  }

  for (const model of prismaModels) {
    important.add(model.schemaPath);
  }

  for (const entry of entries) {
    if (entry.type === "file" && entry.path.includes("/app/") && (entry.path.endsWith("/layout.tsx") || entry.path.endsWith("/layout.ts"))) {
      const depth = entry.path.split("/").length;
      if (depth <= 4) important.add(entry.path.replace(/\\/g, "/"));
    }
  }

  return [...important].sort();
}

// ─── Risk Detection ───────────────────────────────────────────────────────────

function buildRisks(input: {
  entries: FileEntry[];
  testFiles: readonly string[];
  prismaModels: readonly PrismaModelInfo[];
  dependencies: readonly string[];
  devDependencies: readonly string[];
  localPath: string;
}): readonly RiskFinding[] {
  const risks: RiskFinding[] = [];
  const { entries, testFiles, prismaModels, dependencies, devDependencies, localPath } = input;
  const allDeps = new Set([...dependencies, ...devDependencies]);
  const sourceFiles = entries.filter((e) => e.type === "file" && e.category === "source").length;

  // Missing tests
  if (testFiles.length === 0) {
    risks.push({
      severity: "high",
      category: "testing",
      description: "No test files detected in the repository.",
      evidence: "No *.test.ts, *.spec.ts, or __tests__ files found.",
      mitigation: "Add unit and integration tests before shipping new features. Confirm test runner configuration.",
    });
  } else if (sourceFiles > 0 && testFiles.length / sourceFiles < 0.05) {
    risks.push({
      severity: "medium",
      category: "testing",
      description: "Low test coverage ratio relative to source files.",
      evidence: `${testFiles.length} test files vs ${sourceFiles} source files.`,
      mitigation: "Expand test coverage for critical paths before approving new feature work.",
    });
  }

  // Prisma risks
  if (prismaModels.length > 0) {
    const hasMigrationsDir = existsSync(join(localPath, "prisma", "migrations"));
    if (!hasMigrationsDir) {
      risks.push({
        severity: "medium",
        category: "database",
        description: "Prisma is used but no migrations directory was found.",
        evidence: "prisma/migrations directory does not exist.",
        mitigation: "Use prisma migrate dev to manage schema changes with migration history instead of db push.",
      });
    }

    const hasSeedFile =
      existsSync(join(localPath, "prisma", "seed.ts")) ||
      existsSync(join(localPath, "prisma", "seed.js"));
    if (!hasSeedFile) {
      risks.push({
        severity: "low",
        category: "database",
        description: "No Prisma seed file found.",
        evidence: "prisma/seed.ts or prisma/seed.js not detected.",
        mitigation: "Add a seed file for development and test database setup.",
      });
    }
  }

  // Missing documentation
  const hasReadme =
    existsSync(join(localPath, "README.md")) ||
    existsSync(join(localPath, "readme.md"));
  if (!hasReadme) {
    risks.push({
      severity: "low",
      category: "documentation",
      description: "No README.md detected.",
      evidence: "README.md not found at repository root.",
      mitigation: "Add a README covering setup, scripts, and architecture overview.",
    });
  }

  // No test runner configured
  const hasTestRunner = allDeps.has("vitest") || allDeps.has("jest") || allDeps.has("mocha");
  if (!hasTestRunner) {
    risks.push({
      severity: "medium",
      category: "testing",
      description: "No test runner detected in dependencies.",
      evidence: "vitest, jest, and mocha are absent from dependencies.",
      mitigation: "Add a test runner (vitest recommended for Next.js projects) to enable automated testing.",
    });
  }

  return risks.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ─── Intelligence Summary ─────────────────────────────────────────────────────

function buildIntelligenceSummary(input: {
  localPath: string;
  packageManager: PackageManagerInfo;
  frameworks: readonly FrameworkInfo[];
  routes: readonly RouteInfo[];
  apiSurface: ApiSurfaceSummary;
  serverActions: readonly string[];
  apiRoutes: readonly string[];
  prismaModels: readonly PrismaModelInfo[];
  databaseLayer: DatabaseLayerSummary;
  testFiles: readonly string[];
  risks: readonly RiskFinding[];
  fileTree: FileTreeSummary;
}): string {
  const {
    packageManager,
    frameworks,
    routes,
    apiSurface,
    serverActions,
    apiRoutes,
    prismaModels,
    databaseLayer,
    testFiles,
    risks,
    fileTree,
  } = input;

  const parts: string[] = [];

  parts.push(`${fileTree.totalFiles} files across ${fileTree.totalDirs} directories.`);

  if (packageManager.name !== "unknown") {
    parts.push(`Package manager: ${packageManager.name}.`);
  }

  if (frameworks.length > 0) {
    parts.push(`Frameworks: ${frameworks.map((f) => f.name).join(", ")}.`);
  }

  const pages = routes.filter((r) => r.type === "page").length;
  const layouts = routes.filter((r) => r.type === "layout").length;
  if (pages > 0 || layouts > 0) {
    parts.push(`${pages} app pages, ${layouts} layouts detected.`);
  }

  if (apiRoutes.length > 0) {
    parts.push(`${apiRoutes.length} API route(s) detected.`);
  }

  if (serverActions.length > 0) {
    parts.push(`${serverActions.length} server action module(s) detected.`);
  }

  if (apiSurface.unknowns.length > 0) {
    parts.push(`Routing unknowns: ${apiSurface.unknowns.join(" ")}`);
  }

  if (prismaModels.length > 0) {
    parts.push(`Prisma schema with ${prismaModels.length} model(s): ${prismaModels.map((m) => m.name).join(", ")}.`);
  }

  if (databaseLayer.ownershipRisks.length > 0) {
    parts.push(`Database ownership risks: ${databaseLayer.ownershipRisks.length} model(s) need review.`);
  }

  if (databaseLayer.unknowns.length > 0) {
    parts.push(`Database unknowns: ${databaseLayer.unknowns.join(" ")}`);
  }

  if (testFiles.length > 0) {
    parts.push(`${testFiles.length} test file(s) detected.`);
  } else {
    parts.push("No test files detected.");
  }

  const highRisks = risks.filter((r) => r.severity === "high").length;
  const medRisks = risks.filter((r) => r.severity === "medium").length;
  if (highRisks > 0 || medRisks > 0) {
    parts.push(`${highRisks} high and ${medRisks} medium risk finding(s) require attention.`);
  }

  return parts.join(" ");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function readFileSafe(filePath: string): string | null {
  try {
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_READ_BYTES) return null;
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
