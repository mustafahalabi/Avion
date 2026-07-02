import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "./execution-adapter";
import {
  ClaudeCodeAdapter,
  mapPermissionLevelToMode,
  parseFilesChanged,
  parseResultSummary,
  parseValidationOutput,
} from "./claude-code-adapter";

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

describe("mapPermissionLevelToMode", () => {
  it("maps read_only to default", () => {
    expect(mapPermissionLevelToMode("read_only")).toBe("default");
  });

  it("maps suggest to default", () => {
    expect(mapPermissionLevelToMode("suggest")).toBe("default");
  });

  it("maps execute to acceptEdits", () => {
    expect(mapPermissionLevelToMode("execute")).toBe("acceptEdits");
  });

  it("maps full to bypassPermissions", () => {
    expect(mapPermissionLevelToMode("full")).toBe("bypassPermissions");
  });
});

describe("parseResultSummary", () => {
  it("extracts summary from ## Summary heading", () => {
    const stdout = "## Summary\n\nAdded health endpoint successfully.\n\n## Validation";
    expect(parseResultSummary(stdout)).toBe("Added health endpoint successfully.");
  });

  it("extracts summary from ## Result Summary heading", () => {
    const stdout = "## Result Summary\n\nImplemented password reset flow.";
    expect(parseResultSummary(stdout)).toBe("Implemented password reset flow.");
  });
});

describe("parseFilesChanged", () => {
  it("parses Modified: lines", () => {
    const stdout = "Modified: src/foo.ts\nModified: src/bar.ts";
    expect(parseFilesChanged(stdout)).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  it("parses Created and Deleted lines", () => {
    const stdout = "Created: src/new.ts\nDeleted: src/old.ts";
    expect(parseFilesChanged(stdout)).toEqual(["src/new.ts", "src/old.ts"]);
  });
});

describe("parseValidationOutput", () => {
  it("extracts validation block", () => {
    const stdout = "## Validation\n\nnpm test passed\n\n## Summary\nDone";
    expect(parseValidationOutput(stdout)).toBe("npm test passed");
  });
});

describe("ClaudeCodeAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSpawn.mockReset();
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes brief via stdin and uses repositoryPath as cwd", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter();
    const runPromise = adapter.run("test brief content", BASE_CONTEXT);

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      ["-p", "--permission-mode", "acceptEdits"],
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

  it("uses permission mode override when provided", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter({ permissionModeOverride: "bypassPermissions" });
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      ["-p", "--permission-mode", "bypassPermissions"],
      expect.any(Object)
    );

    child.emit("close", 0);
    await runPromise;
  });

  it("maps all permission levels to correct spawn flags", async () => {
    const levels = [
      ["read_only", "default"],
      ["suggest", "default"],
      ["execute", "acceptEdits"],
      ["full", "bypassPermissions"],
    ] as const;

    for (const [level, mode] of levels) {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const adapter = new ClaudeCodeAdapter();
      const runPromise = adapter.run("brief", { ...BASE_CONTEXT, permissionLevel: level });

      expect(mockSpawn).toHaveBeenLastCalledWith(
        "claude",
        ["-p", "--permission-mode", mode],
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

    const adapter = new ClaudeCodeAdapter();
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

    const adapter = new ClaudeCodeAdapter();
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

    const adapter = new ClaudeCodeAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stdout.write("## Summary\n\nCompleted task.");
    child.emit("close", 0);

    const result = await runPromise;

    expect(result.success).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.exitCode).toBe(0);
  });

  it("always captures stdout and stderr", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stdout.write("stdout line");
    child.stderr.write("stderr line");
    child.emit("close", 2);

    const result = await runPromise;

    expect(result.stdout).toBe("stdout line");
    expect(result.stderr).toBe("stderr line");
  });
});
