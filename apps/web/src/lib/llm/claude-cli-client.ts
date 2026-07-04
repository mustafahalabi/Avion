import { spawn } from "node:child_process";

import { parseClaudeResultUsage, type AgentUsage } from "@/lib/adapters/agent-usage";
import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from "./llm-client";

/** Default wall-clock budget (seconds) when a request omits `timeoutSeconds`. */
const DEFAULT_TIMEOUT_SECONDS = 120;

/**
 * Extracts the assistant text + real usage from a Claude CLI `--output-format
 * json` payload. Falls back to treating the whole output as plain text (older
 * CLI / unexpected shape) so planning never breaks on a format surprise.
 */
function parseClaudeJsonOutput(stdout: string): { text: string; usage: AgentUsage | null } {
  try {
    const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
    const text =
      typeof parsed.result === "string" ? parsed.result : stdout;
    return { text, usage: parseClaudeResultUsage(parsed) };
  } catch {
    return { text: stdout, usage: null };
  }
}

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
      // `--output-format json` returns a single JSON object with the assistant
      // text under `result` plus real `total_cost_usd` / `usage` (Goal 3).
      const activeChild = spawn(
        "claude",
        ["-p", "--output-format", "json", "--permission-mode", "default"],
        { stdio: ["pipe", "pipe", "pipe"] }
      );

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
          // Force-resolve on timeout: a `claude` process that is slow to exit (or
          // ignores SIGTERM) must never hang the caller past its budget. `timedOut`
          // drives the failure result below; a later `close` event is a no-op.
          resolve(1);
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

    const { text, usage } = parseClaudeJsonOutput(stdout);
    return { ok: true, text, durationMs, usage };
  }
}
