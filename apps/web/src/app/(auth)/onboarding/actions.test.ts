import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import type * as OnboardingActions from "./actions";
import {
  setupTestSchema,
  teardownTestSchema,
} from "@/lib/test-utils/pg-test-db";

// The actions layer resolves the caller through Clerk; tests stand in a fake
// authenticated owner so the ownership + validation logic runs against the real DB.
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

let prisma: typeof PrismaSingleton;
let schema: string;
let actions: typeof OnboardingActions;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("actions-onboarding"));
  actions = await import("./actions");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.$executeRawUnsafe(`DELETE FROM "CompanySettings"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

function signIn(): void {
  mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "owner@acme.test" });
}

async function storedPlanningProvider(): Promise<string | null | undefined> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId: "company-1" },
    select: { planningProvider: true },
  });
  return settings?.planningProvider;
}

const BASE_INPUT = {
  companyId: "company-1",
  autonomyLevel: "assist",
  cultureProfile: "startup",
};

describe("saveCompanySettings — planning provider override (MUS-262)", () => {
  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    await expect(
      actions.saveCompanySettings({ ...BASE_INPUT, planningProvider: "ai" })
    ).rejects.toThrow(/unauthenticated/i);
    expect(await storedPlanningProvider()).toBeUndefined();
  });

  it("rejects unknown provider ids without persisting anything", async () => {
    signIn();
    await expect(
      actions.saveCompanySettings({ ...BASE_INPUT, planningProvider: "gpt" })
    ).rejects.toThrow(/not a valid planning provider/i);
    expect(await storedPlanningProvider()).toBeUndefined();
  });

  it("persists a supported provider override", async () => {
    signIn();
    await actions.saveCompanySettings({ ...BASE_INPUT, planningProvider: "ai" });
    expect(await storedPlanningProvider()).toBe("ai");
  });

  it("clears the override back to the environment default with null", async () => {
    signIn();
    await actions.saveCompanySettings({ ...BASE_INPUT, planningProvider: "ai" });
    await actions.saveCompanySettings({ ...BASE_INPUT, planningProvider: null });
    expect(await storedPlanningProvider()).toBeNull();
  });

  it("leaves the stored override unchanged when the field is omitted", async () => {
    signIn();
    await actions.saveCompanySettings({
      ...BASE_INPUT,
      planningProvider: "deterministic",
    });
    await actions.saveCompanySettings(BASE_INPUT);
    expect(await storedPlanningProvider()).toBe("deterministic");
  });
});
