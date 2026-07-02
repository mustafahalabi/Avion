import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import { generateDeterministicPlanningDraft } from "./planning-generator";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let planApplicationService: typeof import("./plan-application-service");
let executionService: typeof import("./execution-session-service");
let reviewService: typeof import("./review-service");

const COMPANY_ID = "company-1";
const USER_ID = "user-1";
const OUTCOME_ID = "outcome-dogfood";

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("v2-workflow-dogfood"));

  planApplicationService = await import("./plan-application-service");
  executionService = await import("./execution-session-service");
  reviewService = await import("./review-service");

  // Postgres enforces foreign keys (unlike the old hand-written SQLite tables),
  // so the owner User and Company must exist before any company-scoped row.
  // Everything else (Workspace via ensureDefaultWorkspace, Outcome, PlanningDraft,
  // Project/Feature/Task, ExecutionSession, Review, QAResult, Release) is created
  // by the test body and the services under test.
  await prisma.user.create({
    data: { id: USER_ID, email: "ceo@example.com", role: "admin" },
  });
  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      name: "Avion",
      slug: "engineering-os",
      ownerId: USER_ID,
    },
  });
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
  await teardownTestSchema(prisma, schema);
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
