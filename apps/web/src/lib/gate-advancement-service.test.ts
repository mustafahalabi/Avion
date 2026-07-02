import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as GateModule from "./gate-advancement-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof GateModule;

beforeAll(async () => {
  ({ prisma, schema } = await setupTestSchema("gate-advancement-service"));
  service = await import("./gate-advancement-service");

  // Postgres enforces foreign keys (the old SQLite test tables had none), so
  // parent rows must be seeded before their children:
  // User → Company → CompanySettings → Task → ExecutionSession.
  await prisma.user.create({
    data: { id: "user-1", email: "owner@acme.test" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.companySettings.create({
    data: { id: "settings-1", companyId: "company-1", autonomyLevel: "assist" },
  });
  await prisma.task.create({
    data: {
      id: "task-1",
      title: "Add /health endpoint",
      description: "Adds a health check",
      companyId: "company-1",
      status: "in-review",
    },
  });
  await prisma.executionSession.create({
    data: {
      id: "ses-1",
      companyId: "company-1",
      taskId: "task-1",
      status: "completed",
      resultSummary: "Implemented /health",
      filesChanged: JSON.stringify(["src/health.ts"]),
      branchName: "feature/task-1",
      prUrl: "https://github.com/x/y/pull/1",
      completedAt: new Date(),
    },
  });
});

beforeEach(async () => {
  await setAutonomy("assist");
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
    `UPDATE "ExecutionSession" SET "validationOutput" = NULL WHERE "id" = 'ses-1'`
  );
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

async function setAutonomy(level: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "CompanySettings" SET "autonomyLevel" = '${level}', "updatedAt" = CURRENT_TIMESTAMP WHERE "companyId" = 'company-1'`
  );
}

async function taskStatus(): Promise<string | undefined> {
  const t = await prisma.task.findUnique({
    where: { id: "task-1" },
    select: { status: true },
  });
  return t?.status;
}

describe("advanceTaskGates", () => {
  it("at high autonomy advances review → QA → done with recorded results", async () => {
    await setAutonomy("autonomous");

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("completed");
    expect(await taskStatus()).toBe("done");

    // No gate skipped: an approved review AND a passed QA both exist.
    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review?.status).toBe("approved");

    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(qa?.status).toBe("passed");
  });

  it("at delegate autonomy also completes both gates", async () => {
    await setAutonomy("delegate");
    const result = await service.advanceTaskGates("company-1", "task-1");
    expect(result.status).toBe("completed");
    expect(await taskStatus()).toBe("done");
  });

  it("at low autonomy halts at the review checkpoint (needs CEO action)", async () => {
    // assist (default) → auto_review requires approval.
    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("awaiting_review");
    // Task is NOT advanced past in-review and is certainly not done.
    expect(await taskStatus()).toBe("in-review");

    const review = await prisma.review.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(review?.status).toBe("pending");
    // No QA was created or passed — the review gate was not skipped.
    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(qa).toBeNull();
  });

  it("at low autonomy with an approved review halts at the QA checkpoint", async () => {
    await prisma.review.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        title: "Review: task-1",
        status: "approved",
        verdict: "approved",
      },
    });
    await prisma.qAResult.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        status: "pending",
      },
    });

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("awaiting_qa");
    expect(await taskStatus()).toBe("in-review");

    // The QA checklist was attached for the human reviewer.
    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(qa?.status).toBe("pending");
    expect(qa?.checks).not.toBe("[]");
  });

  it("does nothing when the task is not in-review", async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "status" = 'todo' WHERE "id" = 'task-1'`
    );
    const result = await service.advanceTaskGates("company-1", "task-1");
    expect(result.status).toBe("not_in_review");
  });

  it("is idempotent — re-running after completion reports completed", async () => {
    await setAutonomy("autonomous");
    await service.advanceTaskGates("company-1", "task-1");

    const second = await service.advanceTaskGates("company-1", "task-1");
    expect(second.status).toBe("completed");
    expect(await taskStatus()).toBe("done");
  });

  it("emits a timeline event when requesting a review", async () => {
    await service.advanceTaskGates("company-1", "task-1");
    const events = await prisma.timelineEntry.findMany({
      where: { entityId: "task-1", eventType: "review_requested" },
    });
    expect(events.length).toBe(1);
  });

  // ── Truthful automated QA (MUS-251) ──────────────────────────────────────

  it("derives the automated QA verdict from real validation results (all passing → done)", async () => {
    await setAutonomy("autonomous");
    const { serializeValidationChecksMarker } = await import("./validation-runner");
    const marker = serializeValidationChecksMarker([
      { id: "tsc", kind: "tsc", command: "npx tsc --noEmit", passed: true, exitCode: 0, output: "", skipped: false },
      { id: "test", kind: "test", command: "npm run test", passed: true, exitCode: 0, output: "", skipped: false },
    ]);
    await prisma.executionSession.update({
      where: { id: "ses-1" },
      data: { validationOutput: `## Validation\nall good\n\n${marker}` },
    });

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("completed");
    expect(await taskStatus()).toBe("done");

    // The recorded QA checks ARE the real validation results, not a fabricated list.
    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(qa?.status).toBe("passed");
    const checks = JSON.parse(qa?.checks ?? "[]") as { label: string; passed: boolean }[];
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => c.passed)).toBe(true);
    expect(qa?.notes).toMatch(/recorded validation/i);
  });

  it("fails automated QA on a failing validation check and opens a change request (rework loop)", async () => {
    await setAutonomy("autonomous");
    const { serializeValidationChecksMarker } = await import("./validation-runner");
    const marker = serializeValidationChecksMarker([
      { id: "tsc", kind: "tsc", command: "npx tsc --noEmit", passed: true, exitCode: 0, output: "", skipped: false },
      { id: "test", kind: "test", command: "npm run test", passed: false, exitCode: 1, output: "2 failed", skipped: false },
    ]);
    await prisma.executionSession.update({
      where: { id: "ses-1" },
      data: { validationOutput: marker },
    });

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("qa_failed");
    // The task re-enters implementation — it can never reach done on a red check.
    expect(await taskStatus()).toBe("in-progress");

    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(qa?.status).toBe("failed");

    const changeRequests = await prisma.changeRequest.findMany({
      where: { review: { companyId: "company-1", entityId: "task-1" } },
    });
    expect(changeRequests.length).toBeGreaterThan(0);
    expect(changeRequests[0].resolved).toBe(false);
    expect(changeRequests[0].reason).toMatch(/npm run test/);
  });

  it("passes automated QA with an honest note when no validation results were recorded", async () => {
    await setAutonomy("autonomous");
    // ses-1 has validationOutput NULL — no marker.
    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("completed");
    const qa = await prisma.qAResult.findFirst({
      where: { companyId: "company-1", entityId: "task-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(qa?.status).toBe("passed");
    // No fabricated checklist: checks stay empty and the note says why.
    expect(qa?.checks).toBe("[]");
    expect(qa?.notes).toMatch(/no validation-command results/i);
  });

  // ── Rework re-review (MUS-250) ────────────────────────────────────────────

  it("opens a fresh review when rework completed after a changes-requested verdict", async () => {
    // A stale changes_requested review, older than the completed session.
    const stale = await prisma.review.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        title: "Review: Add /health endpoint",
        status: "changes_requested",
        verdict: "changes_requested",
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "Review" SET "updatedAt" = NOW() - INTERVAL '1 hour' WHERE "id" = '${stale.id}'`
    );

    // assist → the fresh review pauses for the CEO instead of dead-ending.
    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("awaiting_review");
    const reviews = await prisma.review.findMany({
      where: { companyId: "company-1", entityId: "task-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(reviews).toHaveLength(2);
    expect(reviews[1].status).toBe("pending");
  });

  it("still reports no_action when changes were requested and no rework has landed", async () => {
    // changes_requested review NEWER than the completed session → wait for rework.
    await prisma.review.create({
      data: {
        companyId: "company-1",
        entityType: "task",
        entityId: "task-1",
        title: "Review: Add /health endpoint",
        status: "changes_requested",
        verdict: "changes_requested",
      },
    });

    const result = await service.advanceTaskGates("company-1", "task-1");

    expect(result.status).toBe("no_action");
    const reviews = await prisma.review.findMany({
      where: { companyId: "company-1", entityId: "task-1" },
    });
    expect(reviews).toHaveLength(1);
  });
});
