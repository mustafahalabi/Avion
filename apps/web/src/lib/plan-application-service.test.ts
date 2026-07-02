import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./plan-application-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof ServiceModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("plan-application-service"));
  // The service reads the prisma singleton at import time, so import it after
  // setupTestSchema has pointed the singleton at the isolated schema.
  service = await import("./plan-application-service");

  // Postgres enforces foreign keys (the old SQLite tables did not), so parent
  // rows must be seeded before children: Company.ownerId -> User.id and
  // Outcome.companyId -> Company.id.
  await prisma.user.create({
    data: { id: "user-1", email: "owner@example.com", role: "admin" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.company.create({
    data: { id: "company-2", name: "Other Corp", slug: "other", ownerId: "user-1" },
  });
  await prisma.outcome.create({
    data: {
      id: "outcome-1",
      companyId: "company-1",
      title: "Ship feature",
      rawRequest: "Ship it",
      status: "planned",
    },
  });
});

afterEach(async () => {
  // Delete children before parents to satisfy Postgres FK constraints.
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Feature"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Project"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Repository"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Workspace"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "PlanningDraft"`);
  // Reset the shared outcome's repository link between tests.
  await prisma.$executeRawUnsafe(`UPDATE "Outcome" SET "repositoryId" = NULL`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
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

  it("inherits the outcome's repository (and its workspace) on the created project", async () => {
    // Outcome scoped to a repository living in a specific workspace.
    await prisma.workspace.create({
      data: { id: "ws-repo", name: "Core Platform", slug: "core-platform", companyId: "company-1" },
    });
    await prisma.repository.create({
      data: { id: "repo-1", workspaceId: "ws-repo", name: "eos-sandbox" },
    });
    await prisma.outcome.update({
      where: { id: "outcome-1" },
      data: { repositoryId: "repo-1" },
    });

    await seedApprovedDraft();
    await service.applyApprovedPlan({
      companyId: "company-1",
      planningDraftId: "draft-1",
      actorId: "user-1",
    });

    const project = await prisma.project.findFirst({ where: { companyId: "company-1" } });
    expect(project?.repositoryId).toBe("repo-1");
    // Workspace is inferred from the repository, not the default workspace.
    expect(project?.workspaceId).toBe("ws-repo");

    // And no extra "Default" workspace was created.
    const workspaceCount = await prisma.workspace.count({ where: { companyId: "company-1" } });
    expect(workspaceCount).toBe(1);
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
