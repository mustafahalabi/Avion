import { spawn } from "node:child_process";

import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from "./llm-client";

/** Default wall-clock budget (seconds) when a request omits `timeoutSeconds`. */
const DEFAULT_TIMEOUT_SECONDS = 120;

/**
 * {@link LlmClient} implementation that shells out to the Claude CLI (`claude -p`).
 *
 * Uses the exact spawn pattern of
 * {@link import("@/lib/adapters/claude-code-adapter").ClaudeCodeAdapter}:
 * `claude -p --permission-mode default`, the prompt written to stdin, stdout/stderr
 * collected, and a hard timeout that kills the process. It NEVER throws for expected
 * failure modes (timeout, non-zero exit, spawn error) — those resolve to an
 * {@link import("./llm-client").LlmCompletionFailure} so planning callers can fall
 * back to the deterministic generator.
 */
export class ClaudeCliLlmClient implements LlmClient {
  readonly provider = "claude-cli";

  /**
   * Runs a single completion via the Claude CLI.
   *
   * @param request - System/user prompt and optional timeout budget.
   * @returns A success with raw stdout text, or a structured failure.
   */
  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const startTime = Date.now();
    const timeoutSeconds = request.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    const input = `${request.system ? `${request.system}\n\n` : ""}${request.prompt}`;

    let stdout = "";
    let stderr = "";
    let exitCode = 1;
    let timedOut = false;
    let spawnError: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const activeChild = spawn("claude", ["-p", "--permission-mode", "default"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      activeChild.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      activeChild.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      exitCode = await new Promise<number>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          activeChild.kill("SIGTERM");
        }, timeoutSeconds * 1000);

        activeChild.on("error", (error: Error) => {
          spawnError = error.message;
          resolve(1);
        });

        activeChild.on("close", (code) => {
          resolve(code ?? 1);
        });

        activeChild.stdin.write(input);
        activeChild.stdin.end();
      });
    } catch (error) {
      spawnError = error instanceof Error ? error.message : String(error);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    const durationMs = Date.now() - startTime;

    if (timedOut) {
      return {
        ok: false,
        error: `Claude CLI timed out after ${timeoutSeconds}s`,
        durationMs,
      };
    }

    if (spawnError !== null) {
      return { ok: false, error: spawnError, durationMs };
    }

    if (exitCode !== 0) {
      return {
        ok: false,
        error: stderr.trim() || `Claude CLI exited with code ${exitCode}`,
        durationMs,
      };
    }

    return { ok: true, text: stdout, durationMs };
  }
}
