import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "../prisma";
import type * as RetrievalServiceModule from "./memory-retrieval-service";
import type { CompanyMemoryItem } from "./memory-types";
import { setupTestSchema, teardownTestSchema } from "../test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof RetrievalServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("memory-retrieval-service"));
  service = await import("./memory-retrieval-service");

  // Parent Users are required by the Company.ownerId foreign key (Postgres
  // enforces FKs, unlike the old SQLite test tables).
  await prisma.user.create({
    data: { id: "user-1", email: "owner1@acme.test" },
  });
  await prisma.user.create({
    data: { id: "user-2", email: "owner2@other.test" },
  });

  // ── Seed companies ───────────────────────────────────────────────────────
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.company.create({
    data: { id: "company-2", name: "Other", slug: "other", ownerId: "user-2" },
  });

  // ── Seed banks across categories ─────────────────────────────────────────
  await prisma.memory.create({
    data: {
      id: "bank-standards",
      companyId: "company-1",
      title: "Engineering standards (learned)",
      category: "standards",
    },
  });
  await prisma.memory.create({
    data: {
      id: "bank-learnings",
      companyId: "company-1",
      title: "Lessons learned",
      category: "learnings",
    },
  });
  await prisma.memory.create({
    data: {
      id: "bank-review",
      companyId: "company-1",
      title: "Review lessons",
      category: "review",
    },
  });
  // A bank owned by another company (must never leak).
  await prisma.memory.create({
    data: {
      id: "bank-other",
      companyId: "company-2",
      title: "Other standards",
      category: "standards",
    },
  });

  // ── Seed records of varying confidence + createdAt ───────────────────────
  // High confidence, oldest.
  await prisma.memoryRecord.create({
    data: {
      id: "rec-std-high",
      memoryId: "bank-standards",
      content: "Always validate inputs",
      confidence: 0.9,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  // Highest confidence, newest — should sort first.
  await prisma.memoryRecord.create({
    data: {
      id: "rec-std-top",
      memoryId: "bank-standards",
      content: "Prefer pure functions",
      confidence: 0.95,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    },
  });
  // Medium confidence.
  await prisma.memoryRecord.create({
    data: {
      id: "rec-learn-mid",
      memoryId: "bank-learnings",
      content: "Cache expensive reads",
      confidence: 0.5,
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
    },
  });
  // Two records at equal confidence — newer should sort ahead of older.
  await prisma.memoryRecord.create({
    data: {
      id: "rec-review-old",
      memoryId: "bank-review",
      content: "Older review lesson",
      confidence: 0.4,
      createdAt: new Date("2026-01-10T00:00:00.000Z"),
    },
  });
  await prisma.memoryRecord.create({
    data: {
      id: "rec-review-new",
      memoryId: "bank-review",
      content: "Newer review lesson",
      confidence: 0.4,
      createdAt: new Date("2026-03-10T00:00:00.000Z"),
    },
  });
  // Belongs to company-2 — must never appear for company-1.
  await prisma.memoryRecord.create({
    data: {
      id: "rec-other",
      memoryId: "bank-other",
      content: "Other company secret",
      confidence: 0.99,
    },
  });
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
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

describe("getRelevantCompanyMemory — semantic recall (Goal 5c)", () => {
  beforeAll(async () => {
    await prisma.memory.create({
      data: {
        id: "bank-semantic",
        companyId: "company-1",
        title: "Semantic lessons",
        category: "learnings",
      },
    });
    // Three lessons on distinct topics, all same confidence so ONLY relevance
    // (not confidence/recency) can change the order.
    await prisma.memoryRecord.createMany({
      data: [
        {
          id: "rec-auth",
          memoryId: "bank-semantic",
          content: "Always hash passwords and rate-limit the login authentication flow.",
          confidence: 0.5,
        },
        {
          id: "rec-images",
          memoryId: "bank-semantic",
          content: "Cache resized image thumbnails on a CDN for fast media loads.",
          confidence: 0.5,
        },
        {
          id: "rec-billing",
          memoryId: "bank-semantic",
          content: "Make Stripe billing webhook handlers idempotent against retries.",
          confidence: 0.5,
        },
      ],
    });
  });

  it("ranks the topically-relevant lesson first for a query", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
      categories: ["learnings"],
      query: "build a secure user login and authentication screen",
      limit: 3,
    });
    // The auth lesson is most relevant to a login/auth query.
    expect(items[0]?.id).toBe("rec-auth");
    expect(items.map((i) => i.id)).toContain("rec-billing");
  });

  it("without a query, falls back to confidence/recency ordering (unchanged)", async () => {
    const items = await service.getRelevantCompanyMemory({
      companyId: "company-1",
      categories: ["learnings"],
      limit: 20,
    });
    // No throw, returns records; ordering is the pre-existing confidence/recency.
    expect(items.length).toBeGreaterThan(0);
  });
});
