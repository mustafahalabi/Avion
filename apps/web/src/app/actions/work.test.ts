import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import type * as WorkActions from "./work";
import {
  setupTestSchema,
  teardownTestSchema,
} from "@/lib/test-utils/pg-test-db";

// The actions layer resolves the caller through Clerk; tests stand in a fake
// authenticated owner so the ownership + gate logic runs against the real DB.
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

let prisma: typeof PrismaSingleton;
let schema: string;
let actions: typeof WorkActions;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("actions-work"));
  actions = await import("./work");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.task.create({
    data: {
      id: "task-1",
      title: "Implement feature X",
      companyId: "company-1",
      status: "in-review",
    },
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
  await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "status" = 'in-review', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'task-1'`
  );
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

function signIn(): void {
  mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "owner@acme.test" });
}

async function taskStatus(): Promise<string | undefined> {
  const task = await prisma.task.findUnique({
    where: { id: "task-1" },
    select: { status: true },
  });
  return task?.status;
}

describe("updateTaskStatus (mutation boundary gate)", () => {
  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await actions.updateTaskStatus("task-1", "in-progress");
    expect(result.error).toMatch(/not authenticated/i);
    expect(await taskStatus()).toBe("in-review");
  });

  it("rejects unknown status strings", async () => {
    signIn();
    const result = await actions.updateTaskStatus("task-1", "shipped");
    expect(result.error).toMatch(/not a valid task status/i);
    expect(await taskStatus()).toBe("in-review");
  });

  it("allows a plain workflow move", async () => {
    signIn();
    const result = await actions.updateTaskStatus("task-1", "in-progress");
    expect(result.error).toBeUndefined();
    expect(await taskStatus()).toBe("in-progress");
  });

  it("rejects done without an approved review and passing QA", async () => {
    signIn();
    const result = await actions.updateTaskStatus("task-1", "done");
    expect(result.error).toMatch(/cannot be marked done/i);
    expect(await taskStatus()).toBe("in-review");
  });

  it("allows done once both gates hold real evidence", async () => {
    signIn();
    await prisma.review.create({
      data: {
        companyId: "company-1",
        title: "Review: feature X",
        entityType: "task",
        entityId: "task-1",
        status: "approved",
      },
    });
    await prisma.qAResult.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        status: "passed",
      },
    });

    const result = await actions.updateTaskStatus("task-1", "done");
    expect(result.error).toBeUndefined();
    expect(await taskStatus()).toBe("done");
  });
});
