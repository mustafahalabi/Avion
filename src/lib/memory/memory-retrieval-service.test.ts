import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as RetrievalServiceModule from "./memory-retrieval-service";
import type { CompanyMemoryItem } from "./memory-types";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof RetrievalServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `memory-retrieval-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("../prisma");
  prisma = prismaModule.prisma;
  service = await import("./memory-retrieval-service");

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
    CREATE TABLE IF NOT EXISTS "Memory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "summary" TEXT,
      "category" TEXT NOT NULL DEFAULT 'company',
      "ownerType" TEXT,
      "ownerId" TEXT,
      "tags" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MemoryRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "memoryId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "source" TEXT,
      "confidence" REAL NOT NULL DEFAULT 1.0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "MemoryRecord_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // ── Seed companies ───────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-2','Other','other','user-2',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);

  // ── Seed banks across categories ─────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Memory" ("id","companyId","title","category","createdAt","updatedAt")
    VALUES ('bank-standards','company-1','Engineering standards (learned)','standards',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Memory" ("id","companyId","title","category","createdAt","updatedAt")
    VALUES ('bank-learnings','company-1','Lessons learned','learnings',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Memory" ("id","companyId","title","category","createdAt","updatedAt")
    VALUES ('bank-review','company-1','Review lessons','review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  // A bank owned by another company (must never leak).
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Memory" ("id","companyId","title","category","createdAt","updatedAt")
    VALUES ('bank-other','company-2','Other standards','standards',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);

  // ── Seed records of varying confidence + createdAt ───────────────────────
  // High confidence, oldest.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MemoryRecord" ("id","memoryId","content","confidence","createdAt","updatedAt")
    VALUES ('rec-std-high','bank-standards','Always validate inputs',0.9,'2026-01-01T00:00:00.000Z',CURRENT_TIMESTAMP)
  `);
  // Highest confidence, newest — should sort first.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MemoryRecord" ("id","memoryId","content","confidence","createdAt","updatedAt")
    VALUES ('rec-std-top','bank-standards','Prefer pure functions',0.95,'2026-02-01T00:00:00.000Z',CURRENT_TIMESTAMP)
  `);
  // Medium confidence.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MemoryRecord" ("id","memoryId","content","confidence","createdAt","updatedAt")
    VALUES ('rec-learn-mid','bank-learnings','Cache expensive reads',0.5,'2026-01-15T00:00:00.000Z',CURRENT_TIMESTAMP)
  `);
  // Two records at equal confidence — newer should sort ahead of older.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MemoryRecord" ("id","memoryId","content","confidence","createdAt","updatedAt")
    VALUES ('rec-review-old','bank-review','Older review lesson',0.4,'2026-01-10T00:00:00.000Z',CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MemoryRecord" ("id","memoryId","content","confidence","createdAt","updatedAt")
    VALUES ('rec-review-new','bank-review','Newer review lesson',0.4,'2026-03-10T00:00:00.000Z',CURRENT_TIMESTAMP)
  `);
  // Belongs to company-2 — must never appear for company-1.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MemoryRecord" ("id","memoryId","content","confidence","createdAt","updatedAt")
    VALUES ('rec-other','bank-other','Other company secret',0.99,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    rmSync(dbPath, { force: true });
  } catch {
    /* ignore */
  }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("getRelevantCompanyMemory", () => {
  it("orders items by confidence desc then createdAt desc", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
    });
    const ids = items.map((i) => i.id);
    // Highest confidence first (0.95), then 0.9, then 0.5, then the two 0.4s
    // ordered newest-first.
    expect(ids).toEqual([
      "rec-std-top",
      "rec-std-high",
      "rec-learn-mid",
      "rec-review-new",
      "rec-review-old",
    ]);
  });

  it("breaks confidence ties by createdAt descending", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
    });
    const newIndex = items.findIndex((i) => i.id === "rec-review-new");
    const oldIndex = items.findIndex((i) => i.id === "rec-review-old");
    expect(newIndex).toBeGreaterThanOrEqual(0);
    expect(newIndex).toBeLessThan(oldIndex);
  });

  it("respects an explicit categories filter", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
      categories: ["standards"],
    });
    expect(items.map((i) => i.id)).toEqual(["rec-std-top", "rec-std-high"]);
    expect(items.every((i) => i.category === "standards")).toBe(true);
  });

  it("respects the limit", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
      limit: 2,
    });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(["rec-std-top", "rec-std-high"]);
  });

  it("is scoped to the company", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
    });
    expect(items.some((i) => i.id === "rec-other")).toBe(false);
    expect(items.every((i) => i.content !== "Other company secret")).toBe(true);
  });

  it("returns the full CompanyMemoryItem shape", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
      categories: ["standards"],
      limit: 1,
    });
    const [top] = items;
    expect(top).toMatchObject({
      id: "rec-std-top",
      category: "standards",
      bankTitle: "Engineering standards (learned)",
      content: "Prefer pure functions",
      source: null,
      confidence: 0.95,
    });
    expect(top.createdAt).toBeInstanceOf(Date);
  });

  it("returns an empty array for a company with no memory", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-2",
      categories: ["learnings"],
    });
    expect(items).toEqual([]);
  });
});

describe("formatMemoryForPrompt", () => {
  it("renders '- [category] content' lines", () => {
    const items: CompanyMemoryItem[] = [
      {
        id: "a",
        category: "standards",
        bankTitle: "Engineering standards (learned)",
        content: "Always validate inputs",
        source: null,
        confidence: 0.9,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "b",
        category: "review",
        bankTitle: "Review lessons",
        content: "Check error handling",
        source: "review:1",
        confidence: 0.5,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ];
    expect(service.formatMemoryForPrompt(items)).toBe(
      "- [standards] Always validate inputs\n- [review] Check error handling"
    );
  });

  it("returns an empty string for an empty list", () => {
    expect(service.formatMemoryForPrompt([])).toBe("");
  });

  it("renders DB-retrieved items as bullet lines", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
      categories: ["standards"],
    });
    const formatted = service.formatMemoryForPrompt(items);
    expect(formatted).toBe(
      "- [standards] Prefer pure functions\n- [standards] Always validate inputs"
    );
  });
});
