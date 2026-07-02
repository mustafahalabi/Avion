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

// createTask redirects + revalidates on success — no-op them under vitest.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
  await prisma.workspace.create({
    data: { id: "workspace-1", name: "Main", slug: "main", companyId: "company-1" },
  });
  await prisma.project.create({
    data: {
      id: "project-1",
      name: "Platform",
      slug: "platform",
      companyId: "company-1",
      workspaceId: "workspace-1",
    },
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
  // Drop tasks created by createTask tests; keep the seeded task-1.
  await prisma.$executeRawUnsafe(`DELETE FROM "Task" WHERE "id" <> 'task-1'`);
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

describe("createTask (creation-status gate — MUS-296)", () => {
  function form(status: string, title = "New task"): FormData {
    const fd = new FormData();
    fd.set("title", title);
    fd.set("status", status);
    return fd;
  }

  async function taskCount(title: string): Promise<number> {
    return prisma.task.count({ where: { companyId: "company-1", title } });
  }

  it("rejects creating a task as done (no review/QA can exist yet)", async () => {
    signIn();
    const result = await actions.createTask("project-1", undefined, form("done", "done task"));
    expect(result?.message).toMatch(/cannot be created as done/i);
    expect(result?.message).toMatch(/approved review and a passing QA/i);
    expect(await taskCount("done task")).toBe(0);
  });

  it("rejects creating a task directly in review", async () => {
    signIn();
    const result = await actions.createTask("project-1", undefined, form("in-review", "review task"));
    expect(result?.message).toMatch(/cannot be created directly in review/i);
    expect(await taskCount("review task")).toBe(0);
  });

  it("creates a todo task successfully", async () => {
    signIn();
    const result = await actions.createTask("project-1", undefined, form("todo", "todo task"));
    // Success redirects (mocked no-op) → no error message returned.
    expect(result?.message).toBeUndefined();
    const created = await prisma.task.findFirst({
      where: { companyId: "company-1", title: "todo task" },
      select: { status: true },
    });
    expect(created?.status).toBe("todo");
  });

  it("creates an in-progress task successfully", async () => {
    signIn();
    const result = await actions.createTask("project-1", undefined, form("in-progress", "wip task"));
    expect(result?.message).toBeUndefined();
    expect(await taskCount("wip task")).toBe(1);
  });
});
