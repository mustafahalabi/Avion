import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as DraftServiceModule from "./planning-draft-service";
import { resolvePlanningAdapter } from "@/lib/planning/planning-provider";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// MUS-262: spy on the provider seam so tests can assert which provider override the
// service requests per company. Generation itself always runs the deterministic
// adapter here so no real AI CLI is ever invoked.
vi.mock("@/lib/planning/planning-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/planning/planning-provider")>();
  return {
    ...actual,
    resolvePlanningAdapter: vi.fn(() =>
      actual.resolvePlanningAdapter({ provider: "deterministic" })
    ),
  };
});

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof DraftServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("planning-draft-service"));
  service = await import("./planning-draft-service");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "PlanningDraft"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RuntimeEvent"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Outcome"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RuntimeRequest"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "CompanySettings"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

async function seedOutcome(): Promise<string> {
  const outcome = await prisma.outcome.create({
    data: {
      companyId: "company-1",
      title: "Repository intelligence",
      rawRequest:
        "Understand our repository: detect the package manager, routes, and database layer.",
      status: "proposed",
    },
  });
  return outcome.id;
}

describe("createOrUpdatePlanningDraftForOutcome — draft versioning (MUS-259)", () => {
  it("creates the initial draft at version 1", async () => {
    const outcomeId = await seedOutcome();

    const response = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    const draft = await prisma.planningDraft.findUnique({
      where: { id: response.planningDraftId },
      select: { version: true },
    });
    expect(draft?.version).toBe(1);
  });

  it("reuses an existing live draft instead of regenerating", async () => {
    const outcomeId = await seedOutcome();
    const first = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    const second = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    expect(second.planningDraftId).toBe(first.planningDraftId);
    expect(second.message).toMatch(/already exists/i);
  });

  it("generates a NEW draft version after the CEO rejects the latest draft", async () => {
    const outcomeId = await seedOutcome();
    const first = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    // The CEO rejects the plan.
    await prisma.planningDraft.update({
      where: { id: first.planningDraftId },
      data: { status: "rejected", rejectedAt: new Date() },
    });

    const replanned = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    // The outcome is no longer stranded: a fresh draft exists at version 2.
    expect(replanned.planningDraftId).not.toBe(first.planningDraftId);
    const drafts = await prisma.planningDraft.findMany({
      where: { companyId: "company-1", outcomeId },
      orderBy: { version: "asc" },
      select: { id: true, version: true, status: true },
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0].status).toBe("rejected");
    expect(drafts[1].version).toBe(2);
    expect(drafts[1].id).toBe(replanned.planningDraftId);
  });

  it("regenerates a failed draft in place at the same version", async () => {
    const outcomeId = await seedOutcome();
    const first = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });
    await prisma.planningDraft.update({
      where: { id: first.planningDraftId },
      data: { status: "failed" },
    });

    const retried = await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    expect(retried.planningDraftId).toBe(first.planningDraftId);
    const drafts = await prisma.planningDraft.findMany({
      where: { companyId: "company-1", outcomeId },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].version).toBe(1);
  });
});

describe("createOrUpdatePlanningDraftForOutcome — per-company planning provider (MUS-262)", () => {
  it("passes a stored CompanySettings override through to the provider resolver", async () => {
    await prisma.companySettings.create({
      data: { companyId: "company-1", planningProvider: "ai" },
    });
    const outcomeId = await seedOutcome();

    await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    expect(vi.mocked(resolvePlanningAdapter).mock.lastCall).toEqual([
      { provider: "ai" },
    ]);
  });

  it("passes null (environment fallback) when the company stores no override", async () => {
    await prisma.companySettings.create({ data: { companyId: "company-1" } });
    const outcomeId = await seedOutcome();

    await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    expect(vi.mocked(resolvePlanningAdapter).mock.lastCall).toEqual([
      { provider: null },
    ]);
  });

  it("passes null (environment fallback) when the company has no settings row", async () => {
    const outcomeId = await seedOutcome();

    await service.createOrUpdatePlanningDraftForOutcome({
      companyId: "company-1",
      outcomeId,
      actorId: "user-1",
    });

    expect(vi.mocked(resolvePlanningAdapter).mock.lastCall).toEqual([
      { provider: null },
    ]);
  });
});
