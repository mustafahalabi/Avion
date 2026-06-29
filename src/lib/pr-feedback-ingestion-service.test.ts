import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as IngestionModule from "./pr-feedback-ingestion-service";
import type { PullRequestFeedback } from "./github-pr-feedback";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof IngestionModule;

/** Builds a stub feedback fetcher returning a fixed payload. */
function stubFeedback(feedback: PullRequestFeedback) {
  return async () => feedback;
}

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `pr-feedback-ingestion-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./pr-feedback-ingestion-service");

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
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Task_companyId_id_key" ON "Task"("companyId", "id")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Review" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "entityType" TEXT NOT NULL DEFAULT 'task',
      "entityId" TEXT NOT NULL,
      "reviewerId" TEXT,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "verdict" TEXT,
      "notes" TEXT,
      "changeRequestNotes" TEXT,
      "findings" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChangeRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "reviewId" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "requestedBy" TEXT,
      "resolution" TEXT,
      "resolved" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ChangeRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QAResult" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL DEFAULT 'task',
      "entityId" TEXT NOT NULL,
      "outcomeId" TEXT,
      "planningDraftId" TEXT,
      "planItemId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "passedCount" INTEGER NOT NULL DEFAULT 0,
      "failedCount" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT,
      "checks" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimelineEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "summary" TEXT,
      "actorId" TEXT,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Repository" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "url" TEXT,
      "description" TEXT,
      "primaryLanguage" TEXT,
      "techStack" TEXT NOT NULL DEFAULT '[]',
      "frameworks" TEXT NOT NULL DEFAULT '[]',
      "dependencies" TEXT NOT NULL DEFAULT '[]',
      "importantFiles" TEXT NOT NULL DEFAULT '[]',
      "fileCount" INTEGER,
      "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
      "analysisNotes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
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
      "branchName" TEXT,
      "baseBranch" TEXT,
      "commitSha" TEXT,
      "prUrl" TEXT,
      "prNumber" INTEGER,
      "prStatus" TEXT,
      "mergeStatus" TEXT,
      "startedAt" DATETIME,
      "completedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProviderConnection" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "provider" TEXT NOT NULL,
      "connectionType" TEXT NOT NULL DEFAULT 'oauth',
      "status" TEXT NOT NULL DEFAULT 'disconnected',
      "externalAccountId" TEXT,
      "externalAccountName" TEXT,
      "externalAccountEmail" TEXT,
      "scopes" TEXT NOT NULL DEFAULT '[]',
      "encryptedTokens" TEXT NOT NULL DEFAULT '{}',
      "tokenExpiresAt" DATETIME,
      "refreshAvailable" INTEGER NOT NULL DEFAULT 0,
      "errorCode" TEXT,
      "errorMessage" TEXT,
      "lastConnectedAt" DATETIME,
      "disconnectedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);

  // ── Seed ────────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Repository" ("id","workspaceId","name","url","createdAt","updatedAt")
    VALUES ('repo-1','ws-1','widgets','https://github.com/acme/widgets.git',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Task" ("id","title","companyId","status","createdAt","updatedAt")
    VALUES ('task-1','Implement feature X','company-1','in-review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionSession" ("id","companyId","taskId","repositoryId","status","commitSha","prUrl","prNumber","prStatus","createdAt","updatedAt")
    VALUES ('ses-1','company-1','task-1','repo-1','completed','abc123','https://github.com/acme/widgets/pull/7',7,'open',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  // Legacy plaintext JSON token payload — decryptCredentials migrates it
  // transparently, so no CREDENTIALS_ENCRYPTION_KEY is needed in tests.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ProviderConnection" ("id","companyId","userId","provider","connectionType","status","encryptedTokens","createdAt","updatedAt")
    VALUES ('conn-1','company-1',NULL,'github','manual_token','connected','{"accessToken":"ghp_test"}',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ChangeRequest"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "QAResult"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
  await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "status" = 'in-review', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'task-1'`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "ExecutionSession" SET "prStatus" = 'open', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'ses-1'`
  );
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CI_FAILURE: PullRequestFeedback = {
  state: "open",
  reviewDecision: "none",
  checksConclusion: "failure",
  checks: [{ name: "test", conclusion: "failure" }],
};

const APPROVED_SUCCESS: PullRequestFeedback = {
  state: "open",
  reviewDecision: "approved",
  checksConclusion: "success",
  checks: [{ name: "ci", conclusion: "success" }],
};

const MERGED: PullRequestFeedback = {
  state: "merged",
  reviewDecision: "approved",
  checksConclusion: "success",
  checks: [{ name: "ci", conclusion: "success" }],
};

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("ingestPullRequestFeedbackForCompany", () => {
  it("opens a ChangeRequest and re-loops the task on CI failure", async () => {
    const result = await service.ingestPullRequestFeedbackForCompany("company-1", {
      fetchFeedback: stubFeedback(CI_FAILURE),
    });

    expect(result.sessionsChecked).toBe(1);
    expect(result.changeRequestsOpened).toBe(1);
    expect(result.merged).toBe(0);

    const task = await prisma.task.findUnique({ where: { id: "task-1" } });
    expect(task?.status).toBe("in-progress");

    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review?.status).toBe("changes_requested");
    expect(review?.title.startsWith("PR feedback:")).toBe(true);

    const changeRequests = await prisma.changeRequest.findMany({
      where: { reviewId: review!.id },
    });
    expect(changeRequests).toHaveLength(1);
    expect(changeRequests[0].reason).toMatch(/CI checks failed/i);
  });

  it("is idempotent — a second run opens no duplicate ChangeRequest", async () => {
    const deps = { fetchFeedback: stubFeedback(CI_FAILURE) };

    const first = await service.ingestPullRequestFeedbackForCompany("company-1", deps);
    expect(first.changeRequestsOpened).toBe(1);

    const second = await service.ingestPullRequestFeedbackForCompany("company-1", deps);
    expect(second.sessionsChecked).toBe(1);
    expect(second.changeRequestsOpened).toBe(0);

    const reviews = await prisma.review.findMany({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(reviews).toHaveLength(1);

    const changeRequests = await prisma.changeRequest.findMany({
      where: { reviewId: reviews[0].id },
    });
    expect(changeRequests).toHaveLength(1);
  });

  it("opens a ChangeRequest when a reviewer requested changes (checks passing)", async () => {
    const result = await service.ingestPullRequestFeedbackForCompany("company-1", {
      fetchFeedback: stubFeedback({
        state: "open",
        reviewDecision: "changes_requested",
        checksConclusion: "success",
        checks: [{ name: "ci", conclusion: "success" }],
      }),
    });

    expect(result.changeRequestsOpened).toBe(1);
    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review?.notes).toMatch(/requested changes/i);
  });

  it("marks the session merged when the PR is merged", async () => {
    const result = await service.ingestPullRequestFeedbackForCompany("company-1", {
      fetchFeedback: stubFeedback(MERGED),
    });

    expect(result.sessionsChecked).toBe(1);
    expect(result.merged).toBe(1);
    expect(result.changeRequestsOpened).toBe(0);

    const session = await prisma.executionSession.findUnique({
      where: { id: "ses-1" },
    });
    expect(session?.prStatus).toBe("merged");
  });

  it("does nothing for an approved + passing PR", async () => {
    const result = await service.ingestPullRequestFeedbackForCompany("company-1", {
      fetchFeedback: stubFeedback(APPROVED_SUCCESS),
    });

    expect(result.sessionsChecked).toBe(1);
    expect(result.changeRequestsOpened).toBe(0);
    expect(result.merged).toBe(0);

    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review).toBeNull();

    const task = await prisma.task.findUnique({ where: { id: "task-1" } });
    expect(task?.status).toBe("in-review");
  });

  it("skips sessions with no merged/draft/open PR (none in scope)", async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE "ExecutionSession" SET "prStatus" = 'closed' WHERE "id" = 'ses-1'`
    );

    const result = await service.ingestPullRequestFeedbackForCompany("company-1", {
      fetchFeedback: stubFeedback(CI_FAILURE),
    });

    expect(result.sessionsChecked).toBe(0);
    expect(result.changeRequestsOpened).toBe(0);
  });
});
