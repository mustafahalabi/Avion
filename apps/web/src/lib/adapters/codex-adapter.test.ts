import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "./execution-adapter";
import { CodexAdapter, mapPermissionLevelToSandboxMode } from "./codex-adapter";

const mockSpawn = vi.fn();
const mockExecSync = vi.fn();

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => mockSpawn(...args),
    execSync: (...args: Parameters<typeof actual.execSync>) => mockExecSync(...args),
  };
});

interface MockChildProcess extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createMockChild(): MockChildProcess & { writtenToStdin: string } {
  const child = new EventEmitter() as MockChildProcess & { writtenToStdin: string };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  child.writtenToStdin = "";

  const originalWrite = child.stdin.write.bind(child.stdin);
  child.stdin.write = ((chunk: string | Buffer, ...args: unknown[]) => {
    child.writtenToStdin += typeof chunk === "string" ? chunk : chunk.toString();
    return originalWrite(chunk as Buffer, ...(args as []));
  }) as typeof child.stdin.write;

  return child;
}

const BASE_CONTEXT: ExecutionContext = {
  repositoryPath: "/tmp/repo",
  branchName: "feature/test",
  permissionLevel: "execute",
  timeoutSeconds: 30,
  sessionId: "session-123",
};

describe("mapPermissionLevelToSandboxMode", () => {
  it("maps read_only to read-only", () => {
    expect(mapPermissionLevelToSandboxMode("read_only")).toBe("read-only");
  });

  it("maps suggest to read-only", () => {
    expect(mapPermissionLevelToSandboxMode("suggest")).toBe("read-only");
  });

  it("maps execute to workspace-write", () => {
    expect(mapPermissionLevelToSandboxMode("execute")).toBe("workspace-write");
  });

  it("maps full to danger-full-access", () => {
    expect(mapPermissionLevelToSandboxMode("full")).toBe("danger-full-access");
  });
});

describe("CodexAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSpawn.mockReset();
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the codex agentType", () => {
    expect(new CodexAdapter().agentType).toBe("codex");
  });

  it("passes brief via stdin and uses repositoryPath as cwd", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("test brief content", BASE_CONTEXT);

    expect(mockSpawn).toHaveBeenCalledWith(
      "codex",
      ["exec", "--sandbox", "workspace-write", "-"],
      {
        cwd: "/tmp/repo",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    child.stdout.write(
      "## Summary\n\nDone.\n\nModified: src/foo.ts\n\n## Validation\n\nall good"
    );
    child.emit("close", 0);

    const result = await runPromise;

    expect(child.writtenToStdin).toBe("test brief content");
    expect(result.success).toBe(true);
    expect(result.resultSummary).toBe("Done.");
    expect(result.filesChanged).toEqual(["src/foo.ts"]);
    expect(result.validationOutput).toBe("all good");
    expect(result.stdout).toContain("## Summary");
    expect(result.stderr).toBe("");
  });

  it("uses sandbox mode override when provided", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter({ sandboxModeOverride: "danger-full-access" });
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    expect(mockSpawn).toHaveBeenCalledWith(
      "codex",
      ["exec", "--sandbox", "danger-full-access", "-"],
      expect.any(Object)
    );

    child.emit("close", 0);
    await runPromise;
  });

  it("maps all permission levels to correct spawn flags", async () => {
    const levels = [
      ["read_only", "read-only"],
      ["suggest", "read-only"],
      ["execute", "workspace-write"],
      ["full", "danger-full-access"],
    ] as const;

    for (const [level, mode] of levels) {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const adapter = new CodexAdapter();
      const runPromise = adapter.run("brief", { ...BASE_CONTEXT, permissionLevel: level });

      expect(mockSpawn).toHaveBeenLastCalledWith(
        "codex",
        ["exec", "--sandbox", mode, "-"],
        expect.any(Object)
      );

      child.emit("close", 0);
      await runPromise;
      mockSpawn.mockReset();
    }
  });

  it("kills process on timeout and sets errorMessage", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", { ...BASE_CONTEXT, timeoutSeconds: 5 });

    vi.advanceTimersByTime(5000);
    child.emit("close", null);

    const result = await runPromise;

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Agent timed out after 5s");
  });

  it("sets success false and errorMessage from stderr on non-zero exit", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stderr.write("Something went wrong");
    child.emit("close", 1);

    const result = await runPromise;

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toBe("Something went wrong");
    expect(result.stderr).toBe("Something went wrong");
  });

  it("sets success true on zero exit code", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stdout.write("## Summary\n\nCompleted task.");
    child.emit("close", 0);

    const result = await runPromise;

    expect(result.success).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.exitCode).toBe(0);
  });

  it("fails the session without crashing the worker when the binary cannot be spawned (MUS-283)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    // codex may be absent on the worker host (MUS-276): a missing binary emits
    // 'error' (ENOENT) instead of 'close'. Without an 'error' listener this line
    // would raise an uncaught exception that kills the worker; with the fix it
    // settles the run as a clean failure.
    child.emit("error", new Error("spawn codex ENOENT"));

    const result = await runPromise;

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("ENOENT");
  });

  it("always captures stdout and stderr", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stdout.write("stdout line");
    child.stderr.write("stderr line");
    child.emit("close", 2);

    const result = await runPromise;

    expect(result.stdout).toBe("stdout line");
    expect(result.stderr).toBe("stderr line");
  });

  it("records the on-disk git changes as authoritative for filesChanged (MUS-278)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);
    // Porcelain v1: modified + untracked. Git is the source of truth.
    mockExecSync.mockReturnValue(" M src/real-a.ts\n?? src/real-b.ts\n");

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    // Even a plausible-looking stdout claim must not override the real git diff.
    child.stdout.write("Modified: src/CLAIMED-but-not-real.ts");
    child.emit("close", 0);

    const result = await runPromise;

    expect(mockExecSync).toHaveBeenCalledWith(
      "git status --porcelain",
      expect.objectContaining({ cwd: "/tmp/repo" })
    );
    expect(result.filesChanged).toEqual(["src/real-a.ts", "src/real-b.ts"]);
  });

  it("returns empty filesChanged when both output parsing and git fallback fail", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repository");
    });

    const adapter = new CodexAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stdout.write("no structured output");
    child.emit("close", 0);

    const result = await runPromise;

    expect(result.filesChanged).toEqual([]);
  });
});
