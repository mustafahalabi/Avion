import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClaudeCliLlmClient } from "./claude-cli-client";

const mockSpawn = vi.fn();

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => mockSpawn(...args),
  };
});

interface MockChildProcess extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createMockChild(): MockChildProcess & { writtenToStdin: string } {
  const child = new EventEmitter() as MockChildProcess & {
    writtenToStdin: string;
  };
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

describe("ClaudeCliLlmClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSpawn.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has the claude-cli provider identifier", () => {
    expect(new ClaudeCliLlmClient().provider).toBe("claude-cli");
  });

  it("spawns claude -p with default permission mode and writes system + prompt to stdin", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ system: "SYS", prompt: "PROMPT" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      ["-p", "--output-format", "json", "--permission-mode", "default"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    child.stdout.write("model output");
    child.emit("close", 0);

    const result = await promise;

    expect(child.writtenToStdin).toBe("SYS\n\nPROMPT");
    // Non-JSON stdout falls back to plain text with no usage (older CLI / surprise).
    expect(result).toEqual({
      ok: true,
      text: "model output",
      durationMs: expect.any(Number),
      usage: null,
    });
  });

  it("parses assistant text + real usage from --output-format json (Goal 3)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ prompt: "plan it" });

    child.stdout.write(
      JSON.stringify({
        type: "result",
        result: "THE PLAN",
        total_cost_usd: 0.42,
        usage: { input_tokens: 1000, output_tokens: 200 },
      })
    );
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("THE PLAN");
      expect(result.usage?.costUsd).toBe(0.42);
      expect(result.usage?.inputTokens).toBe(1000);
    }
  });

  it("omits the system block when no system prompt is given", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ prompt: "only-prompt" });

    child.emit("close", 0);
    await promise;

    expect(child.writtenToStdin).toBe("only-prompt");
  });

  it("returns a failure with stderr on non-zero exit", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ prompt: "PROMPT" });

    child.stderr.write("boom");
    child.emit("close", 1);

    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("boom");
    }
  });

  it("falls back to an exit-code message when stderr is empty", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ prompt: "PROMPT" });

    child.emit("close", 2);

    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Claude CLI exited with code 2");
    }
  });

  it("kills the process and fails on timeout", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ prompt: "PROMPT", timeoutSeconds: 5 });

    vi.advanceTimersByTime(5000);
    child.emit("close", null);

    const result = await promise;

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Claude CLI timed out after 5s");
    }
  });

  it("returns a failure when the process emits an error", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const client = new ClaudeCliLlmClient();
    const promise = client.complete({ prompt: "PROMPT" });

    child.emit("error", new Error("spawn ENOENT"));

    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("spawn ENOENT");
    }
  });
});
