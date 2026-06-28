import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./plan-application-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof ServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `plan-application-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./plan-application-service");

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
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug")`);

  // Workspace
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Workspace" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Workspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_companyId_slug_key" ON "Workspace"("companyId", "slug")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_companyId_id_key" ON "Workspace"("companyId", "id")`);

  // Outcome
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Outcome" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "repositoryId" TEXT,
      "runtimeRequestId" TEXT,
      "title" TEXT NOT NULL,
      "rawRequest" TEXT NOT NULL DEFAULT '',
      "brief" TEXT,
      "businessValue" TEXT,
      "successCriteria" TEXT NOT NULL DEFAULT '[]',
      "constraints" TEXT NOT NULL DEFAULT '[]',
      "status" TEXT NOT NULL DEFAULT 'proposed',
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "ownerRole" TEXT,
      "failureReason" TEXT,
      "completedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Outcome_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Outcome_companyId_id_key" ON "Outcome"("companyId", "id")`);

  // PlanningDraft
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
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PlanningDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PlanningDraft_outcomeId_version_key" ON "PlanningDraft"("outcomeId", "version")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PlanningDraft_companyId_id_key" ON "PlanningDraft"("companyId", "id")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PlanningDraft_companyId_outcomeId_version_key" ON "PlanningDraft"("companyId", "outcomeId", "version")`);

  // Project
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Project" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "workspaceId" TEXT NOT NULL,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "startDate" DATETIME,
      "endDate" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Project_companyId_id_key" ON "Project"("companyId", "id")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Project_planningDraftId_planItemId_key" ON "Project"("planningDraftId", "planItemId")`);

  // Feature
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Feature" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "companyId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'planned',
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Feature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Feature_companyId_id_key" ON "Feature"("companyId", "id")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Feature_planningDraftId_planItemId_key" ON "Feature"("planningDraftId", "planItemId")`);

  // Task
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
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Task_companyId_id_key" ON "Task"("companyId", "id")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Task_planningDraftId_planItemId_key" ON "Task"("planningDraftId", "planItemId")`);

  // TimelineEntry (minimal)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimelineEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "actorId" TEXT,
      "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  // Seed
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
    VALUES ('company-2','Other Corp','other','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Outcome" ("id","companyId","title","rawRequest","status","updatedAt")
    VALUES ('outcome-1','company-1','Ship feature','Ship it','planned',CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Feature"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Project"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Workspace"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "PlanningDraft"`);
});

afterAll(async () => {
  await prisma.$disconnect();
  try { rmSync(dbPath, { force: true }); } catch { /* ignore */ }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDraftData(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    companyId: "company-1",
    outcomeId: "outcome-1",
    title: "Test Plan",
    status: "draft",
    version: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

const GENERATED_PROJECTS = JSON.stringify([
  {
    planItemId: "project:p1",
    name: "Auth Service",
    description: "Handles authentication",
    ownerRole: "Backend Engineer",
    ownerEmployeeId: null,
    ownerEmployeeName: null,
    milestones: [],
    acceptanceCriteria: [],
    estimatedExecutionOrder: 1,
  },
]);

const GENERATED_FEATURES = JSON.stringify([
  {
    planItemId: "feature:f1",
    projectPlanItemId: "project:p1",
    milestoneId: "ms-1",
    title: "Login Flow",
    description: "Implements login",
    ownerRole: "Backend Engineer",
    ownerEmployeeId: null,
    ownerEmployeeName: null,
    dependencies: [],
    risks: [],
    acceptanceCriteria: ["User can log in"],
    qaExpectations: [],
    releaseRelevance: "high",
    estimatedExecutionOrder: 1,
  },
]);

const GENERATED_TASKS = JSON.stringify([
  {
    planItemId: "task:t1",
    featurePlanItemId: "feature:f1",
    title: "Implement JWT tokens",
    description: "Add JWT-based auth",
    recommendedRole: "Backend Engineer",
    recommendedEmployeeId: null,
    recommendedEmployeeName: null,
    dependencies: [],
    acceptanceCriteria: ["Token is created on login"],
    definitionOfDone: [],
    requiredContext: [],
    reviewRequirements: [],
    qaImpact: "high",
    estimatedExecutionOrder: 1,
    estimatePoints: 3,
  },
  {
    planItemId: "task:t2",
    featurePlanItemId: "feature:f1",
    title: "Add refresh token rotation",
    description: "Rotate refresh tokens",
    recommendedRole: "Backend Engineer",
    recommendedEmployeeId: null,
    recommendedEmployeeName: null,
    dependencies: [],
    acceptanceCriteria: ["Tokens are rotated"],
    definitionOfDone: [],
    requiredContext: [],
    reviewRequirements: [],
    qaImpact: "medium",
    estimatedExecutionOrder: 2,
    estimatePoints: 5,
  },
]);

async function seedApprovedDraft(id = "draft-1") {
  await prisma.planningDraft.create({
    data: {
      ...makeDraftData({
        id,
        status: "approved",
        approvedAt: new Date(),
        approvedById: "user-1",
        generatedProjects: GENERATED_PROJECTS,
        generatedFeatures: GENERATED_FEATURES,
        generatedTasks: GENERATED_TASKS,
      }),
    },
  });
}

// ─── approvePlanningDraft ─────────────────────────────────────────────────────

describe("approvePlanningDraft", () => {
  it("moves a draft-status plan to approved", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    const result = await service.approvePlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    expect(result.status).toBe("approved");

    const updated = await prisma.planningDraft.findFirst({ where: { id: "draft-1" } });
    expect(updated?.status).toBe("approved");
    expect(updated?.approvedAt).not.toBeNull();
    expect(updated?.approvedById).toBe("user-1");
  });

  it("stores approval notes when provided", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    await service.approvePlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
      notes: "Looks good!",
    });

    const draft = await prisma.planningDraft.findFirst({ where: { id: "draft-1" } });
    expect(draft?.approvalNotes).toBe("Looks good!");
  });

  it("creates a timeline entry on approval", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    await service.approvePlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const entry = await prisma.timelineEntry.findFirst({
      where: { entityId: "draft-1", eventType: "plan.approved" },
    });
    expect(entry).not.toBeNull();
  });

  it("returns already_approved when called on an approved draft", async () => {
    await prisma.planningDraft.create({
      data: makeDraftData({ status: "approved", approvedAt: new Date(), approvedById: "user-1" }),
    });

    const result = await service.approvePlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    expect(result.status).toBe("already_approved");
  });

  it("returns already_applied when called on an applied draft", async () => {
    await prisma.planningDraft.create({
      data: makeDraftData({
        status: "applied",
        approvedAt: new Date(),
        approvedById: "user-1",
        appliedAt: new Date(),
        appliedById: "user-1",
      }),
    });

    const result = await service.approvePlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    expect(result.status).toBe("already_applied");
  });

  it("throws when draft not found", async () => {
    await expect(
      service.approvePlanningDraft({
        companyId: "company-1",
        planningDraftId: "nonexistent",
        actorId: "user-1",
      })
    ).rejects.toThrow("not found");
  });

  it("throws when trying to approve a rejected draft", async () => {
    await prisma.planningDraft.create({
      data: makeDraftData({ status: "rejected", rejectedAt: new Date(), rejectedById: "user-1" }),
    });

    await expect(
      service.approvePlanningDraft({
        companyId: "company-1",
        planningDraftId: "draft-1",
        actorId: "user-1",
      })
    ).rejects.toThrow("rejected");
  });

  it("throws when trying to approve a failed draft", async () => {
    await prisma.planningDraft.create({ data: makeDraftData({ status: "failed" }) });

    await expect(
      service.approvePlanningDraft({
        companyId: "company-1",
        planningDraftId: "draft-1",
        actorId: "user-1",
      })
    ).rejects.toThrow("failed");
  });

  it("updates the outcome status to approved", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    await service.approvePlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const outcome = await prisma.outcome.findFirst({ where: { id: "outcome-1" } });
    expect(outcome?.status).toBe("approved");
  });
});

// ─── rejectPlanningDraft ──────────────────────────────────────────────────────

describe("rejectPlanningDraft", () => {
  it("moves a draft-status plan to rejected", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    const result = await service.rejectPlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
      reason: "Scope is too broad",
    });

    expect(result.status).toBe("rejected");

    const updated = await prisma.planningDraft.findFirst({ where: { id: "draft-1" } });
    expect(updated?.status).toBe("rejected");
    expect(updated?.rejectionReason).toBe("Scope is too broad");
    expect(updated?.rejectedAt).not.toBeNull();
  });

  it("updates the outcome status to rejected", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    await service.rejectPlanningDraft({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
      reason: "Not aligned with current priorities",
    });

    const outcome = await prisma.outcome.findFirst({ where: { id: "outcome-1" } });
    expect(outcome?.status).toBe("rejected");
  });

  it("requires a rejection reason", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() });

    await expect(
      service.rejectPlanningDraft({
        companyId: "company-1",
        planningDraftId: "draft-1",
        actorId: "user-1",
        reason: "   ",
      })
    ).rejects.toThrow("Rejection reason is required.");
  });

  it("cannot reject an approved draft", async () => {
    await seedApprovedDraft();

    await expect(
      service.rejectPlanningDraft({
        companyId: "company-1",
        planningDraftId: "draft-1",
        actorId: "user-1",
        reason: "Too late",
      })
    ).rejects.toThrow("Cannot reject an approved planning draft.");
  });
});

// ─── applyApprovedPlan ────────────────────────────────────────────────────────

describe("applyApprovedPlan", () => {
  it("creates project, feature, and tasks from approved draft", async () => {
    await seedApprovedDraft();

    const result = await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    expect(result.projectsCreated).toBe(1);
    expect(result.featuresCreated).toBe(1);
    expect(result.tasksCreated).toBe(2);
    expect(result.projectsUpdated).toBe(0);
    expect(result.featuresUpdated).toBe(0);
    expect(result.tasksUpdated).toBe(0);
  });

  it("creates a default workspace when none exists", async () => {
    await seedApprovedDraft();

    const before = await prisma.workspace.count({ where: { companyId: "company-1" } });
    expect(before).toBe(0);

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const after = await prisma.workspace.count({ where: { companyId: "company-1" } });
    expect(after).toBe(1);
  });

  it("records project with correct fields", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const project = await prisma.project.findFirst({ where: { companyId: "company-1" } });
    expect(project?.name).toBe("Auth Service");
    expect(project?.planningDraftId).toBe("draft-1");
    expect(project?.planItemId).toBe("project:p1");
    expect(project?.outcomeId).toBe("outcome-1");
  });

  it("records feature linked to project", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const feature = await prisma.feature.findFirst({ where: { companyId: "company-1" } });
    expect(feature?.title).toBe("Login Flow");
    expect(feature?.planItemId).toBe("feature:f1");

    const project = await prisma.project.findFirst({ where: { companyId: "company-1" } });
    expect(feature?.projectId).toBe(project?.id);
  });

  it("records tasks linked to feature", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const tasks = await prisma.task.findMany({
      where: { companyId: "company-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.title).toBe("Implement JWT tokens");
    expect(tasks[1]?.title).toBe("Add refresh token rotation");

    const feature = await prisma.feature.findFirst({ where: { companyId: "company-1" } });
    expect(tasks[0]?.featureId).toBe(feature?.id);
    expect(tasks[1]?.featureId).toBe(feature?.id);
  });

  it("sets draft status to applied", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const draft = await prisma.planningDraft.findFirst({ where: { id: "draft-1" } });
    expect(draft?.status).toBe("applied");
    expect(draft?.appliedAt).not.toBeNull();
    expect(draft?.appliedById).toBe("user-1");
  });

  it("updates outcome status to in_delivery", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const outcome = await prisma.outcome.findFirst({ where: { id: "outcome-1" } });
    expect(outcome?.status).toBe("in_delivery");
  });

  it("creates a timeline entry on application", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const entry = await prisma.timelineEntry.findFirst({
      where: { entityId: "draft-1", eventType: "work.created" },
    });
    expect(entry).not.toBeNull();
    expect(entry?.summary).toContain("1 project(s)");
    expect(entry?.summary).toContain("1 feature(s)");
    expect(entry?.summary).toContain("2 task(s)");
  });

  it("is idempotent: re-applying updates rather than duplicates", async () => {
    await seedApprovedDraft();

    // First apply
    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    // Allow re-apply on applied draft (status "applied" is acceptable by assertPlanningDraftCanCreateWork)
    const second = await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    expect(second.projectsCreated).toBe(0);
    expect(second.projectsUpdated).toBe(1);
    expect(second.featuresCreated).toBe(0);
    expect(second.featuresUpdated).toBe(1);
    expect(second.tasksCreated).toBe(0);
    expect(second.tasksUpdated).toBe(2);

    // No duplicate records
    const projects = await prisma.project.count({ where: { companyId: "company-1" } });
    const features = await prisma.feature.count({ where: { companyId: "company-1" } });
    const tasks = await prisma.task.count({ where: { companyId: "company-1" } });
    expect(projects).toBe(1);
    expect(features).toBe(1);
    expect(tasks).toBe(2);
  });

  it("throws when draft not found", async () => {
    await expect(
      service.applyApprovedPlan({
        companyId: "company-1",
        planningDraftId: "nonexistent",
        actorId: "user-1",
      })
    ).rejects.toThrow("not found");
  });

  it("throws when draft is not approved", async () => {
    await prisma.planningDraft.create({ data: makeDraftData() }); // status: "draft"

    await expect(
      service.applyApprovedPlan({
        companyId: "company-1",
        planningDraftId: "draft-1",
        actorId: "user-1",
      })
    ).rejects.toThrow();
  });

  it("tasks start in todo status", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const tasks = await prisma.task.findMany({ where: { companyId: "company-1" } });
    expect(tasks.every((t) => t.status === "todo")).toBe(true);
  });

  it("does not create projects when generatedProjects is empty", async () => {
    await prisma.planningDraft.create({
      data: {
        ...makeDraftData({
          status: "approved",
          approvedAt: new Date(),
          approvedById: "user-1",
          generatedProjects: "[]",
          generatedFeatures: "[]",
          generatedTasks: "[]",
        }),
      },
    });

    const result = await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    expect(result.projectsCreated).toBe(0);
    expect(result.featuresCreated).toBe(0);
    expect(result.tasksCreated).toBe(0);
  });

  it("stores estimate on tasks", async () => {
    await seedApprovedDraft();

    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const tasks = await prisma.task.findMany({
      where: { companyId: "company-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(tasks[0]?.estimate).toBe(3);
    expect(tasks[1]?.estimate).toBe(5);
  });
});
