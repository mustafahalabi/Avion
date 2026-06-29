import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAgentCommitMessage,
  commitAndPushSessionBranch,
} from "./repo-manager";

const mockExecSync = vi.fn();

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: (...args: Parameters<typeof actual.execSync>) =>
      mockExecSync(...args),
  };
});

/**
 * Configures the execSync mock to respond to git commands based on a
 * provided porcelain status and HEAD sha.
 */
function configureGit(options: { porcelain: string; headSha: string }): void {
  mockExecSync.mockImplementation((command: string) => {
    if (command.includes("git status --porcelain")) {
      return options.porcelain;
    }
    if (command.includes("git rev-parse HEAD")) {
      return `${options.headSha}\n`;
    }
    return "";
  });
}

/** Returns the list of executed command strings. */
function executedCommands(): string[] {
  return mockExecSync.mock.calls.map((call) => String(call[0]));
}

const BASE_INPUT = {
  checkoutPath: "/tmp/checkout",
  branchName: "feature/MUS-207-commit-push",
  commitMessage: "feat: Implement subscriptions (task_123)",
  baseCommitSha: "basesha000",
};

describe("buildAgentCommitMessage", () => {
  it("formats a feat message referencing the task id", () => {
    expect(buildAgentCommitMessage("Add billing", "task_42")).toBe(
      "feat: Add billing (task_42)"
    );
  });

  it("falls back to a default title when none is provided", () => {
    expect(buildAgentCommitMessage(null, "task_42")).toBe(
      "feat: Apply agent changes (task_42)"
    );
  });

  it("omits the reference when no task id is available", () => {
    expect(buildAgentCommitMessage("Add billing", null)).toBe(
      "feat: Add billing"
    );
  });
});

describe("commitAndPushSessionBranch", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("commits working-tree changes and pushes the branch", () => {
    configureGit({ porcelain: " M src/index.ts\n", headSha: "newsha111" });

    const result = commitAndPushSessionBranch(BASE_INPUT);

    expect(result).toEqual({ pushed: true, commitSha: "newsha111" });

    const commands = executedCommands();
    expect(commands).toContainEqual(expect.stringContaining("git add -A"));
    expect(commands).toContainEqual(expect.stringContaining("commit -F -"));
    expect(commands).toContainEqual(
      expect.stringContaining(`git push origin ${BASE_INPUT.branchName}`)
    );
    // Never force-push.
    expect(commands.some((c) => c.includes("--force"))).toBe(false);
  });

  it("pushes without re-committing when the agent already committed", () => {
    // Clean working tree, but HEAD has advanced past the base SHA.
    configureGit({ porcelain: "", headSha: "agentsha999" });

    const result = commitAndPushSessionBranch(BASE_INPUT);

    expect(result).toEqual({ pushed: true, commitSha: "agentsha999" });

    const commands = executedCommands();
    expect(commands.some((c) => c.includes("git add -A"))).toBe(false);
    expect(commands.some((c) => c.includes("commit -F -"))).toBe(false);
    expect(commands).toContainEqual(
      expect.stringContaining(`git push origin ${BASE_INPUT.branchName}`)
    );
  });

  it("no-ops when the agent produced zero changes", () => {
    // Clean working tree and HEAD still at the base SHA.
    configureGit({ porcelain: "", headSha: BASE_INPUT.baseCommitSha });

    const result = commitAndPushSessionBranch(BASE_INPUT);

    expect(result).toEqual({ pushed: false, commitSha: null });

    const commands = executedCommands();
    expect(commands.some((c) => c.includes("git push"))).toBe(false);
    expect(commands.some((c) => c.includes("commit"))).toBe(false);
  });

  it("refuses to push a protected branch", () => {
    configureGit({ porcelain: " M src/index.ts\n", headSha: "newsha111" });

    expect(() =>
      commitAndPushSessionBranch({ ...BASE_INPUT, branchName: "main" })
    ).toThrow(/Refusing to push agent changes/);

    // No git mutation should have occurred.
    const commands = executedCommands();
    expect(commands.some((c) => c.includes("git push"))).toBe(false);
    expect(commands.some((c) => c.includes("git add"))).toBe(false);
    expect(commands.some((c) => c.includes("commit"))).toBe(false);
  });

  it("refuses to push a release branch", () => {
    configureGit({ porcelain: " M src/index.ts\n", headSha: "newsha111" });

    expect(() =>
      commitAndPushSessionBranch({ ...BASE_INPUT, branchName: "release/v2" })
    ).toThrow(/Refusing to push agent changes/);
  });
});
