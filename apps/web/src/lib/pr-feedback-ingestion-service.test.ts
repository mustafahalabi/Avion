import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as IngestionModule from "./pr-feedback-ingestion-service";
import type { PullRequestFeedback } from "./github-pr-feedback";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof IngestionModule;

/** Builds a stub feedback fetcher returning a fixed payload. */
function stubFeedback(feedback: PullRequestFeedback) {
  return async () => feedback;
}

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("pr-feedback-ingestion-service"));
  service = await import("./pr-feedback-ingestion-service");

  // ── Seed (Postgres enforces FKs — parents before children) ────────────────
  // User → Company → Workspace → Repository, plus Task and ExecutionSession.
  await prisma.user.create({
    data: { id: "user-1", email: "owner@acme.test" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.workspace.create({
    data: { id: "ws-1", name: "Default", slug: "default", companyId: "company-1" },
  });
  await prisma.repository.create({
    data: {
      id: "repo-1",
      workspaceId: "ws-1",
      name: "widgets",
      url: "https://github.com/acme/widgets.git",
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
  await prisma.executionSession.create({
    data: {
      id: "ses-1",
      companyId: "company-1",
      taskId: "task-1",
      repositoryId: "repo-1",
      status: "completed",
      commitSha: "abc123",
      prUrl: "https://github.com/acme/widgets/pull/7",
      prNumber: 7,
      prStatus: "open",
    },
  });
  // Legacy plaintext JSON token payload — decryptCredentials migrates it
  // transparently, so no CREDENTIALS_ENCRYPTION_KEY is needed in tests.
  await prisma.providerConnection.create({
    data: {
      id: "conn-1",
      companyId: "company-1",
      userId: null,
      provider: "github",
      connectionType: "manual_token",
      status: "connected",
      encryptedTokens: '{"accessToken":"ghp_test"}',
    },
  });
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
  await teardownTestSchema(prisma, schema);
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
