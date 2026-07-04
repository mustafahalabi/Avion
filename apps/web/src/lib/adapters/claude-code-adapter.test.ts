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
import { DockerSandboxRunner } from "./sandbox-runner";

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
      ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits"],
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
      ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions"],
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
        ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", mode],
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

  it("fails the session without crashing the worker when the binary cannot be spawned (MUS-283)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    // A missing binary emits 'error' (ENOENT) instead of 'close'. Without an
    // 'error' listener this line would raise an uncaught exception that kills the
    // worker; with the fix it settles the run as a clean failure.
    child.emit("error", new Error("spawn claude ENOENT"));

    const result = await runPromise;

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("ENOENT");
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

  it("runs the agent inside a docker sandbox when one is injected (Goal 1)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter({
      sandbox: new DockerSandboxRunner({ image: "avion-agent-sandbox:latest" }, {}),
    });
    const runPromise = adapter.run("brief", {
      ...BASE_CONTEXT,
      permissionLevel: "full",
    });

    // Spawns `docker run …` (not `claude`), mounts only the checkout, and the
    // original agent command is preserved verbatim after the image.
    const [command, args] = mockSpawn.mock.calls[0];
    expect(command).toBe("docker");
    expect(args).toContain("/tmp/repo:/workspace");
    const imageIdx = (args as string[]).indexOf("avion-agent-sandbox:latest");
    expect((args as string[]).slice(imageIdx)).toEqual([
      "avion-agent-sandbox:latest",
      "claude",
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
    ]);
    // The brief is still delivered on stdin, unchanged.
    child.emit("close", 0);
    await runPromise;
    expect(child.writtenToStdin).toBe("brief");
  });

  it("captures real usage + summary from a stream-json result event (Goal 3)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    // A realistic stream-json stream: an assistant text event, then the terminal
    // result event carrying the final text + real usage/cost.
    child.stdout.write(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Working on it" }] },
      }) + "\n"
    );
    child.stdout.write(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "## Summary\n\nAdded endpoint.\n\nModified: src/api.ts",
        total_cost_usd: 0.1234,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 2000,
          cache_creation_input_tokens: 300,
        },
        modelUsage: { "claude-opus-4-8": { costUSD: 0.1234 } },
      }) + "\n"
    );
    child.emit("close", 0);

    const result = await runPromise;

    expect(result.success).toBe(true);
    // Parsers run on the RECONSTRUCTED text from the result event.
    expect(result.resultSummary).toBe("Added endpoint.");
    expect(result.filesChanged).toEqual(["src/api.ts"]);
    // Real usage captured, never estimated.
    expect(result.usage).toEqual({
      model: "claude-opus-4-8",
      inputTokens: 100,
      outputTokens: 50,
      cachedInputTokens: 2300,
      costUsd: 0.1234,
    });
  });

  it("fails the run when the result event flags an error (Goal 3)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const adapter = new ClaudeCodeAdapter();
    const runPromise = adapter.run("brief", BASE_CONTEXT);

    child.stdout.write(
      JSON.stringify({
        type: "result",
        subtype: "error_during_execution",
        is_error: true,
        result: "model refused",
        total_cost_usd: 0.01,
        usage: { input_tokens: 5, output_tokens: 0 },
      }) + "\n"
    );
    child.emit("close", 0);

    const result = await runPromise;
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("model refused");
    // Usage is still captured even on a failed run (we still paid for it).
    expect(result.usage?.costUsd).toBe(0.01);
  });
});
