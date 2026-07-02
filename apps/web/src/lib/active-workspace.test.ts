import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server actions read the active-workspace cookie via next/headers; outside a
// request scope the store is empty (falls back to the first workspace).
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import type { prisma as PrismaSingleton } from "./prisma";
import type * as ActiveWorkspaceModule from "./active-workspace";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let mod: typeof ActiveWorkspaceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("active-workspace"));
  mod = await import("./active-workspace");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

describe("resolveDefaultRepositoryId (MUS-259)", () => {
  it("returns null when the company has no repositories", async () => {
    expect(await mod.resolveDefaultRepositoryId("company-1")).toBeNull();
  });

  it("prefers the active (first) workspace's most recent repository", async () => {
    const wsA = await prisma.workspace.create({
      data: { name: "A", slug: "a", companyId: "company-1" },
    });
    const wsB = await prisma.workspace.create({
      data: { name: "B", slug: "b", companyId: "company-1" },
    });
    await prisma.repository.create({
      data: { id: "repo-b", workspaceId: wsB.id, name: "other" },
    });
    const repoA = await prisma.repository.create({
      data: { id: "repo-a", workspaceId: wsA.id, name: "main" },
    });

    // No cookie → the first workspace (A) is active; its repo wins.
    expect(await mod.resolveDefaultRepositoryId("company-1")).toBe(repoA.id);
  });

  it("falls back to any company repository when the active workspace has none", async () => {
    await prisma.repository.deleteMany({ where: { id: "repo-a" } });

    // Active workspace A now has no repos; the company-wide fallback finds B's.
    expect(await mod.resolveDefaultRepositoryId("company-1")).toBe("repo-b");
  });
});
