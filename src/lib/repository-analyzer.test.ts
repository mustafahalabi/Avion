import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  analyzeRepositoryPath,
  buildApiSurfaceSummary,
  detectDatabaseLayer,
  detectPrismaModels,
  detectRoutes,
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
