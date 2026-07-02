import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as RepoWriteModule from "./repository-write";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let repoWrite: typeof RepoWriteModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  ({ prisma, schema } = await setupTestSchema("repository-write"));
  repoWrite = await import("./repository-write");

  // The owner User is required by the Company.ownerId foreign key (Postgres
  // enforces FKs, unlike the old SQLite test tables).
  await prisma.user.create({
    data: { id: "user-1", email: "owner@acme.test" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme Corp", slug: "acme", ownerId: "user-1" },
  });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "Repository"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Workspace"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
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
