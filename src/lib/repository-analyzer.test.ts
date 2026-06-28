import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  analyzeRepositoryPath,
  buildApiSurfaceSummary,
  detectDatabaseLayer,
  detectPackageManager,
  detectPrismaModels,
  detectRoutes,
  deriveValidationCommandsFromManifest,
  formatPackageScriptCommand,
  mapNextJsAppRouterFileToUrlPath,
  parsePrismaModelOwnershipFields,
  type FileEntry,
} from "./repository-analyzer";

const tempDirs: string[] = [];

const ENGINEERING_OS_SCHEMA = `
datasource db {
  provider = "sqlite"
}

model User {
  id    String @id @default(cuid())
  email String @unique
}

model Company {
  id   String @id @default(cuid())
  name String
}

model Project {
  id        String @id @default(cuid())
  companyId String
  name      String
  company   Company @relation(fields: [companyId], references: [id])
}

model Subtask {
  id   String @id @default(cuid())
  name String
}
`;

/**
 * Creates a disposable repository fixture directory for analyzer tests.
 *
 * @param name - Optional suffix for the temp directory name.
 * @returns Absolute path to the created fixture directory.
 */
function createFixtureRoot(name = "repo"): string {
  const root = mkdtempSync(join(tmpdir(), `engineering-os-analyzer-${name}-`));
  tempDirs.push(root);
  return root;
}

/**
 * Writes a UTF-8 file under a fixture root, creating parent directories as needed.
 *
 * @param root - Fixture repository root.
 * @param relativePath - Path relative to the repository root.
 * @param content - File contents.
 */
function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("parsePrismaModelOwnershipFields", () => {
  it("detects company-scoped ownership fields on a model block", () => {
    const fields = parsePrismaModelOwnershipFields(`
  id        String @id @default(cuid())
  companyId String
  name      String
`);

    expect(fields).toEqual(["companyId"]);
  });
});

describe("detectDatabaseLayer", () => {
  it("detects Prisma schema, migrations, seeds, models, and ownership risks", () => {
    const root = createFixtureRoot("prisma");
    writeFixtureFile(root, "package.json", JSON.stringify({
      name: "engineering-os",
      private: true,
      dependencies: { "@prisma/client": "^7.0.0" },
      devDependencies: { prisma: "^7.0.0" },
      prisma: { seed: "tsx prisma/seed.ts" },
    }));
    writeFixtureFile(root, "prisma/schema.prisma", ENGINEERING_OS_SCHEMA);
    writeFixtureFile(root, "prisma/seed.ts", "console.log('seed');\n");
    writeFixtureFile(root, "prisma/migrations/20260627181500_init/migration.sql", "CREATE TABLE test;\n");
    writeFixtureFile(root, "src/index.ts", "export {};\n");

    const models = detectPrismaModels(root);
    const layer = detectDatabaseLayer(root, ["@prisma/client"], ["prisma"], models);

    expect(layer.technology).toBe("prisma");
    expect(layer.schemaPaths).toEqual(["prisma/schema.prisma"]);
    expect(layer.migrationPaths).toEqual(["prisma/migrations/20260627181500_init"]);
    expect(layer.seedPaths.some((path) => path.includes("prisma/seed.ts"))).toBe(true);
    expect(layer.models.map((model) => model.name)).toEqual(["Company", "Project", "Subtask", "User"]);
    expect(layer.models.find((model) => model.name === "Project")?.ownershipFields).toEqual(["companyId"]);
    expect(layer.ownershipRisks.some((risk) => risk.includes("Subtask"))).toBe(true);
  });
});

describe("mapNextJsAppRouterFileToUrlPath", () => {
  it("maps grouped App Router pages and API routes to URL paths", () => {
    expect(mapNextJsAppRouterFileToUrlPath("src/app/(app)/work/page.tsx", "src/app", "page")).toBe("/work");
    expect(mapNextJsAppRouterFileToUrlPath("src/app/(app)/work/tasks/[id]/page.tsx", "src/app", "page")).toBe(
      "/work/tasks/[id]"
    );
    expect(mapNextJsAppRouterFileToUrlPath("src/app/api/health/route.ts", "src/app", "api")).toBe("/api/health");
    expect(mapNextJsAppRouterFileToUrlPath("src/app/layout.tsx", "src/app", "layout")).toBe("/");
  });
});

describe("analyzeRepositoryPath — Engineering OS schema", () => {
  it("includes database layer output in repository intelligence summary", () => {
    const root = createFixtureRoot("analysis");
    writeFixtureFile(root, "package-lock.json", "{}");
    writeFixtureFile(
      root,
      "package.json",
      JSON.stringify({
        name: "engineering-os",
        private: true,
        dependencies: { "@prisma/client": "^7.0.0", next: "^16.0.0" },
        devDependencies: { prisma: "^7.0.0", typescript: "^5.0.0" },
      })
    );
    writeFixtureFile(root, "prisma/schema.prisma", ENGINEERING_OS_SCHEMA);
    writeFixtureFile(root, "prisma/migrations/20260627181500_init/migration.sql", "CREATE TABLE test;\n");
    writeFixtureFile(root, "src/app/page.tsx", "export default function Page() { return null; }\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.databaseLayer.technology).toBe("prisma");
    expect(outcome.databaseLayer.schemaPaths).toContain("prisma/schema.prisma");
    expect(outcome.prismaModels.some((model) => model.name === "Project")).toBe(true);
    expect(outcome.intelligenceSummary).toContain("Prisma schema with");
    expect(outcome.intelligenceSummary).toContain("Database ownership risks");
  });
});

describe("analyzeRepositoryPath — framework, routes, and API surface", () => {
  it("detects Engineering OS-style Next.js App Router structure", () => {
    const root = createFixtureRoot("engineering-os");
    writeFixtureFile(root, "package-lock.json", "{}");
    writeFixtureFile(
      root,
      "package.json",
      JSON.stringify({
        name: "engineering-os",
        private: true,
        dependencies: { next: "^16.0.0", react: "^19.0.0", "@prisma/client": "^7.0.0" },
        devDependencies: { typescript: "^5.0.0", vitest: "^4.0.0" },
      })
    );
    writeFixtureFile(root, "src/app/layout.tsx", "export default function RootLayout() { return null; }\n");
    writeFixtureFile(root, "src/app/(app)/dashboard/page.tsx", "export default function DashboardPage() { return null; }\n");
    writeFixtureFile(root, "src/app/(app)/work/tasks/[id]/page.tsx", "export default function TaskPage() { return null; }\n");
    writeFixtureFile(root, "src/app/api/health/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
    writeFixtureFile(
      root,
      "src/app/actions/planning.ts",
      `"use server";\nexport async function generatePlanningDraft() { return { ok: true }; }\n`
    );
    writeFixtureFile(root, "src/proxy.ts", "export function proxy() {}\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.frameworks.some((framework) => framework.name.includes("Next.js (App Router)"))).toBe(true);
    expect(outcome.frameworks[0]?.confidence).toBe("high");
    expect(outcome.frameworks[0]?.evidence).toContain("src/app or app directory found");

    const dashboardPage = outcome.routes.find((route) => route.path.endsWith("dashboard/page.tsx"));
    expect(dashboardPage?.urlPath).toBe("/dashboard");
    expect(outcome.apiSurface.pages.length).toBeGreaterThanOrEqual(2);
    expect(outcome.apiSurface.apiRoutes.some((route) => route.urlPath === "/api/health")).toBe(true);
    expect(outcome.serverActions).toContain("src/app/actions/planning.ts");
    expect(outcome.apiSurface.serverActionModules).toContain("src/app/actions/planning.ts");
    expect(outcome.apiSurface.middleware.some((route) => route.path.endsWith("src/proxy.ts"))).toBe(true);
    expect(outcome.intelligenceSummary).toContain("API route(s) detected");
    expect(outcome.intelligenceSummary).toContain("server action module(s) detected");
  });

  it("records explicit routing unknowns when Next.js is declared without route files", () => {
    const root = createFixtureRoot("next-unknown");
    writeFixtureFile(
      root,
      "package.json",
      JSON.stringify({ name: "demo", private: true, dependencies: { next: "^16.0.0" } })
    );
    writeFixtureFile(root, "src/index.ts", "export {};\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.frameworks[0]?.confidence).toBe("medium");
    expect(outcome.apiSurface.unknowns.length).toBeGreaterThan(0);
    expect(outcome.intelligenceSummary).toContain("Routing unknowns:");
  });

  it("buildApiSurfaceSummary groups route artifacts with evidence paths", () => {
    const routes = detectRoutes(process.cwd(), [
      {
        path: "src/app/(app)/dashboard/page.tsx",
        type: "file",
        extension: ".tsx",
        size: 10,
        category: "source",
        purposeGuess: "App Router page",
      },
    ] satisfies FileEntry[]);

    const summary = buildApiSurfaceSummary(routes, ["src/app/actions/planning.ts"], [
      {
        name: "Next.js (App Router)",
        version: "16.0.0",
        confidence: "high",
        evidence: ["src/app directory found"],
      },
    ]);

    expect(summary.pages.length).toBeGreaterThan(0);
    expect(summary.pages[0]?.evidence).toContain("App Router");
    expect(summary.serverActionModules).toEqual(["src/app/actions/planning.ts"]);
  });
});

describe("detectPackageManager", () => {
  it.each([
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["bun.lock", "bun"],
  ] as const)("detects %s as %s", (lockfile, expected) => {
    const root = createFixtureRoot(expected);
    writeFixtureFile(root, "package.json", '{"name":"demo","private":true}');
    writeFixtureFile(root, lockfile, lockfile.endsWith(".json") ? "{}" : "");

    expect(detectPackageManager(root).name).toBe(expected);
  });

  it("uses the packageManager field when no lockfile is present", () => {
    const root = createFixtureRoot("pnpm-field");
    writeFixtureFile(
      root,
      "package.json",
      '{"name":"demo","private":true,"packageManager":"pnpm@9.0.0"}'
    );

    expect(detectPackageManager(root).name).toBe("pnpm");
  });

  it("returns unknown when no manifest or lockfile exists", () => {
    const root = createFixtureRoot("unknown");
    expect(detectPackageManager(root).name).toBe("unknown");
  });
});

describe("deriveValidationCommandsFromManifest", () => {
  it("formats validation commands for the detected package manager", () => {
    const root = createFixtureRoot("scripts");
    writeFixtureFile(
      root,
      "package.json",
      JSON.stringify({
        name: "demo",
        private: true,
        scripts: {
          lint: "eslint .",
          build: "next build",
          test: "vitest run",
          "type-check": "tsc --noEmit",
        },
      })
    );

    expect(deriveValidationCommandsFromManifest(root, "pnpm")).toEqual([
      "pnpm type-check",
      "pnpm lint",
      "pnpm build",
      "pnpm test",
    ]);
    expect(formatPackageScriptCommand("yarn", "lint")).toBe("yarn lint");
    expect(formatPackageScriptCommand("npm", "test")).toBe("npm run test");
  });
});

describe("analyzeRepositoryPath — package manager and dependency graph", () => {
  it("parses dependencies, dev dependencies, and scripts from package.json", () => {
    const root = createFixtureRoot("manifest");
    writeFixtureFile(root, "package-lock.json", "{}");
    writeFixtureFile(
      root,
      "package.json",
      JSON.stringify({
        name: "demo",
        private: true,
        dependencies: { next: "^16.0.0", react: "^19.0.0" },
        devDependencies: { eslint: "^9.0.0", typescript: "^5.0.0", vitest: "^4.0.0" },
        scripts: {
          dev: "next dev",
          build: "next build",
          lint: "eslint .",
          test: "vitest run",
          typecheck: "tsc --noEmit",
        },
      })
    );
    writeFixtureFile(root, "src/index.ts", "export {};\n");
    writeFixtureFile(root, "src/index.test.ts", "it('works', () => {});\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.packageManager.name).toBe("npm");
    expect(outcome.dependencies).toEqual(["next", "react"]);
    expect(outcome.devDependencies).toEqual(["eslint", "typescript", "vitest"]);
    expect(outcome.scripts.build).toBe("next build");
    expect(outcome.scripts.lint).toBe("eslint .");
    expect(outcome.scripts.test).toBe("vitest run");
    expect(outcome.scripts.typecheck).toBe("tsc --noEmit");
    expect(outcome.validationCommands).toEqual([
      "npm run typecheck",
      "npm run lint",
      "npm run build",
      "npm run test",
    ]);
  });

  it("surfaces dependency risks for missing manifests and conflicting lockfiles", () => {
    const root = createFixtureRoot("dependency-risks");
    writeFixtureFile(root, "package.json", '{"name":"demo","private":true}');
    writeFixtureFile(root, "package-lock.json", "{}");
    writeFixtureFile(root, "yarn.lock", "# yarn\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(
      outcome.risks.some(
        (risk) => risk.category === "dependencies" && risk.description.includes("Multiple package manager lockfiles")
      )
    ).toBe(true);
  });

  it("detects pnpm workspaces from pnpm-workspace.yaml", () => {
    const root = createFixtureRoot("pnpm-workspace");
    writeFixtureFile(root, "pnpm-lock.yaml", "lockfileVersion: 9\n");
    writeFixtureFile(root, "package.json", '{"name":"workspace","private":true}');
    writeFixtureFile(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    writeFixtureFile(root, "packages/web/package.json", '{"name":"web","private":true}');
    writeFixtureFile(root, "packages/web/index.ts", "export {};\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.packageManager.name).toBe("pnpm");
    expect(outcome.packageManager.workspaces).toEqual(["packages/*"]);
  });
});

describe("analyzeRepositoryPath — file tree ingestion", () => {
  it("returns a truthful error when the repository path does not exist", () => {
    const outcome = analyzeRepositoryPath(join(tmpdir(), "missing-repository-path"));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("Expected analysis failure");
    expect(outcome.error).toContain("does not exist");
  });

  it("returns a truthful error when the path is not a directory", () => {
    const root = createFixtureRoot("file-not-dir");
    const filePath = join(root, "not-a-directory.txt");
    writeFileSync(filePath, "hello", "utf8");

    const outcome = analyzeRepositoryPath(filePath);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("Expected analysis failure");
    expect(outcome.error).toContain("not a directory");
  });

  it("captures directories, files, extensions, sizes, and important paths for a shallow repo", () => {
    const root = createFixtureRoot("shallow");
    writeFixtureFile(root, "package.json", '{"name":"demo","private":true}');
    writeFixtureFile(root, "src/lib/example.ts", 'export const value = "demo";\n');
    writeFixtureFile(root, "prisma/schema.prisma", 'model User { id String @id }\n');

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.fileTree.totalFiles).toBeGreaterThanOrEqual(3);
    expect(outcome.fileTree.totalDirs).toBeGreaterThanOrEqual(2);
    expect(outcome.fileTree.topLevelDirs).toContain("src");
    expect(outcome.fileTree.topLevelDirs).toContain("prisma");
    expect(outcome.fileTree.byExtension[".ts"]).toBeGreaterThanOrEqual(1);
    expect(outcome.fileTree.byCategory.source).toBeGreaterThanOrEqual(1);
    expect(outcome.fileTree.importantPaths).toContain("package.json");
    expect(outcome.fileTree.importantPaths).toContain("prisma/schema.prisma");

    const exampleFingerprint = outcome.fileFingerprints.find(
      (fingerprint) => fingerprint.path === "src/lib/example.ts"
    );
    expect(exampleFingerprint?.size).toBeGreaterThan(0);
    expect(exampleFingerprint?.extension).toBe(".ts");
  });

  it("excludes ignored vendor, build, and dependency directories", () => {
    const root = createFixtureRoot("ignored");
    writeFixtureFile(root, "package.json", '{"name":"demo","private":true}');
    writeFixtureFile(root, "src/index.ts", "export {};\n");
    writeFixtureFile(root, "node_modules/lodash/index.js", "module.exports = {};\n");
    writeFixtureFile(root, ".next/server/app.js", "console.log('build');\n");
    writeFixtureFile(root, "dist/output.js", "console.log('dist');\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    const paths = outcome.fileFingerprints.map((fingerprint) => fingerprint.path);
    expect(paths).toContain("src/index.ts");
    expect(paths.some((path) => path.includes("node_modules"))).toBe(false);
    expect(paths.some((path) => path.includes(".next"))).toBe(false);
    expect(paths.some((path) => path.includes("dist/"))).toBe(false);
    expect(outcome.fileTree.topLevelDirs).not.toContain("node_modules");
    expect(outcome.fileTree.topLevelDirs).not.toContain(".next");
    expect(outcome.fileTree.topLevelDirs).not.toContain("dist");
  });

  it("covers nested and workspace-style repository structures", () => {
    const root = createFixtureRoot("nested");
    writeFixtureFile(root, "package.json", '{"name":"workspace","private":true,"workspaces":["packages/*"]}');
    writeFixtureFile(root, "packages/web/package.json", '{"name":"web","private":true}');
    writeFixtureFile(root, "packages/web/src/app/page.tsx", "export default function Page() { return null; }\n");
    writeFixtureFile(root, "packages/web/src/app/layout.tsx", "export default function Layout({ children }: { children: React.ReactNode }) { return children; }\n");

    const outcome = analyzeRepositoryPath(root);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("Expected analysis success");

    expect(outcome.fileTree.topLevelDirs).toContain("packages");
    expect(outcome.fileFingerprints.some((fingerprint) => fingerprint.path.includes("packages/web/src/app/page.tsx"))).toBe(
      true
    );
    expect(outcome.fileTree.byExtension[".tsx"]).toBeGreaterThanOrEqual(2);
    expect(outcome.fileTree.importantPaths.some((path) => path.endsWith("package.json"))).toBe(true);
  });

  it("produces stable file tree output for repeated analysis of the same repository", () => {
    const root = createFixtureRoot("stable");
    writeFixtureFile(root, "package.json", '{"name":"stable","private":true}');
    writeFixtureFile(root, "src/lib/stable.ts", "export const stable = true;\n");

    const first = analyzeRepositoryPath(root);
    const second = analyzeRepositoryPath(root);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("Expected analysis success");

    expect(first.fileTree).toEqual(second.fileTree);
    expect(first.fileFingerprints).toEqual(second.fileFingerprints);
  });
});
