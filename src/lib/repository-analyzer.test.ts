import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  analyzeRepositoryPath,
  detectDatabaseLayer,
  detectPrismaModels,
  parsePrismaModelOwnershipFields,
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
  const root = mkdtempSync(join(tmpdir(), `engineering-os-database-${name}-`));
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
