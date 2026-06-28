import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as DetectorModule from "./stuck-work-detector";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let detector: typeof DetectorModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `stuck-work-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  detector = await import("./stuck-work-detector");

  // User
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);

  // Company
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
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug")`);

  // Task (minimal, full column set to avoid P2022)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Task" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "companyId" TEXT NOT NULL,
      "projectId" TEXT,
      "featureId" TEXT,
      "sprintId" TEXT,
      "assigneeId" TEXT,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'todo',
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "estimate" REAL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Task_companyId_id_key" ON "Task"("companyId", "id")`);

  // ExecutionSession (minimal, full column set)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExecutionSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "taskId" TEXT,
      "projectId" TEXT,
      "repositoryId" TEXT,
      "employeeId" TEXT,
      "planningDraftId" TEXT,
      "agentType" TEXT NOT NULL DEFAULT 'claude_code',
      "status" TEXT NOT NULL DEFAULT 'queued',
      "taskBrief" TEXT,
      "resultSummary" TEXT,
      "filesChanged" TEXT NOT NULL DEFAULT '[]',
      "validationOutput" TEXT,
      "errorMessage" TEXT,
      "startedAt" DATETIME,
      "completedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionSession_companyId_status_idx" ON "ExecutionSession"("companyId", "status")`);

  // PlanningDraft (minimal)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlanningDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "outcomeId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "summary" TEXT,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "version" INTEGER NOT NULL DEFAULT 1,
      "scope" TEXT NOT NULL DEFAULT '[]',
      "nonScope" TEXT NOT NULL DEFAULT '[]',
      "assumptions" TEXT NOT NULL DEFAULT '[]',
      "risks" TEXT NOT NULL DEFAULT '[]',
      "dependencies" TEXT NOT NULL DEFAULT '[]',
      "recommendedAssignments" TEXT NOT NULL DEFAULT '[]',
      "generatedProjects" TEXT NOT NULL DEFAULT '[]',
      "generatedFeatures" TEXT NOT NULL DEFAULT '[]',
      "generatedTasks" TEXT NOT NULL DEFAULT '[]',
      "reviewPlan" TEXT NOT NULL DEFAULT '{}',
      "qaPlan" TEXT NOT NULL DEFAULT '{}',
      "releasePlan" TEXT NOT NULL DEFAULT '{}',
      "approvalNotes" TEXT,
      "rejectionReason" TEXT,
      "generationError" TEXT,
      "applicationError" TEXT,
      "approvedAt" DATETIME,
      "approvedById" TEXT,
      "rejectedAt" DATETIME,
      "rejectedById" TEXT,
      "appliedAt" DATETIME,
      "appliedById" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PlanningDraft_companyId_id_key" ON "PlanningDraft"("companyId", "id")`);

  // Seed base data
  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" ("id","email","role","createdAt","updatedAt")
    VALUES ('user-1','owner@example.com','admin',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-2','Other','other','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "PlanningDraft"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ExecutionSession"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
});

afterAll(async () => {
  await prisma.$disconnect();
  try { rmSync(dbPath, { force: true }); } catch { /* ignore */ }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return hoursAgo(days * 24);
}

async function insertTask(overrides: Record<string, unknown> = {}) {
  const id = overrides.id ?? `task-${Math.random().toString(16).slice(2)}`;
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Task" ("id","title","companyId","status","priority","createdAt","updatedAt")
    VALUES (
      '${id}',
      '${(overrides.title as string) ?? "Test Task"}',
      '${(overrides.companyId as string) ?? "company-1"}',
      '${(overrides.status as string) ?? "todo"}',
      '${(overrides.priority as string) ?? "medium"}',
      '${((overrides.createdAt as Date) ?? new Date()).toISOString()}',
      '${((overrides.updatedAt as Date) ?? new Date()).toISOString()}'
    )
  `);
  return id as string;
}

async function insertSession(overrides: Record<string, unknown> = {}) {
  const id = overrides.id ?? `session-${Math.random().toString(16).slice(2)}`;
  const now = new Date().toISOString();
  const createdAt = ((overrides.createdAt as Date) ?? new Date()).toISOString();
  const completedAt = (overrides.completedAt as Date | null) ?? null;
  const taskId = (overrides.taskId as string | null) ?? null;
  const errorMsg = (overrides.errorMessage as string | null) ?? null;
  const validationOutput = (overrides.validationOutput as string | null) ?? null;

  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionSession" (
      "id","companyId","taskId","status","errorMessage","validationOutput",
      "completedAt","createdAt","updatedAt"
    ) VALUES (
      '${id}',
      '${(overrides.companyId as string) ?? "company-1"}',
      ${taskId ? `'${taskId}'` : "NULL"},
      '${(overrides.status as string) ?? "queued"}',
      ${errorMsg ? `'${errorMsg}'` : "NULL"},
      ${validationOutput ? `'${validationOutput.replace(/'/g, "''")}'` : "NULL"},
      ${completedAt ? `'${completedAt.toISOString()}'` : "NULL"},
      '${createdAt}',
      '${now}'
    )
  `);
  return id as string;
}

async function insertDraft(overrides: Record<string, unknown> = {}) {
  const id = overrides.id ?? `draft-${Math.random().toString(16).slice(2)}`;
  const updatedAt = ((overrides.updatedAt as Date) ?? new Date()).toISOString();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "PlanningDraft" (
      "id","companyId","outcomeId","title","status","updatedAt"
    ) VALUES (
      '${id}',
      '${(overrides.companyId as string) ?? "company-1"}',
      '${(overrides.outcomeId as string) ?? "outcome-1"}',
      '${(overrides.title as string) ?? "Test Plan"}',
      '${(overrides.status as string) ?? "draft"}',
      '${updatedAt}'
    )
  `);
  return id as string;
}

// ─── detectStuckWork ─────────────────────────────────────────────────────────

describe("detectStuckWork", () => {
  it("returns empty items when nothing is stuck", async () => {
    const result = await detector.detectStuckWork({ companyId: "company-1" });
    expect(result.items).toHaveLength(0);
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  // ── Tasks stuck in review ─────────────────────────────────────────────────

  it("detects task stuck in review beyond threshold", async () => {
    await insertTask({ status: "in-review", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const reviewItems = result.items.filter((i) => i.category === "task_stuck_in_review");
    expect(reviewItems.length).toBeGreaterThan(0);
  });

  it("does not flag task in review updated within threshold", async () => {
    await insertTask({ status: "in-review", updatedAt: hoursAgo(12) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const reviewItems = result.items.filter((i) => i.category === "task_stuck_in_review");
    expect(reviewItems).toHaveLength(0);
  });

  it("stuck-in-review item has linkPath pointing to the task", async () => {
    const id = await insertTask({ id: "task-review", status: "in-review", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const item = result.items.find((i) => i.entityId === id);
    expect(item?.linkPath).toBe(`/work/tasks/${id}`);
    expect(item?.entityType).toBe("task");
  });

  it("assigns high severity when task has been stuck 3x the threshold", async () => {
    await insertTask({ id: "task-very-stuck", status: "in-review", updatedAt: daysAgo(5) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const item = result.items.find((i) => i.entityId === "task-very-stuck");
    expect(item?.severity).toBe("high");
  });

  // ── Plans awaiting approval ───────────────────────────────────────────────

  it("detects plan awaiting CEO approval beyond threshold", async () => {
    await insertDraft({ status: "draft", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const planItems = result.items.filter((i) => i.category === "plan_awaiting_approval");
    expect(planItems.length).toBeGreaterThan(0);
  });

  it("does not flag draft updated within threshold", async () => {
    await insertDraft({ status: "draft", updatedAt: hoursAgo(12) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const planItems = result.items.filter((i) => i.category === "plan_awaiting_approval");
    expect(planItems).toHaveLength(0);
  });

  it("does not flag approved or applied drafts", async () => {
    await insertDraft({ status: "approved", updatedAt: hoursAgo(48) });
    await insertDraft({ status: "applied", updatedAt: hoursAgo(48) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const planItems = result.items.filter((i) => i.category === "plan_awaiting_approval");
    expect(planItems).toHaveLength(0);
  });

  it("plan item has linkPath and entityType set correctly", async () => {
    const id = await insertDraft({
      id: "draft-stuck",
      status: "reviewing",
      updatedAt: hoursAgo(30),
    });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const item = result.items.find((i) => i.entityId === id);
    expect(item?.linkPath).toBe("/inbox");
    expect(item?.entityType).toBe("planning_draft");
  });

  // ── Stuck execution sessions ──────────────────────────────────────────────

  it("detects queued session that has been running too long", async () => {
    await insertSession({ status: "queued", createdAt: hoursAgo(60) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      executionThresholdHours: 48,
    });

    const execItems = result.items.filter((i) => i.category === "task_stuck_in_execution");
    expect(execItems.length).toBeGreaterThan(0);
  });

  it("does not flag session created within execution threshold", async () => {
    await insertSession({ status: "queued", createdAt: hoursAgo(10) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      executionThresholdHours: 48,
    });

    const execItems = result.items.filter((i) => i.category === "task_stuck_in_execution");
    expect(execItems).toHaveLength(0);
  });

  it("does not flag completed or failed sessions as stuck", async () => {
    await insertSession({
      status: "completed",
      createdAt: hoursAgo(100),
      completedAt: hoursAgo(99),
    });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      executionThresholdHours: 48,
    });

    const execItems = result.items.filter((i) => i.category === "task_stuck_in_execution");
    expect(execItems).toHaveLength(0);
  });

  it("execution stuck item links to task when taskId is present", async () => {
    const taskId = await insertTask({ status: "in-progress" });
    const sessionId = await insertSession({
      status: "running",
      createdAt: hoursAgo(60),
      taskId,
    });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      executionThresholdHours: 48,
    });

    const item = result.items.find((i) => i.entityId === sessionId);
    expect(item?.linkPath).toBe(`/work/tasks/${taskId}`);
  });

  // ── Failed execution loops ────────────────────────────────────────────────

  it("detects recently failed execution session", async () => {
    await insertSession({
      status: "failed",
      createdAt: daysAgo(2),
      completedAt: hoursAgo(5),
      errorMessage: "Build failed with exit code 1",
    });

    const result = await detector.detectStuckWork({ companyId: "company-1" });

    const failedItems = result.items.filter(
      (i) =>
        i.category === "failed_execution_loop" || i.category === "failed_validation_loop"
    );
    expect(failedItems.length).toBeGreaterThan(0);
  });

  it("classifies as failed_validation_loop when validation output shows failure", async () => {
    await insertSession({
      status: "failed",
      createdAt: daysAgo(1),
      completedAt: hoursAgo(2),
      validationOutput: "npm run test FAILED: 3 tests failed",
      errorMessage: "Tests failed",
    });

    const result = await detector.detectStuckWork({ companyId: "company-1" });

    const item = result.items.find((i) => i.category === "failed_validation_loop");
    expect(item).not.toBeNull();
  });

  it("does not flag failed sessions older than 7 days", async () => {
    await insertSession({
      status: "failed",
      createdAt: daysAgo(10),
      completedAt: daysAgo(9),
      errorMessage: "Old failure",
    });

    const result = await detector.detectStuckWork({ companyId: "company-1" });

    const failedItems = result.items.filter(
      (i) =>
        i.category === "failed_execution_loop" || i.category === "failed_validation_loop"
    );
    expect(failedItems).toHaveLength(0);
  });

  // ── Ownership isolation ───────────────────────────────────────────────────

  it("does not return items from another company", async () => {
    await insertTask({
      companyId: "company-2",
      status: "in-review",
      updatedAt: hoursAgo(48),
    });
    await insertDraft({
      companyId: "company-2",
      status: "draft",
      updatedAt: hoursAgo(48),
    });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    expect(result.items).toHaveLength(0);
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  it("sorts high severity before medium severity", async () => {
    // Long-stuck (high) and recently-stuck (medium)
    await insertTask({ id: "medium-task", status: "in-review", updatedAt: hoursAgo(26) });
    await insertTask({ id: "high-task", status: "in-review", updatedAt: daysAgo(5) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const firstHigh = result.items.findIndex((i) => i.entityId === "high-task");
    const firstMedium = result.items.findIndex((i) => i.entityId === "medium-task");
    expect(firstHigh).toBeLessThan(firstMedium);
  });

  // ── Structure ──────────────────────────────────────────────────────────────

  it("each item has all required fields", async () => {
    await insertTask({ status: "in-review", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    for (const item of result.items) {
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("severity");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("recommendation");
      expect(item).toHaveProperty("linkPath");
      expect(item).toHaveProperty("entityId");
      expect(item).toHaveProperty("entityType");
      expect(item).toHaveProperty("stuckSinceMs");
    }
  });

  it("stuckSinceMs is a positive number", async () => {
    await insertTask({ status: "in-review", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    for (const item of result.items) {
      expect(item.stuckSinceMs).toBeGreaterThan(0);
    }
  });

  // ── Custom thresholds ─────────────────────────────────────────────────────

  it("respects custom reviewThresholdHours", async () => {
    // Updated 2 hours ago — should NOT flag at 24h threshold but SHOULD at 1h
    await insertTask({ status: "in-review", updatedAt: hoursAgo(2) });

    const resultAtDefault = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });
    expect(resultAtDefault.items.filter((i) => i.category === "task_stuck_in_review")).toHaveLength(0);

    const resultAtShort = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 1,
    });
    expect(resultAtShort.items.filter((i) => i.category === "task_stuck_in_review").length).toBeGreaterThan(0);
  });

  it("description includes a human-readable duration", async () => {
    await insertTask({ status: "in-review", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    const item = result.items.find((i) => i.category === "task_stuck_in_review");
    // Should mention something like "30h" or "1d 6h"
    expect(item?.description).toMatch(/\d+(h|d)/);
  });

  it("recommendation is a non-empty string", async () => {
    await insertTask({ status: "in-review", updatedAt: hoursAgo(30) });

    const result = await detector.detectStuckWork({
      companyId: "company-1",
      reviewThresholdHours: 24,
    });

    for (const item of result.items) {
      expect(typeof item.recommendation).toBe("string");
      expect(item.recommendation.length).toBeGreaterThan(10);
    }
  });
});
