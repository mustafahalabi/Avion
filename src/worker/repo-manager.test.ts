import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorkerAuditLog } from "@/lib/worker-audit-log";
import { getWorkerPermissions } from "@/lib/worker-permissions";

import {
  buildAgentCommitMessage,
  commitAndPushSessionBranch,
  evaluatePrePushGuardrails,
  recordPrePushViolations,
  summarizePrePushBlock,
  type PrePushGuardResult,
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

/** Configures the porcelain output returned for `git status --porcelain`. */
function configurePorcelain(porcelain: string): void {
  mockExecSync.mockImplementation((command: string) => {
    if (command.includes("git status --porcelain")) return porcelain;
    return "";
  });
}

describe("evaluatePrePushGuardrails", () => {
  // "assist" autonomy → execute profile (git add/commit/push allowed).
  const permissions = getWorkerPermissions("assist");

  beforeEach(() => {
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes for in-scope source edits on a feature branch (clean pass)", () => {
    configurePorcelain(" M src/lib/foo.ts\n M src/lib/foo.test.ts\n");

    const result = evaluatePrePushGuardrails({
      checkoutPath: "/tmp/x",
      branchName: "feature/MUS-213-enforce",
      permissions,
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.changedFiles).toEqual([
      "src/lib/foo.ts",
      "src/lib/foo.test.ts",
    ]);
  });

  it("blocks when the agent edits a protected path", () => {
    configurePorcelain(" M src/lib/foo.ts\n M .env\n");

    const result = evaluatePrePushGuardrails({
      checkoutPath: "/tmp/x",
      branchName: "feature/MUS-213-enforce",
      permissions,
    });

    expect(result.passed).toBe(false);
    const offendingPaths = result.violations
      .filter((v) => v.path !== undefined)
      .map((v) => v.path);
    expect(offendingPaths).toContain(".env");
  });

  it("blocks a push to a protected branch", () => {
    configurePorcelain(" M src/lib/foo.ts\n");

    const result = evaluatePrePushGuardrails({
      checkoutPath: "/tmp/x",
      branchName: "master",
      permissions,
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.rule === "protected-branch")).toBe(
      true
    );
  });

  it("blocks a dangerous git command (force-push)", () => {
    configurePorcelain(" M src/lib/foo.ts\n");

    const result = evaluatePrePushGuardrails({
      checkoutPath: "/tmp/x",
      branchName: "feature/MUS-213-enforce",
      permissions,
      intendedCommands: ["git push --force origin feature/MUS-213-enforce"],
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.rule === "no-force-push")).toBe(true);
  });

  it("blocks commands the permission profile does not allow", () => {
    configurePorcelain(" M src/lib/foo.ts\n");

    // "manual" autonomy → read_only profile: no commands permitted.
    const readOnly = getWorkerPermissions("manual");
    const result = evaluatePrePushGuardrails({
      checkoutPath: "/tmp/x",
      branchName: "feature/MUS-213-enforce",
      permissions: readOnly,
    });

    expect(result.passed).toBe(false);
    expect(
      result.violations.some((v) => v.rule === "command-not-permitted")
    ).toBe(true);
  });

  it("enforces guardrails regardless of a broad (full) permission profile", () => {
    // Even with maximum autonomy, a protected path is still blocked.
    configurePorcelain(" M prisma/migrations/0001_init/migration.sql\n");

    const result = evaluatePrePushGuardrails({
      checkoutPath: "/tmp/x",
      branchName: "feature/MUS-213-enforce",
      permissions: getWorkerPermissions("autonomous"),
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.rule === "protected-file")).toBe(
      true
    );
  });
});

describe("recordPrePushViolations / summarizePrePushBlock", () => {
  const blockedResult: PrePushGuardResult = {
    passed: false,
    changedFiles: [".env"],
    violations: [
      { rule: "protected-file", severity: "block", message: "env blocked", path: ".env" },
      {
        rule: "no-force-push",
        severity: "block",
        message: "force push blocked",
        command: "git push --force origin x",
      },
      { rule: "advisory", severity: "warn", message: "just a warning" },
    ],
  };

  it("records each block in the audit log (paths and commands)", () => {
    const log = createWorkerAuditLog("ses_audit");

    recordPrePushViolations(log, blockedResult);

    expect(log.getEventsByType("guardrail_triggered")).toHaveLength(1);
    expect(log.getEventsByType("command_blocked")).toHaveLength(1);
    // Warn-severity violations are not recorded as blocks.
    expect(log.getEvents()).toHaveLength(2);
    expect(log.getEvents().every((e) => e.severity === "error")).toBe(true);
  });

  it("summarizes blocks with the offending paths and commands", () => {
    const reason = summarizePrePushBlock(blockedResult);
    expect(reason).toContain(".env");
    expect(reason).toContain("git push --force origin x");
    expect(reason).toContain("2 guardrail violations");
  });
});
