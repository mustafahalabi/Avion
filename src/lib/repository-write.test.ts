import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as RepoWriteModule from "./repository-write";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let repoWrite: typeof RepoWriteModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  dbPath = join(
    tmpdir(),
    `repository-write-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  repoWrite = await import("./repository-write");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Workspace" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_companyId_slug_key" ON "Workspace"("companyId","slug")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Repository" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "url" TEXT,
      "description" TEXT,
      "primaryLanguage" TEXT,
      "techStack" TEXT NOT NULL DEFAULT '[]',
      "frameworks" TEXT NOT NULL DEFAULT '[]',
      "dependencies" TEXT NOT NULL DEFAULT '[]',
      "importantFiles" TEXT NOT NULL DEFAULT '[]',
      "fileCount" INTEGER,
      "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
      "analysisNotes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme Corp','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "Repository"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Workspace"`);
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    rmSync(dbPath, { force: true });
  } catch {
    // ignore cleanup failures
  }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("normalizeRepoUrl", () => {
  it("strips .git, trailing slashes, and lowercases", () => {
    expect(repoWrite.normalizeRepoUrl("https://github.com/Acme/Repo.git")).toBe(
      "https://github.com/acme/repo"
    );
    expect(repoWrite.normalizeRepoUrl("https://github.com/acme/repo/")).toBe(
      "https://github.com/acme/repo"
    );
  });
});

describe("csvToArray", () => {
  it("splits, trims, and drops blanks", () => {
    expect(repoWrite.csvToArray(" a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(repoWrite.csvToArray("")).toEqual([]);
    expect(repoWrite.csvToArray(undefined)).toEqual([]);
  });
});

describe("createRepositoryRecord", () => {
  it("creates exactly one Default workspace and JSON-stringifies arrays", async () => {
    const repo = await repoWrite.createRepositoryRecord({
      companyId: "company-1",
      name: "widgets",
      url: "https://github.com/acme/widgets",
      techStack: ["Next.js", "Prisma"],
      frameworks: ["React"],
    });

    expect(repo.name).toBe("widgets");
    expect(repo.analysisStatus).toBe("pending");
    expect(repo.techStack).toBe(JSON.stringify(["Next.js", "Prisma"]));
    expect(repo.frameworks).toBe(JSON.stringify(["React"]));
    expect(repo.dependencies).toBe("[]");

    const workspaces = await prisma.workspace.findMany({
      where: { companyId: "company-1" },
    });
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].slug).toBe("default");
  });

  it("reuses the existing workspace for a second repository", async () => {
    await repoWrite.createRepositoryRecord({ companyId: "company-1", name: "a" });
    await repoWrite.createRepositoryRecord({ companyId: "company-1", name: "b" });
    const workspaces = await prisma.workspace.findMany({
      where: { companyId: "company-1" },
    });
    expect(workspaces).toHaveLength(1);
  });
});

describe("findRepositoryByUrl (import idempotency)", () => {
  it("matches a previously imported url regardless of .git/case/trailing slash", async () => {
    const created = await repoWrite.createRepositoryRecord({
      companyId: "company-1",
      name: "widgets",
      url: "https://github.com/acme/widgets",
    });

    const match = await repoWrite.findRepositoryByUrl(
      "company-1",
      "https://github.com/Acme/widgets.git/"
    );
    expect(match?.id).toBe(created.id);
  });

  it("returns null for an unknown url or empty input", async () => {
    expect(await repoWrite.findRepositoryByUrl("company-1", "https://x/y")).toBeNull();
    expect(await repoWrite.findRepositoryByUrl("company-1", "")).toBeNull();
  });

  it("simulates idempotent import — second import reuses the same record", async () => {
    const url = "https://github.com/acme/widgets";
    const first = await repoWrite.createRepositoryRecord({
      companyId: "company-1",
      name: "widgets",
      url,
    });

    // Import flow: dedupe before create.
    const existing = await repoWrite.findRepositoryByUrl("company-1", url);
    expect(existing?.id).toBe(first.id);

    const count = await prisma.repository.count();
    expect(count).toBe(1);
  });
});
