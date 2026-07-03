import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (all external side-effects the runner touches) ─────────────────────

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    repository: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const mockGetGitHubConnectionStatus = vi.fn();
vi.mock("@/lib/github-connection-service", () => ({
  getGitHubConnectionStatus: (...args: unknown[]) =>
    mockGetGitHubConnectionStatus(...args),
}));

const mockCloneRepositoryToTempDir = vi.fn();
vi.mock("@/lib/repository-clone", () => ({
  cloneRepositoryToTempDir: (...args: unknown[]) =>
    mockCloneRepositoryToTempDir(...args),
}));

const mockCreateSnapshot = vi.fn();
vi.mock("@/lib/repository-snapshot-service", () => ({
  createRepositoryAnalysisSnapshot: (...args: unknown[]) =>
    mockCreateSnapshot(...args),
}));

import { runRepositoryAnalysis } from "./repository-analysis-runner";

const INPUT = { repositoryId: "repo-1", companyId: "company-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGitHubConnectionStatus.mockResolvedValue({
    raw: { tokens: { accessToken: "gh-token" } },
  });
});

describe("runRepositoryAnalysis", () => {
  it("skips (no clone/update) when the repository is not found", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await runRepositoryAnalysis(INPUT);

    expect(result.status).toBe("skipped");
    expect(mockCloneRepositoryToTempDir).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips (leaves status untouched) when the repository has no URL", async () => {
    mockFindFirst.mockResolvedValue({ id: "repo-1", url: null });

    const result = await runRepositoryAnalysis(INPUT);

    expect(result.status).toBe("skipped");
    expect(mockCloneRepositoryToTempDir).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("marks the repository failed when the clone fails", async () => {
    mockFindFirst.mockResolvedValue({
      id: "repo-1",
      url: "https://github.com/acme/repo",
    });
    mockCloneRepositoryToTempDir.mockRejectedValue(new Error("clone boom"));

    const result = await runRepositoryAnalysis(INPUT);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("clone boom");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "repo-1" },
      data: { analysisStatus: "failed", analysisNotes: "clone boom" },
    });
    expect(mockCreateSnapshot).not.toHaveBeenCalled();
  });

  it("runs the snapshot and cleans up the checkout on success", async () => {
    const cleanup = vi.fn();
    mockFindFirst.mockResolvedValue({
      id: "repo-1",
      url: "https://github.com/acme/repo",
    });
    mockCloneRepositoryToTempDir.mockResolvedValue({ path: "/tmp/x", cleanup });
    mockCreateSnapshot.mockResolvedValue({
      id: "snap-1",
      status: "completed",
      error: null,
    });

    const result = await runRepositoryAnalysis(INPUT);

    expect(mockCloneRepositoryToTempDir).toHaveBeenCalledWith({
      url: "https://github.com/acme/repo",
      token: "gh-token",
    });
    expect(mockCreateSnapshot).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      companyId: "company-1",
      localPath: "/tmp/x",
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "completed", snapshotId: "snap-1" });
  });

  it("cleans up and reports failure when the snapshot analyzer throws", async () => {
    const cleanup = vi.fn();
    mockFindFirst.mockResolvedValue({
      id: "repo-1",
      url: "https://github.com/acme/repo",
    });
    mockCloneRepositoryToTempDir.mockResolvedValue({ path: "/tmp/x", cleanup });
    mockCreateSnapshot.mockRejectedValue(new Error("analyzer boom"));

    const result = await runRepositoryAnalysis(INPUT);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("analyzer boom");
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "repo-1" },
      data: { analysisStatus: "failed", analysisNotes: "analyzer boom" },
    });
  });
});
