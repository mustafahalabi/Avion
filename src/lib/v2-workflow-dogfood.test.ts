import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import { generateDeterministicPlanningDraft } from "./planning-generator";

let dbPath: string;
let prisma: typeof PrismaSingleton;
let planApplicationService: typeof import("./plan-application-service");
let executionService: typeof import("./execution-session-service");
let reviewService: typeof import("./review-service");

const COMPANY_ID = "company-1";
const USER_ID = "user-1";
const OUTCOME_ID = "outcome-dogfood";

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `v2-dogfood-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  planApplicationService = await import("./plan-application-service");
  executionService = await import("./execution-session-service");
  reviewService = await import("./review-service");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "role" TEXT DEFAULT 'member',
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Company" (
      "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Workspace" (
      "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "companyId" TEXT NOT NULL,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Workspace_companyId_slug_key" ON "Workspace"("companyId", "slug")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Workspace_companyId_id_key" ON "Workspace"("companyId", "id")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Outcome" (
      "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "runtimeRequestId" TEXT, "repositoryId" TEXT,
      "title" TEXT NOT NULL, "rawRequest" TEXT DEFAULT '', "brief" TEXT, "businessValue" TEXT,
      "successCriteria" TEXT DEFAULT '[]', "constraints" TEXT DEFAULT '[]',
      "status" TEXT DEFAULT 'proposed', "priority" TEXT DEFAULT 'medium', "ownerRole" TEXT,
      "failureReason" TEXT, "completedAt" DATETIME,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Outcome_companyId_id_key" ON "Outcome"("companyId", "id")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "PlanningDraft" (
      "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "outcomeId" TEXT NOT NULL,
      "title" TEXT NOT NULL, "summary" TEXT, "status" TEXT DEFAULT 'draft', "version" INTEGER DEFAULT 1,
      "scope" TEXT DEFAULT '[]', "nonScope" TEXT DEFAULT '[]', "assumptions" TEXT DEFAULT '[]',
      "risks" TEXT DEFAULT '[]', "dependencies" TEXT DEFAULT '[]',
      "recommendedAssignments" TEXT DEFAULT '[]', "generatedProjects" TEXT DEFAULT '[]',
      "generatedFeatures" TEXT DEFAULT '[]', "generatedTasks" TEXT DEFAULT '[]',
      "reviewPlan" TEXT DEFAULT '{}', "qaPlan" TEXT DEFAULT '{}', "releasePlan" TEXT DEFAULT '{}',
      "approvalNotes" TEXT, "rejectionReason" TEXT, "generationError" TEXT, "applicationError" TEXT,
      "approvedAt" DATETIME, "approvedById" TEXT, "rejectedAt" DATETIME, "rejectedById" TEXT,
      "appliedAt" DATETIME, "appliedById" TEXT,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "PlanningDraft_companyId_outcomeId_version_key" ON "PlanningDraft"("companyId", "outcomeId", "version")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "PlanningDraft_companyId_id_key" ON "PlanningDraft"("companyId", "id")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Project" (
      "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "companyId" TEXT NOT NULL,
      "workspaceId" TEXT NOT NULL, "repositoryId" TEXT, "outcomeId" TEXT, "planningDraftId" TEXT, "planItemId" TEXT,
      "description" TEXT, "status" TEXT DEFAULT 'active', "startDate" DATETIME, "endDate" DATETIME,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Project_companyId_id_key" ON "Project"("companyId", "id")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Project_planningDraftId_planItemId_key" ON "Project"("planningDraftId", "planItemId")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Feature" (
      "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "description" TEXT, "companyId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL, "outcomeId" TEXT, "planningDraftId" TEXT, "planItemId" TEXT,
      "status" TEXT DEFAULT 'planned', "priority" TEXT DEFAULT 'medium',
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Feature_companyId_id_key" ON "Feature"("companyId", "id")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Feature_planningDraftId_planItemId_key" ON "Feature"("planningDraftId", "planItemId")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Task" (
      "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "description" TEXT, "companyId" TEXT NOT NULL,
      "projectId" TEXT, "featureId" TEXT, "sprintId" TEXT, "assigneeId" TEXT,
      "outcomeId" TEXT, "planningDraftId" TEXT, "planItemId" TEXT,
      "status" TEXT DEFAULT 'todo', "priority" TEXT DEFAULT 'medium', "estimate" REAL,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Task_companyId_id_key" ON "Task"("companyId", "id")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "Task_planningDraftId_planItemId_key" ON "Task"("planningDraftId", "planItemId")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "ExecutionSession" (
      "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "taskId" TEXT, "projectId" TEXT,
      "repositoryId" TEXT, "employeeId" TEXT, "planningDraftId" TEXT,
      "agentType" TEXT DEFAULT 'claude_code', "status" TEXT DEFAULT 'queued',
      "taskBrief" TEXT, "resultSummary" TEXT, "filesChanged" TEXT DEFAULT '[]',
      "validationOutput" TEXT, "errorMessage" TEXT,
      "branchName" TEXT, "baseBranch" TEXT, "commitSha" TEXT, "prUrl" TEXT,
      "prNumber" INTEGER, "prStatus" TEXT, "mergeStatus" TEXT,
      "startedAt" DATETIME, "completedAt" DATETIME,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Review" (
      "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "title" TEXT NOT NULL,
      "entityType" TEXT DEFAULT 'task', "entityId" TEXT NOT NULL, "reviewerId" TEXT,
      "outcomeId" TEXT, "planningDraftId" TEXT, "planItemId" TEXT,
      "status" TEXT DEFAULT 'pending', "verdict" TEXT, "notes" TEXT,
      "changeRequestNotes" TEXT, "findings" TEXT DEFAULT '[]',
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "ChangeRequest" (
      "id" TEXT PRIMARY KEY, "reviewId" TEXT NOT NULL, "reason" TEXT NOT NULL,
      "requestedBy" TEXT, "resolution" TEXT, "resolved" INTEGER DEFAULT 0,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "QAResult" (
      "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "entityType" TEXT DEFAULT 'task',
      "entityId" TEXT NOT NULL, "outcomeId" TEXT, "planningDraftId" TEXT, "planItemId" TEXT,
      "status" TEXT DEFAULT 'pending', "passedCount" INTEGER DEFAULT 0, "failedCount" INTEGER DEFAULT 0,
      "notes" TEXT, "checks" TEXT DEFAULT '[]',
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Release" (
      "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "outcomeId" TEXT,
      "planningDraftId" TEXT, "planItemId" TEXT, "version" TEXT NOT NULL,
      "title" TEXT, "description" TEXT, "releaseNotes" TEXT,
      "status" TEXT DEFAULT 'draft', "deploymentStatus" TEXT DEFAULT 'not_started',
      "checklist" TEXT DEFAULT '[]', "taskIds" TEXT DEFAULT '[]',
      "rollbackPlan" TEXT, "postReleaseNotes" TEXT, "releasedAt" DATETIME,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "TimelineEntry" (
      "id" TEXT PRIMARY KEY, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL, "summary" TEXT, "actorId" TEXT, "metadata" TEXT DEFAULT '{}',
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" ("id","email","role","createdAt","updatedAt")
    VALUES ('${USER_ID}','ceo@example.com','admin',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('${COMPANY_ID}','Avion','engineering-os','${USER_ID}',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Release"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ChangeRequest"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ExecutionSession"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Feature"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Project"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Workspace"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "PlanningDraft"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Outcome"`);
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    rmSync(dbPath, { force: true });
  } catch {
    /* ignore */
  }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

describe("v2 workflow dogfood smoke", () => {
  it("runs outcome → plan → work → execution → review → QA → release on master services", async () => {
    await prisma.outcome.create({
      data: {
        id: OUTCOME_ID,
        companyId: COMPANY_ID,
        title: "Dogfood V2 loop",
        rawRequest: "Verify the V2 outcome-to-release loop using Avion itself.",
        status: "proposed",
        successCriteria: JSON.stringify(["End-to-end smoke passes"]),
        constraints: JSON.stringify([]),
      },
    });

    const planGenResult = generateDeterministicPlanningDraft({
      companyId: COMPANY_ID,
      outcomeId: OUTCOME_ID,
      title: "Dogfood V2 loop",
      rawRequest: "Verify the V2 outcome-to-release loop using Avion itself.",
      brief: null,
      businessValue: null,
      successCriteria: ["End-to-end smoke passes"],
      constraints: [],
      employees: [],
      repositories: [],
    });
    expect(planGenResult.status).toBe("success");
    if (planGenResult.status !== "success") throw new Error("Plan generation failed");

    const draft = planGenResult.draft;
    const planningDraft = await prisma.planningDraft.create({
      data: {
        id: "draft-dogfood",
        companyId: COMPANY_ID,
        outcomeId: OUTCOME_ID,
        title: draft.title,
        summary: draft.summary,
        status: "draft",
        version: 1,
        scope: JSON.stringify(draft.scope),
        nonScope: JSON.stringify(draft.nonScope),
        assumptions: JSON.stringify(draft.assumptions),
        risks: JSON.stringify(draft.risks),
        dependencies: JSON.stringify(draft.dependencies),
        recommendedAssignments: JSON.stringify(draft.recommendedAssignments),
        generatedProjects: JSON.stringify(draft.generatedProjects),
        generatedFeatures: JSON.stringify(draft.generatedFeatures),
        generatedTasks: JSON.stringify(draft.generatedTasks),
        reviewPlan: JSON.stringify(draft.reviewPlan),
        qaPlan: JSON.stringify(draft.qaPlan),
        releasePlan: JSON.stringify(draft.releasePlan),
      },
    });
    const planGen = { planningDraftId: planningDraft.id };

    const draftBeforeApprove = await prisma.planningDraft.findUnique({
      where: { id: planGen.planningDraftId },
    });
    expect(draftBeforeApprove?.status).toBe("draft");
    expect(JSON.parse(draftBeforeApprove?.generatedTasks ?? "[]")).not.toHaveLength(0);

    const approveResult = await planApplicationService.approvePlanningDraft({
      companyId: COMPANY_ID,
      planningDraftId: planGen.planningDraftId,
      actorId: USER_ID,
    });
    expect(approveResult.status).toBe("approved");

    const applyResult = await planApplicationService.applyApprovedPlan({
      companyId: COMPANY_ID,
      planningDraftId: planGen.planningDraftId,
      actorId: USER_ID,
    });
    expect(applyResult.tasksCreated).toBeGreaterThan(0);

    const task = await prisma.task.findFirst({
      where: { companyId: COMPANY_ID, planningDraftId: planGen.planningDraftId },
      orderBy: { createdAt: "asc" },
    });
    expect(task).not.toBeNull();

    const session = await executionService.createExecutionSession({
      companyId: COMPANY_ID,
      taskId: task!.id,
      taskTitle: task!.title,
      planningDraftId: planGen.planningDraftId,
    });
    expect(session).not.toBeNull();

    await executionService.prepareExecutionSession(
      COMPANY_ID,
      session!.id,
      "# Implementation Brief\nImplement smoke task."
    );
    await executionService.startExecutionSession(COMPANY_ID, session!.id);
    await executionService.recordExecutionResult(COMPANY_ID, session!.id, {
      status: "completed",
      resultSummary: "Smoke implementation complete.",
      filesChanged: ["src/lib/example.ts"],
      validationOutput: "477 tests passed",
    });
    await executionService.recordBranchInfo(COMPANY_ID, session!.id, {
      commitSha: "abc123",
      prUrl: "https://github.com/example/repo/pull/1",
      prNumber: 1,
      prStatus: "open",
    });

    await prisma.review.create({
      data: {
        id: "review-smoke",
        companyId: COMPANY_ID,
        title: `Review: ${task!.title}`,
        entityType: "task",
        entityId: task!.id,
        status: "pending",
      },
    });

    const reviewResult = await reviewService.recordReviewResult({
      companyId: COMPANY_ID,
      reviewId: "review-smoke",
      verdict: "approved",
      notes: "Approved in dogfood smoke.",
    });
    expect(reviewResult.qaResultId).not.toBeNull();

    await prisma.qAResult.update({
      where: { id: reviewResult.qaResultId! },
      data: {
        status: "passed",
        passedCount: 2,
        failedCount: 0,
        checks: JSON.stringify([
          { label: "Smoke check 1", passed: true },
          { label: "Smoke check 2", passed: true },
        ]),
      },
    });
    await prisma.task.update({
      where: { id: task!.id },
      data: { status: "done" },
    });

    const release = await prisma.release.create({
      data: {
        companyId: COMPANY_ID,
        outcomeId: OUTCOME_ID,
        version: "v2.0.0-smoke",
        title: "Dogfood smoke release",
        status: "draft",
        taskIds: JSON.stringify([task!.id]),
        checklist: JSON.stringify([
          { id: "review", label: "Code review approved", checked: true },
          { id: "qa", label: "QA validation passed", checked: true },
        ]),
        releaseNotes: "Dogfood smoke release from automated test.",
      },
    });

    const timelineCount = await prisma.timelineEntry.count();
    expect(timelineCount).toBeGreaterThan(0);
    expect(release.taskIds).toContain(task!.id);

    const finalTask = await prisma.task.findUnique({ where: { id: task!.id } });
    expect(finalTask?.status).toBe("done");
  });
});
