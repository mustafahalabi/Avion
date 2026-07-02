import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (autonomy-policy is intentionally NOT mocked — use the real policy) ──

const mockCompanySettingsFindUnique = vi.fn();
const mockTaskFindFirst = vi.fn();
const mockTaskUpdateMany = vi.fn();
const mockSessionFindFirst = vi.fn();
const mockSessionCount = vi.fn();
const mockQaCount = vi.fn();
const mockQaFindFirst = vi.fn();
const mockChangeRequestFindMany = vi.fn();
const mockCompanyFindFirst = vi.fn();
const mockTimelineCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companySettings: {
      findUnique: (...args: unknown[]) => mockCompanySettingsFindUnique(...args),
    },
    task: {
      findFirst: (...args: unknown[]) => mockTaskFindFirst(...args),
      updateMany: (...args: unknown[]) => mockTaskUpdateMany(...args),
    },
    executionSession: {
      findFirst: (...args: unknown[]) => mockSessionFindFirst(...args),
      count: (...args: unknown[]) => mockSessionCount(...args),
    },
    qAResult: {
      findFirst: (...args: unknown[]) => mockQaFindFirst(...args),
      count: (...args: unknown[]) => mockQaCount(...args),
    },
    changeRequest: {
      findMany: (...args: unknown[]) => mockChangeRequestFindMany(...args),
    },
    company: {
      findFirst: (...args: unknown[]) => mockCompanyFindFirst(...args),
    },
    timelineEntry: {
      create: (...args: unknown[]) => mockTimelineCreate(...args),
    },
  },
}));

const mockNotify = vi.fn();
vi.mock("@/lib/notify", () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

const mockSelectNext = vi.fn();
vi.mock("@/lib/task-selection-service", () => ({
  selectNextExecutableTaskForCompany: (...args: unknown[]) => mockSelectNext(...args),
}));

const mockFindLive = vi.fn();
const mockCreateSession = vi.fn();
const mockPrepareSession = vi.fn();
vi.mock("@/lib/execution-session-service", () => ({
  findLiveSessionForTask: (...args: unknown[]) => mockFindLive(...args),
  createExecutionSession: (...args: unknown[]) => mockCreateSession(...args),
  prepareExecutionSession: (...args: unknown[]) => mockPrepareSession(...args),
}));

const mockGenerateBrief = vi.fn();
vi.mock("@/lib/implementation-brief", () => ({
  generateClaudeImplementationBrief: (...args: unknown[]) => mockGenerateBrief(...args),
}));

const mockGetMemory = vi.fn();
vi.mock("@/lib/memory/memory-retrieval-service", () => ({
  getRelevantCompanyMemory: (...args: unknown[]) => mockGetMemory(...args),
}));

// Use the real (pure) repository-resolution helpers — `pickTaskRepository` and
// `resolveTaskRepository` are deterministic logic over the task row, so the
// tests exercise the genuine precedence (explicit link → workspace fallback).
// Only `toBriefRepositoryContext` (which JSON-parses real repo rows) is stubbed.
vi.mock("@/lib/task-repository-context", async (importActual) => {
  const actual = await importActual<
    typeof import("@/lib/task-repository-context")
  >();
  return {
    ...actual,
    toBriefRepositoryContext: vi.fn(() => null),
  };
});

import {
  autoPrepareNextExecutionSession,
  buildTaskImplementationBrief,
  prepareExecutionSessionForTask,
} from "./auto-execution-service";

const SELECTED_TASK = {
  id: "task-1",
  title: "Add /health endpoint",
  status: "todo",
  priority: "medium",
  planningDraftId: "draft-1",
  planItemId: "task:health",
};

const TASK_ROW = {
  id: "task-1",
  title: "Add /health endpoint",
  description: null,
  priority: "medium",
  projectId: "project-1",
  planningDraftId: "draft-1",
  planItemId: "task:health",
  planningDraft: { id: "draft-1", generatedTasks: null },
  project: { workspace: { repositories: [] } },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy-path wiring; individual tests override as needed.
  mockCompanySettingsFindUnique.mockResolvedValue({ autonomyLevel: "assist" });
  mockSelectNext.mockResolvedValue({
    task: SELECTED_TASK,
    reasonCode: "selected",
    reason: "Selected next task.",
  });
  mockFindLive.mockResolvedValue(null);
  mockTaskFindFirst.mockResolvedValue(TASK_ROW);
  mockGenerateBrief.mockReturnValue({
    brief: "BRIEF",
    branchName: "feature/task-1-add-health",
  });
  mockCreateSession.mockResolvedValue({ id: "ses-new" });
  mockPrepareSession.mockResolvedValue({ id: "ses-new", status: "prepared" });
  // Retry/rework defaults: no prior sessions, no failed QA gates, no open CRs.
  mockSessionFindFirst.mockResolvedValue(null);
  mockSessionCount.mockResolvedValue(0);
  mockQaFindFirst.mockResolvedValue(null);
  mockQaCount.mockResolvedValue(0);
  mockChangeRequestFindMany.mockResolvedValue([]);
  mockTaskUpdateMany.mockResolvedValue({ count: 1 });
  mockCompanyFindFirst.mockResolvedValue({ ownerId: "user-1" });
  mockTimelineCreate.mockResolvedValue({ id: "tl-1" });
  mockNotify.mockResolvedValue(undefined);
  mockGetMemory.mockResolvedValue([]);
});

describe("autoPrepareNextExecutionSession", () => {
  it("prepares a session for the next executable task (no UI)", async () => {
    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("prepared");
    expect(result.sessionId).toBe("ses-new");
    expect(result.taskId).toBe("task-1");
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockPrepareSession).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the task already has a live session (idempotent)", async () => {
    mockFindLive.mockResolvedValue({ id: "ses-existing", status: "running" });

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("skipped_existing_session");
    expect(result.sessionId).toBe("ses-existing");
    // No new session is created.
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockPrepareSession).not.toHaveBeenCalled();
  });

  it("does nothing when no executable task is available", async () => {
    mockSelectNext.mockResolvedValue({
      task: null,
      reasonCode: "no_executable_tasks",
      reason: "No executable tasks.",
    });

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("nothing_to_do");
    expect(result.reason).toBe("No executable tasks.");
    expect(mockFindLive).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("does not auto-create below the autonomy threshold (manual → recommend only)", async () => {
    mockCompanySettingsFindUnique.mockResolvedValue({ autonomyLevel: "manual" });

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("autonomy_below_threshold");
    // Selection / creation never run when the level forbids auto-create.
    expect(mockSelectNext).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("treats a missing settings row as the strictest level (no auto-create)", async () => {
    mockCompanySettingsFindUnique.mockResolvedValue(null);

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("autonomy_below_threshold");
  });

  it("auto-creates at higher autonomy levels (autonomous)", async () => {
    mockCompanySettingsFindUnique.mockResolvedValue({
      autonomyLevel: "autonomous",
    });

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("prepared");
  });

  it("surfaces a preparation failure as an error result", async () => {
    mockPrepareSession.mockResolvedValue(null);

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("error");
    expect(result.reason).toMatch(/Failed to prepare/);
    expect(result.taskId).toBe("task-1");
  });

  it("blocks the task and notifies the CEO when the retry budget is exhausted", async () => {
    // Default WORKER_MAX_RETRIES is 1 → two consecutive failures exhaust it.
    mockSessionCount.mockResolvedValue(2);

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("retries_exhausted");
    expect(mockTaskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "blocked" }),
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "blocker", entityId: "task-1" })
    );
    // No session was prepared for the exhausted task.
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("counts failed QA gates toward the budget so committing reworks are bounded (MUS-279)", async () => {
    // No failed *sessions* (the reworks all committed), but two reworks failed QA.
    mockSessionCount.mockResolvedValue(0);
    mockQaCount.mockResolvedValue(2);

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("retries_exhausted");
    expect(mockTaskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "blocked" }),
      })
    );
    // The reset anchor is the last *passed* QA, not any completed session.
    expect(mockQaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityId: "task-1", status: "passed" }),
      })
    );
  });

  it("sums failed sessions and failed QA gates (MUS-279)", async () => {
    // One no-op session + one committed-but-QA-failed rework = 2 > WORKER_MAX_RETRIES.
    mockSessionCount.mockResolvedValue(1);
    mockQaCount.mockResolvedValue(1);

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("retries_exhausted");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("waits out the backoff window after a failed attempt", async () => {
    mockSessionCount.mockResolvedValue(1);
    mockSessionFindFirst.mockImplementation((args: { where?: { status?: string } }) => {
      // latest failed session finished moments ago → still in backoff.
      if (args?.where?.status === "failed") {
        return Promise.resolve({ completedAt: new Date(Date.now() - 5_000) });
      }
      return Promise.resolve(null);
    });

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("retry_backoff");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("retries once the backoff window has elapsed", async () => {
    mockSessionCount.mockResolvedValue(1);
    mockSessionFindFirst.mockImplementation((args: { where?: { status?: string; branchName?: unknown } }) => {
      if (args?.where?.status === "failed") {
        // Failure finished 10 minutes ago — beyond the 60s first backoff.
        return Promise.resolve({ completedAt: new Date(Date.now() - 600_000) });
      }
      return Promise.resolve(null);
    });

    const result = await autoPrepareNextExecutionSession("company-1");

    expect(result.status).toBe("prepared");
  });
});

describe("prepareExecutionSessionForTask", () => {
  it("returns session id, brief, and branch on success", async () => {
    const result = await prepareExecutionSessionForTask("company-1", "task-1");

    expect(result).toEqual({
      sessionId: "ses-new",
      brief: "BRIEF",
      branchName: "feature/task-1-add-health",
    });
  });

  it("returns an error when the task is not found", async () => {
    mockTaskFindFirst.mockResolvedValue(null);

    const result = await prepareExecutionSessionForTask("company-1", "missing");

    expect(result).toEqual({ error: "Task not found." });
  });

  it("returns an error when preparation fails", async () => {
    mockPrepareSession.mockResolvedValue(null);

    const result = await prepareExecutionSessionForTask("company-1", "task-1");

    expect(result).toEqual({ error: "Failed to prepare execution session." });
  });

  it("resolves the repository via the feature's project when the task has no direct project (AI-planned tasks)", async () => {
    const REPO = {
      id: "repo-9",
      name: "eos-sandbox",
      url: "https://github.com/x/eos-sandbox",
      primaryLanguage: null,
      frameworks: "[]",
      techStack: "[]",
      importantFiles: "[]",
      analysisStatus: "pending",
    };
    mockTaskFindFirst.mockResolvedValue({
      id: "task-2",
      title: "Write outcome brief",
      description: null,
      priority: "medium",
      projectId: null,
      featureId: "feat-1",
      planningDraftId: "draft-1",
      planItemId: "task:brief",
      planningDraft: { id: "draft-1", generatedTasks: null },
      project: null,
      feature: {
        projectId: "proj-2",
        project: { repository: null, workspace: { repositories: [REPO] } },
      },
    });

    const result = await prepareExecutionSessionForTask("company-1", "task-2");

    expect("error" in result).toBe(false);
    // Resolved via the feature's project workspace (legacy fallback).
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: "repo-9", projectId: "proj-2" })
    );
  });

  it("builds a rework brief on the prior branch when unresolved change requests exist", async () => {
    mockChangeRequestFindMany.mockResolvedValue([
      { reason: "CI checks failed: test.", requestedBy: "Reviewer" },
    ]);
    mockSessionFindFirst.mockImplementation((args: { where?: { branchName?: unknown } }) => {
      if (args?.where?.branchName) {
        return Promise.resolve({
          branchName: "feature/task-1-add-health",
          prUrl: "https://github.com/x/y/pull/9",
          baseBranch: "master",
        });
      }
      return Promise.resolve(null);
    });

    const result = await prepareExecutionSessionForTask("company-1", "task-1");

    expect("error" in result).toBe(false);
    // The brief carries the change requests and reuses the prior branch/PR.
    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "feature/task-1-add-health",
        reworkContext: expect.objectContaining({
          priorPrUrl: "https://github.com/x/y/pull/9",
          changeRequests: [
            { reason: "CI checks failed: test.", requestedBy: "Reviewer" },
          ],
        }),
      })
    );
  });

  it("passes no rework context on a fresh run (no open change requests)", async () => {
    const result = await prepareExecutionSessionForTask("company-1", "task-1");

    expect("error" in result).toBe(false);
    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({ reworkContext: null, branchName: null })
    );
  });

  it("injects relevant company memory into the brief (MUS-258)", async () => {
    mockGetMemory.mockResolvedValue([
      {
        id: "rec-1",
        category: "standards",
        bankTitle: "Standards",
        content: "Always add ownership guards to new queries.",
        source: null,
        confidence: 0.9,
        createdAt: new Date(),
      },
    ]);

    const result = await prepareExecutionSessionForTask("company-1", "task-1");

    expect("error" in result).toBe(false);
    expect(mockGetMemory).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-1" })
    );
    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        companyMemory: [
          {
            category: "standards",
            content: "Always add ownership guards to new queries.",
          },
        ],
      })
    );
  });

  it("prepares the session with empty memory when retrieval fails (best-effort)", async () => {
    mockGetMemory.mockRejectedValue(new Error("memory backend down"));

    const result = await prepareExecutionSessionForTask("company-1", "task-1");

    expect("error" in result).toBe(false);
    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({ companyMemory: [] })
    );
  });

  it("prefers the project's explicit repository link over the workspace fallback", async () => {
    const LINKED = {
      id: "repo-linked",
      name: "linked-repo",
      url: "https://github.com/x/linked-repo",
      primaryLanguage: null,
      frameworks: "[]",
      techStack: "[]",
      importantFiles: "[]",
      analysisStatus: "pending",
    };
    const WORKSPACE_FALLBACK = { ...LINKED, id: "repo-fallback", name: "fallback-repo" };
    mockTaskFindFirst.mockResolvedValue({
      id: "task-3",
      title: "Implement feature",
      description: null,
      priority: "medium",
      projectId: "project-1",
      featureId: null,
      planningDraftId: "draft-1",
      planItemId: "task:impl",
      planningDraft: { id: "draft-1", generatedTasks: null },
      // Explicit link present AND a (different) workspace repo — the link wins.
      project: {
        repository: LINKED,
        workspace: { repositories: [WORKSPACE_FALLBACK] },
      },
      feature: null,
    });

    const result = await prepareExecutionSessionForTask("company-1", "task-3");

    expect("error" in result).toBe(false);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: "repo-linked", projectId: "project-1" })
    );
  });
});

describe("buildTaskImplementationBrief (MUS-273)", () => {
  const BASE_INPUT = {
    companyId: "company-1",
    taskId: "task-1",
    taskTitle: "Add /health endpoint",
    taskDescription: null,
    priority: "medium",
    planningDraftId: null,
    planItemId: null,
    generatedTasksJson: null,
    repository: null,
    branchName: null,
    baseBranch: "master",
    linearTicketUrl: null,
  } as const;

  it("injects relevant company memory into the shared brief assembler", async () => {
    mockGetMemory.mockResolvedValue([
      {
        id: "rec-1",
        category: "standards",
        bankTitle: "Standards",
        content: "Always add ownership guards to new queries.",
        source: null,
        confidence: 0.9,
        createdAt: new Date(),
      },
    ]);

    const result = await buildTaskImplementationBrief(BASE_INPUT);

    expect(result.brief).toBe("BRIEF");
    expect(mockGetMemory).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-1" })
    );
    // The scripts (live-run-prepare / e2e-agent-test) get the memory section
    // for free by routing through this single assembler.
    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        companyMemory: [
          {
            category: "standards",
            content: "Always add ownership guards to new queries.",
          },
        ],
      })
    );
  });

  it("falls back to an empty memory section when retrieval fails (best-effort)", async () => {
    mockGetMemory.mockRejectedValue(new Error("memory backend down"));

    await buildTaskImplementationBrief(BASE_INPUT);

    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({ companyMemory: [] })
    );
  });

  it("passes rework context through to the brief when provided", async () => {
    await buildTaskImplementationBrief({
      ...BASE_INPUT,
      reworkContext: {
        changeRequests: [{ reason: "Fix the failing test", requestedBy: "QA" }],
        priorPrUrl: "https://github.com/x/y/pull/1",
      },
    });

    expect(mockGenerateBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        reworkContext: expect.objectContaining({
          priorPrUrl: "https://github.com/x/y/pull/1",
        }),
      })
    );
  });
});
