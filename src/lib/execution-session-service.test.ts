import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./execution-session-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof ServiceModule;

beforeAll(async () => {
  dbPath = join(
    tmpdir(),
    `execution-session-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./execution-session-service");

  // Bootstrap minimal schema
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug")`
  );

  // Minimal Task table (subset of fields used in FK checks)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Task" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'todo',
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Task_companyId_id_key" ON "Task"("companyId", "id")`
  );

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
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ExecutionSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ExecutionSession_companyId_status_idx" ON "ExecutionSession"("companyId", "status")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ExecutionSession_companyId_taskId_idx" ON "ExecutionSession"("companyId", "taskId")`
  );

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
    INSERT INTO "Task" ("id","title","companyId","createdAt","updatedAt")
    VALUES ('task-1','Implement feature X','company-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "ExecutionSession"`);
  await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "status" = 'todo', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'task-1'`
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  try { rmSync(dbPath, { force: true }); } catch { /* ignore */ }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("execution-session-service", () => {
  // ── createExecutionSession ────────────────────────────────────────────────

  describe("createExecutionSession", () => {
    it("creates a session in queued status", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        taskId: "task-1",
        agentType: "claude_code",
      });

      expect(session.companyId).toBe("company-1");
      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe("claude_code");
      expect(session.status).toBe("queued");
      expect(session.taskBrief).toBeNull();
      expect(session.resultSummary).toBeNull();
      expect(session.startedAt).toBeNull();
      expect(session.completedAt).toBeNull();
    });

    it("defaults agentType to claude_code", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
      });
      expect(session.agentType).toBe("claude_code");
    });

    it("creates a session with all optional links", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        taskId: "task-1",
        agentType: "human",
      });

      expect(session.taskId).toBe("task-1");
      expect(session.projectId).toBeNull();
      expect(session.repositoryId).toBeNull();
      expect(session.employeeId).toBeNull();
      expect(session.planningDraftId).toBeNull();
    });

    it("is company-scoped — multiple sessions can be created for different companies", async () => {
      const s1 = await service.createExecutionSession({ companyId: "company-1" });
      const s2 = await service.createExecutionSession({ companyId: "company-2" });

      expect(s1.id).not.toBe(s2.id);
      expect(s1.companyId).toBe("company-1");
      expect(s2.companyId).toBe("company-2");
    });
  });

  // ── getExecutionSession ───────────────────────────────────────────────────

  describe("getExecutionSession", () => {
    it("returns null when session is not found", async () => {
      const result = await service.getExecutionSession("company-1", "nonexistent");
      expect(result).toBeNull();
    });

    it("retrieves an existing session", async () => {
      const created = await service.createExecutionSession({
        companyId: "company-1",
        taskId: "task-1",
      });

      const fetched = await service.getExecutionSession("company-1", created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it("enforces company ownership — cannot access another company's session", async () => {
      const created = await service.createExecutionSession({
        companyId: "company-2",
      });

      const result = await service.getExecutionSession("company-1", created.id);
      expect(result).toBeNull();
    });
  });

  // ── listExecutionSessions ─────────────────────────────────────────────────

  describe("listExecutionSessions", () => {
    it("returns empty array when no sessions exist", async () => {
      const results = await service.listExecutionSessions("company-1");
      expect(results).toEqual([]);
    });

    it("returns all sessions for a company", async () => {
      await service.createExecutionSession({ companyId: "company-1" });
      await service.createExecutionSession({ companyId: "company-1" });

      const results = await service.listExecutionSessions("company-1");
      expect(results).toHaveLength(2);
    });

    it("filters by status when provided", async () => {
      const s1 = await service.createExecutionSession({ companyId: "company-1" });
      // Prepare and run s1
      await service.prepareExecutionSession("company-1", s1.id, "brief");
      await service.startExecutionSession("company-1", s1.id);

      await service.createExecutionSession({ companyId: "company-1" }); // stays queued

      const running = await service.listExecutionSessions("company-1", "running");
      expect(running).toHaveLength(1);
      expect(running[0]!.status).toBe("running");

      const queued = await service.listExecutionSessions("company-1", "queued");
      expect(queued).toHaveLength(1);
    });

    it("does not return sessions from other companies", async () => {
      await service.createExecutionSession({ companyId: "company-2" });
      const results = await service.listExecutionSessions("company-1");
      expect(results).toHaveLength(0);
    });
  });

  // ── listExecutionSessionsForTask ──────────────────────────────────────────

  describe("listExecutionSessionsForTask", () => {
    it("returns sessions for a specific task", async () => {
      await service.createExecutionSession({ companyId: "company-1", taskId: "task-1" });
      await service.createExecutionSession({ companyId: "company-1", taskId: "task-1" });
      await service.createExecutionSession({ companyId: "company-1" }); // no taskId

      const results = await service.listExecutionSessionsForTask("company-1", "task-1");
      expect(results).toHaveLength(2);
    });

    it("enforces company ownership", async () => {
      await service.createExecutionSession({ companyId: "company-2", taskId: "task-1" });
      const results = await service.listExecutionSessionsForTask("company-1", "task-1");
      expect(results).toHaveLength(0);
    });
  });

  // ── prepareExecutionSession ───────────────────────────────────────────────

  describe("prepareExecutionSession", () => {
    it("transitions a queued session to prepared and stores the brief", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      const prepared = await service.prepareExecutionSession(
        "company-1",
        session.id,
        "# Implementation Brief\n\nDo X."
      );

      expect(prepared).not.toBeNull();
      expect(prepared!.status).toBe("prepared");
      expect(prepared!.taskBrief).toBe("# Implementation Brief\n\nDo X.");
    });

    it("returns null when session is not found", async () => {
      const result = await service.prepareExecutionSession("company-1", "nonexistent", "brief");
      expect(result).toBeNull();
    });

    it("throws when session is not in queued status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");

      await expect(
        service.prepareExecutionSession("company-1", session.id, "brief again")
      ).rejects.toThrow(/queued/);
    });
  });

  // ── startExecutionSession ─────────────────────────────────────────────────

  describe("startExecutionSession", () => {
    it("transitions a prepared session to running and sets startedAt", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");

      const running = await service.startExecutionSession("company-1", session.id);
      expect(running).not.toBeNull();
      expect(running!.status).toBe("running");
      expect(running!.startedAt).toBeInstanceOf(Date);
    });

    it("returns null when session is not found", async () => {
      const result = await service.startExecutionSession("company-1", "nonexistent");
      expect(result).toBeNull();
    });

    it("throws when session is not in prepared status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });

      await expect(
        service.startExecutionSession("company-1", session.id)
      ).rejects.toThrow(/prepared/);
    });
  });

  // ── recordExecutionResult ─────────────────────────────────────────────────

  describe("recordExecutionResult", () => {
    async function createRunningSession() {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");
      await service.startExecutionSession("company-1", session.id);
      return session;
    }

    it("records a completed result with files changed and sets completedAt", async () => {
      const session = await createRunningSession();
      const result = await service.recordExecutionResult("company-1", session.id, {
        status: "completed",
        resultSummary: "Feature implemented successfully.",
        filesChanged: ["src/lib/foo.ts", "src/lib/foo.test.ts"],
        validationOutput: "✅ tsc, lint, test all pass",
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe("completed");
      expect(result!.resultSummary).toBe("Feature implemented successfully.");
      expect(result!.validationOutput).toBe("✅ tsc, lint, test all pass");
      expect(result!.completedAt).toBeInstanceOf(Date);
      // Verify files serialized correctly
      const files = service.getSessionFilesChanged(result!);
      expect(files).toEqual(["src/lib/foo.ts", "src/lib/foo.test.ts"]);
    });

    it("records a failed result with error message", async () => {
      const session = await createRunningSession();
      const result = await service.recordExecutionResult("company-1", session.id, {
        status: "failed",
        errorMessage: "TypeScript type error in src/lib/bar.ts",
        validationOutput: "❌ tsc failed: 3 errors",
      });

      expect(result!.status).toBe("failed");
      expect(result!.errorMessage).toBe("TypeScript type error in src/lib/bar.ts");
    });

    it("records needs_clarification result", async () => {
      const session = await createRunningSession();
      const result = await service.recordExecutionResult("company-1", session.id, {
        status: "needs_clarification",
        errorMessage: "Ambiguous acceptance criteria on step 3.",
      });

      expect(result!.status).toBe("needs_clarification");
    });

    it("returns null when session is not found", async () => {
      const result = await service.recordExecutionResult("company-1", "nonexistent", {
        status: "completed",
      });
      expect(result).toBeNull();
    });

    it("throws when session is not in running status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await expect(
        service.recordExecutionResult("company-1", session.id, { status: "completed" })
      ).rejects.toThrow(/running/);
    });

    it("does not fake code execution — result is exactly what is reported", async () => {
      const session = await createRunningSession();
      const result = await service.recordExecutionResult("company-1", session.id, {
        status: "completed",
        resultSummary: "Agent-provided summary only",
        filesChanged: [],
        validationOutput: "Agent-provided validation output",
      });

      expect(result!.resultSummary).toBe("Agent-provided summary only");
      expect(service.getSessionFilesChanged(result!)).toEqual([]);
    });
  });

  // ── cancelExecutionSession ────────────────────────────────────────────────

  describe("cancelExecutionSession", () => {
    it("cancels a queued session", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      const canceled = await service.cancelExecutionSession("company-1", session.id);

      expect(canceled!.status).toBe("canceled");
      expect(canceled!.completedAt).toBeInstanceOf(Date);
    });

    it("cancels a prepared session", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");

      const canceled = await service.cancelExecutionSession("company-1", session.id);
      expect(canceled!.status).toBe("canceled");
    });

    it("cancels a running session", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");
      await service.startExecutionSession("company-1", session.id);

      const canceled = await service.cancelExecutionSession("company-1", session.id);
      expect(canceled!.status).toBe("canceled");
    });

    it("returns null when session is not found", async () => {
      const result = await service.cancelExecutionSession("company-1", "nonexistent");
      expect(result).toBeNull();
    });

    it("throws when session is already in a terminal state", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.cancelExecutionSession("company-1", session.id);

      await expect(
        service.cancelExecutionSession("company-1", session.id)
      ).rejects.toThrow(/terminal/);
    });

    it("throws when session is already completed", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");
      await service.startExecutionSession("company-1", session.id);
      await service.recordExecutionResult("company-1", session.id, { status: "completed" });

      await expect(
        service.cancelExecutionSession("company-1", session.id)
      ).rejects.toThrow(/terminal/);
    });
  });

  // ── getSessionFilesChanged ────────────────────────────────────────────────

  describe("getSessionFilesChanged", () => {
    it("returns files changed as a string array", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "brief");
      await service.startExecutionSession("company-1", session.id);
      const closed = await service.recordExecutionResult("company-1", session.id, {
        status: "completed",
        filesChanged: ["a.ts", "b.ts", "c.ts"],
      });

      expect(service.getSessionFilesChanged(closed!)).toEqual(["a.ts", "b.ts", "c.ts"]);
    });

    it("returns empty array when no files changed", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      expect(service.getSessionFilesChanged(session)).toEqual([]);
    });
  });

  // ── isSessionTerminal ─────────────────────────────────────────────────────

  describe("isSessionTerminal", () => {
    it("returns false for queued status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      expect(service.isSessionTerminal(session)).toBe(false);
    });

    it("returns false for running status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "b");
      const running = await service.startExecutionSession("company-1", session.id);
      expect(service.isSessionTerminal(running!)).toBe(false);
    });

    it("returns true for completed status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "b");
      await service.startExecutionSession("company-1", session.id);
      const done = await service.recordExecutionResult("company-1", session.id, {
        status: "completed",
      });
      expect(service.isSessionTerminal(done!)).toBe(true);
    });

    it("returns true for failed status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.prepareExecutionSession("company-1", session.id, "b");
      await service.startExecutionSession("company-1", session.id);
      const failed = await service.recordExecutionResult("company-1", session.id, {
        status: "failed",
      });
      expect(service.isSessionTerminal(failed!)).toBe(true);
    });

    it("returns true for canceled status", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      const canceled = await service.cancelExecutionSession("company-1", session.id);
      expect(service.isSessionTerminal(canceled!)).toBe(true);
    });
  });

  // ── generateBranchName ────────────────────────────────────────────────────

  describe("generateBranchName", () => {
    it("generates a deterministic branch name including the task identifier", () => {
      const name = service.generateBranchName("MUS-152", "Add branch and PR tracking");
      expect(name).toBe("feature/MUS-152-add-branch-and-pr-tracking");
    });

    it("lowercases and slugifies the title", () => {
      const name = service.generateBranchName("T-1", "Fix: Crash on Login!");
      expect(name).toMatch(/^feature\/T-1-/);
      // Title portion must be slugified (no uppercase, colons, or exclamation marks)
      const titleSlug = name.replace(/^feature\/T-1-/, "");
      expect(titleSlug).not.toMatch(/[A-Z:!]/);
    });

    it("is stable across calls with identical inputs", () => {
      const a = service.generateBranchName("MUS-99", "Some Feature");
      const b = service.generateBranchName("MUS-99", "Some Feature");
      expect(a).toBe(b);
    });
  });

  // ── isProtectedBranch ─────────────────────────────────────────────────────

  describe("isProtectedBranch", () => {
    it("identifies main as protected", () => {
      expect(service.isProtectedBranch("main")).toBe(true);
    });

    it("identifies master as protected", () => {
      expect(service.isProtectedBranch("master")).toBe(true);
    });

    it("identifies release/* branches as protected", () => {
      expect(service.isProtectedBranch("release/v1")).toBe(true);
      expect(service.isProtectedBranch("release/2024-q1")).toBe(true);
    });

    it("identifies v<digit> branches as protected", () => {
      expect(service.isProtectedBranch("v1")).toBe(true);
      expect(service.isProtectedBranch("v2.0")).toBe(true);
    });

    it("does not flag feature branches as protected", () => {
      expect(service.isProtectedBranch("feature/MUS-152-foo")).toBe(false);
      expect(service.isProtectedBranch("fix/some-bug")).toBe(false);
      expect(service.isProtectedBranch("hotfix/critical")).toBe(false);
    });
  });

  // ── createExecutionSession branch tracking ────────────────────────────────

  describe("createExecutionSession — branch tracking", () => {
    it("stores branchName and baseBranch when provided", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        branchName: "feature/MUS-152-tracking",
        baseBranch: "master",
      });
      expect(session.branchName).toBe("feature/MUS-152-tracking");
      expect(session.baseBranch).toBe("master");
    });

    it("derives branchName from taskId and taskTitle when not provided", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        taskId: "task-1",
        taskTitle: "Implement Feature",
      });
      expect(session.branchName).toBe("feature/task-1-implement-feature");
    });

    it("defaults baseBranch to master", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      expect(session.baseBranch).toBe("master");
    });

    it("rejects a protected branchName unless isHotfix is true", async () => {
      await expect(
        service.createExecutionSession({
          companyId: "company-1",
          branchName: "main",
        })
      ).rejects.toThrow(/protected branch/);

      await expect(
        service.createExecutionSession({
          companyId: "company-1",
          branchName: "release/v1",
        })
      ).rejects.toThrow(/protected branch/);
    });

    it("allows a protected branchName when isHotfix is true", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        branchName: "release/v1",
        isHotfix: true,
      });
      expect(session.branchName).toBe("release/v1");
    });

    it("leaves branchName null when taskId and taskTitle are not provided", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      expect(session.branchName).toBeNull();
    });
  });

  // ── recordBranchInfo ──────────────────────────────────────────────────────

  describe("recordBranchInfo", () => {
    it("updates commitSha, prUrl, prNumber, prStatus, and mergeStatus", async () => {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        branchName: "feature/task-1-foo",
      });

      const updated = await service.recordBranchInfo("company-1", session.id, {
        commitSha: "abc1234",
        prUrl: "https://github.com/org/repo/pull/42",
        prNumber: 42,
        prStatus: "open",
        mergeStatus: "pending",
      });

      expect(updated).not.toBeNull();
      expect(updated!.commitSha).toBe("abc1234");
      expect(updated!.prUrl).toBe("https://github.com/org/repo/pull/42");
      expect(updated!.prNumber).toBe(42);
      expect(updated!.prStatus).toBe("open");
      expect(updated!.mergeStatus).toBe("pending");
    });

    it("returns null for a session not owned by the company", async () => {
      const session = await service.createExecutionSession({ companyId: "company-2" });
      const result = await service.recordBranchInfo("company-1", session.id, {
        commitSha: "abc1234",
      });
      expect(result).toBeNull();
    });

    it("returns the unchanged session when called with no updates", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      const result = await service.recordBranchInfo("company-1", session.id, {});
      expect(result!.id).toBe(session.id);
    });

    it("returns null for nonexistent session", async () => {
      const result = await service.recordBranchInfo("company-1", "nonexistent", {
        commitSha: "abc",
      });
      expect(result).toBeNull();
    });

    it("can update prStatus to merged and mergeStatus to merged", async () => {
      const session = await service.createExecutionSession({ companyId: "company-1" });
      await service.recordBranchInfo("company-1", session.id, {
        prStatus: "open",
        mergeStatus: "pending",
      });
      const merged = await service.recordBranchInfo("company-1", session.id, {
        prStatus: "merged",
        mergeStatus: "merged",
      });
      expect(merged!.prStatus).toBe("merged");
      expect(merged!.mergeStatus).toBe("merged");
    });
  });

  // ── ingestAgentExecutionResult ────────────────────────────────────────────

  describe("ingestAgentExecutionResult", () => {
    async function createPreparedSession(taskId?: string) {
      const session = await service.createExecutionSession({
        companyId: "company-1",
        taskId: taskId ?? null,
      });
      await service.prepareExecutionSession("company-1", session.id, "# Brief");
      return session;
    }

    it("records a completed result and moves task to in-review", async () => {
      const session = await createPreparedSession("task-1");

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "completed",
        resultSummary: "Implementation done.",
        filesChanged: "src/lib/foo.ts\nsrc/lib/foo.test.ts",
        validationOutput: "✅ all pass",
        errorMessage: null,
      });

      expect(outcome.session.status).toBe("completed");
      expect(outcome.session.completedAt).toBeInstanceOf(Date);
      expect(outcome.newTaskStatus).toBe("in-review");
      expect(outcome.taskStatusChanged).toBe(true);

      const task = await prisma.task.findUnique({ where: { id: "task-1" }, select: { status: true } });
      expect(task?.status).toBe("in-review");
    });

    it("records a failed result and leaves task actionable (todo)", async () => {
      const session = await createPreparedSession("task-1");

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "failed",
        resultSummary: null,
        filesChanged: [],
        validationOutput: null,
        errorMessage: "tsc failed: type error in foo.ts",
      });

      expect(outcome.session.status).toBe("failed");
      expect(outcome.session.errorMessage).toBe("tsc failed: type error in foo.ts");
      expect(outcome.newTaskStatus).toBe("todo");

      const task = await prisma.task.findUnique({ where: { id: "task-1" }, select: { status: true } });
      expect(task?.status).toBe("todo");
    });

    it("records needs_clarification and leaves task actionable", async () => {
      const session = await createPreparedSession("task-1");

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "needs_clarification",
        resultSummary: "Unclear requirement in acceptance criteria.",
        filesChanged: "",
        validationOutput: null,
        errorMessage: null,
      });

      expect(outcome.session.status).toBe("needs_clarification");
      expect(outcome.newTaskStatus).toBe("todo");
    });

    it("auto-starts a prepared session before recording the result", async () => {
      const session = await createPreparedSession();

      expect(session.status).toBe("queued");

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "completed",
        resultSummary: "Done.",
        filesChanged: [],
        validationOutput: null,
        errorMessage: null,
      });

      expect(outcome.session.status).toBe("completed");
      expect(outcome.session.startedAt).toBeInstanceOf(Date);
    });

    it("parses filesChanged from newline-separated string", async () => {
      const session = await createPreparedSession();

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "completed",
        resultSummary: null,
        filesChanged: "src/lib/a.ts\nsrc/lib/b.ts\n",
        validationOutput: null,
        errorMessage: null,
      });

      const files = service.getSessionFilesChanged(outcome.session);
      expect(files).toEqual(["src/lib/a.ts", "src/lib/b.ts"]);
    });

    it("parses filesChanged from an array", async () => {
      const session = await createPreparedSession();

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "failed",
        resultSummary: null,
        filesChanged: ["src/lib/x.ts"],
        validationOutput: null,
        errorMessage: null,
      });

      const files = service.getSessionFilesChanged(outcome.session);
      expect(files).toEqual(["src/lib/x.ts"]);
    });

    it("throws when the session is not found", async () => {
      await expect(
        service.ingestAgentExecutionResult({
          companyId: "company-1",
          sessionId: "nonexistent",
          status: "completed",
          resultSummary: null,
          filesChanged: [],
          validationOutput: null,
          errorMessage: null,
        })
      ).rejects.toThrow(/not found/);
    });

    it("throws when the session is already in a terminal state", async () => {
      const session = await createPreparedSession();
      await service.cancelExecutionSession("company-1", session.id);

      await expect(
        service.ingestAgentExecutionResult({
          companyId: "company-1",
          sessionId: session.id,
          status: "completed",
          resultSummary: null,
          filesChanged: [],
          validationOutput: null,
          errorMessage: null,
        })
      ).rejects.toThrow(/terminal/);
    });

    it("does not change task status when no task is linked", async () => {
      const session = await createPreparedSession();

      const outcome = await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "completed",
        resultSummary: null,
        filesChanged: [],
        validationOutput: null,
        errorMessage: null,
      });

      expect(outcome.newTaskStatus).toBeNull();
      expect(outcome.taskStatusChanged).toBe(false);
    });

    it("does not mark review or QA complete — task moves only to in-review", async () => {
      const session = await createPreparedSession("task-1");

      await service.ingestAgentExecutionResult({
        companyId: "company-1",
        sessionId: session.id,
        status: "completed",
        resultSummary: null,
        filesChanged: [],
        validationOutput: null,
        errorMessage: null,
      });

      const task = await prisma.task.findUnique({ where: { id: "task-1" }, select: { status: true } });
      expect(task?.status).toBe("in-review");
      expect(task?.status).not.toBe("done");
    });
  });
});
