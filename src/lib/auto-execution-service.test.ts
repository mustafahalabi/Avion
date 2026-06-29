import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (autonomy-policy is intentionally NOT mocked — use the real policy) ──

const mockCompanySettingsFindUnique = vi.fn();
const mockTaskFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companySettings: {
      findUnique: (...args: unknown[]) => mockCompanySettingsFindUnique(...args),
    },
    task: {
      findFirst: (...args: unknown[]) => mockTaskFindFirst(...args),
    },
  },
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

vi.mock("@/lib/task-repository-context", () => ({
  resolveTaskRepository: vi.fn(() => null),
  toBriefRepositoryContext: vi.fn(() => null),
}));

import {
  autoPrepareNextExecutionSession,
  prepareExecutionSessionForTask,
} from "./auto-execution-service";
import { resolveTaskRepository } from "@/lib/task-repository-context";

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
        project: { workspace: { repositories: [REPO] } },
      },
    });
    // First call (direct project — none) → null; second (the feature's project) → the repo.
    vi.mocked(resolveTaskRepository)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => REPO);

    const result = await prepareExecutionSessionForTask("company-1", "task-2");

    expect("error" in result).toBe(false);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: "repo-9", projectId: "proj-2" })
    );
  });
});
