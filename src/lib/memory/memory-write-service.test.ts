import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as MemoryWriteServiceModule from "./memory-write-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof MemoryWriteServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `memory-write-service-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("../prisma");
  prisma = prismaModule.prisma;
  service = await import("./memory-write-service");

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
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Memory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-2','Other','other','user-2',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "MemoryRecord"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Memory"`);
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

describe("memory-write-service", () => {
  describe("recordCompanyMemory — bank + record creation", () => {
    it("creates a bank and a record on first write", async () => {
      const result = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "Prefer integration tests for DB-backed services.",
        source: "review:r1",
      });

      expect(result.created).toBe(true);
      expect(result.memoryId).toBeTruthy();
      expect(result.recordId).toBeTruthy();

      const banks = await prisma.memory.findMany({ where: { companyId: "company-1" } });
      expect(banks).toHaveLength(1);
      expect(banks[0]?.title).toBe("Review lessons");
      expect(banks[0]?.category).toBe("review");

      const records = await prisma.memoryRecord.findMany({ where: { memoryId: result.memoryId } });
      expect(records).toHaveLength(1);
      expect(records[0]?.content).toBe("Prefer integration tests for DB-backed services.");
      expect(records[0]?.source).toBe("review:r1");
    });
  });

  describe("recordCompanyMemory — bank reuse", () => {
    it("reuses the same bank for the same (companyId, category, title)", async () => {
      const first = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "First lesson.",
        source: "review:r1",
      });
      const second = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "Second lesson.",
        source: "review:r2",
      });

      expect(first.created).toBe(true);
      expect(second.created).toBe(true);
      expect(second.memoryId).toBe(first.memoryId);

      const banks = await prisma.memory.findMany({ where: { companyId: "company-1" } });
      expect(banks).toHaveLength(1);

      const records = await prisma.memoryRecord.findMany({ where: { memoryId: first.memoryId } });
      expect(records).toHaveLength(2);
    });

    it("keeps separate banks per category and per company", async () => {
      const review = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "Review lesson.",
        source: "review:r1",
      });
      const qa = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "qa",
        bankTitle: "QA lessons",
        content: "QA lesson.",
        source: "qa:q1",
      });
      const otherCompany = await service.recordCompanyMemory({
        companyId: "company-2",
        category: "review",
        bankTitle: "Review lessons",
        content: "Other company review lesson.",
        source: "review:r1",
      });

      expect(review.memoryId).not.toBe(qa.memoryId);
      expect(review.memoryId).not.toBe(otherCompany.memoryId);

      const company1Banks = await prisma.memory.findMany({ where: { companyId: "company-1" } });
      expect(company1Banks).toHaveLength(2);
      const company2Banks = await prisma.memory.findMany({ where: { companyId: "company-2" } });
      expect(company2Banks).toHaveLength(1);
    });
  });

  describe("recordCompanyMemory — idempotency by source", () => {
    it("does not add a second record for the same source", async () => {
      const first = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "Original lesson.",
        source: "review:r1",
      });
      const second = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "Original lesson (re-ingested).",
        source: "review:r1",
      });

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.recordId).toBe(first.recordId);
      expect(second.memoryId).toBe(first.memoryId);

      const records = await prisma.memoryRecord.findMany({ where: { memoryId: first.memoryId } });
      expect(records).toHaveLength(1);
      // The original content is preserved (idempotent skip, not an update).
      expect(records[0]?.content).toBe("Original lesson.");
    });
  });

  describe("recordCompanyMemory — confidence and tags", () => {
    it("applies confidence on the record and tags on the bank", async () => {
      const result = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "release",
        bankTitle: "Release lessons",
        content: "Ship behind a flag.",
        source: "release:rel1",
        confidence: 0.42,
        tags: ["release", "rollout"],
      });

      const record = await prisma.memoryRecord.findUnique({ where: { id: result.recordId } });
      expect(record?.confidence).toBeCloseTo(0.42);

      const bank = await prisma.memory.findUnique({ where: { id: result.memoryId } });
      expect(JSON.parse(bank?.tags ?? "[]")).toEqual(["release", "rollout"]);
    });

    it("defaults confidence to 1.0 when omitted", async () => {
      const result = await service.recordCompanyMemory({
        companyId: "company-1",
        category: "review",
        bankTitle: "Review lessons",
        content: "Default confidence lesson.",
        source: "review:r1",
      });

      const record = await prisma.memoryRecord.findUnique({ where: { id: result.recordId } });
      expect(record?.confidence).toBeCloseTo(1.0);
    });
  });
});
