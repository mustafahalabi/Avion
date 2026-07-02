import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as LearningServiceModule from "./memory-learning-service";
import { setupTestSchema, teardownTestSchema } from "../test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof LearningServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("memory-learning-service"));
  service = await import("./memory-learning-service");

  // The owner User is required by the Company.ownerId foreign key, and the
  // Company is required by the Review/Memory companyId foreign keys (Postgres
  // enforces FKs, unlike the old SQLite test tables).
  await prisma.user.create({
    data: { id: "user-1", email: "owner@acme.test" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "MemoryRecord"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Memory"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SeedFinding {
  readonly severity: string;
  readonly description: string;
  readonly actionable?: boolean;
}

let reviewSeq = 0;

async function createReview(
  findings: readonly SeedFinding[],
  companyId = "company-1"
): Promise<string> {
  reviewSeq += 1;
  const id = `review-${reviewSeq}`;
  const findingsJson = JSON.stringify(findings);
  await prisma.review.create({
    data: {
      id,
      companyId,
      title: `Review ${id}`,
      entityType: "task",
      entityId: `task-${reviewSeq}`,
      status: "approved",
      findings: findingsJson,
    },
  });
  return id;
}

const RECURRING: SeedFinding = {
  severity: "blocker",
  description: "Missing error handling on async calls",
  actionable: true,
};

const ONE_OFF: SeedFinding = {
  severity: "non_blocker",
  description: "Variable name could be clearer",
  actionable: false,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("promoteRecurringLessons", () => {
  it("promotes a finding recurring at the default threshold (3×) and not the one-off", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING, ONE_OFF]);
    await createReview([RECURRING]);

    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(1);

    const standards = await prisma.memory.findMany({
      where: { companyId: "company-1", category: "standards" },
      include: { records: true },
    });
    expect(standards).toHaveLength(1);
    expect(standards[0].title).toBe("Engineering standards (learned)");

    const records = standards[0].records;
    expect(records).toHaveLength(1);
    expect(records[0].content).toBe(
      "Recurring blocker finding (3×): Missing error handling on async calls. Treat as a standard to check proactively."
    );
    expect(records[0].confidence).toBe(0.9);
    expect(records[0].source).toMatch(/^learning:/);

    // The one-off finding (only 1 occurrence) was not promoted.
    expect(
      records.some((r) => r.content.includes("Variable name could be clearer"))
    ).toBe(false);
  });

  it("is idempotent across repeated runs", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING]);
    await createReview([RECURRING]);

    const first = await service.promoteRecurringLessons("company-1");
    expect(first.promoted).toBe(1);

    const second = await service.promoteRecurringLessons("company-1");
    expect(second.promoted).toBe(0);

    const recordCount = await prisma.memoryRecord.count();
    expect(recordCount).toBe(1);
  });

  it("does not promote a finding below the threshold", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING]);

    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(0);

    const recordCount = await prisma.memoryRecord.count();
    expect(recordCount).toBe(0);
  });

  it("respects a custom threshold", async () => {
    await createReview([RECURRING]);
    await createReview([RECURRING]);

    // Below default (3) but at custom threshold (2) — should promote.
    const result = await service.promoteRecurringLessons("company-1", {
      threshold: 2,
    });
    expect(result.promoted).toBe(1);

    const records = await prisma.memoryRecord.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].content).toBe(
      "Recurring blocker finding (2×): Missing error handling on async calls. Treat as a standard to check proactively."
    );
  });

  it("normalizes findings by lowercased description + severity", async () => {
    // Same finding with cosmetic case differences should collapse to one key.
    await createReview([{ severity: "blocker", description: "SQL injection risk" }]);
    await createReview([{ severity: "blocker", description: "sql injection risk" }]);
    await createReview([{ severity: "blocker", description: "  SQL Injection Risk  " }]);

    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(1);

    const records = await prisma.memoryRecord.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].content).toContain("(3×)");
  });

  it("treats differing severities as distinct findings", async () => {
    await createReview([{ severity: "blocker", description: "Same text" }]);
    await createReview([{ severity: "blocker", description: "Same text" }]);
    await createReview([{ severity: "non_blocker", description: "Same text" }]);

    // blocker:2 and non_blocker:1, neither reaches default threshold of 3.
    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(0);
  });

  it("returns 0 when the company has no reviews", async () => {
    const result = await service.promoteRecurringLessons("company-1");
    expect(result.promoted).toBe(0);
  });
});
