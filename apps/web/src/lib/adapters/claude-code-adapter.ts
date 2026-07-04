import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type {
  ExecutionAdapter,
  ExecutionContext,
  ExecutionResult,
  PermissionLevel,
} from "./execution-adapter";
import {
  parseFilesChanged,
  parseFilesChangedFromGit,
  parseResultSummary,
  parseValidationOutput,
} from "./agent-output-parser";
import { createLineEmitter } from "./stream-lines";
import {
  resolveSandboxRunner,
  type SandboxRunner,
} from "./sandbox-runner";
import {
  createClaudeStreamJsonParser,
  type StreamJsonEvent,
} from "./claude-stream-json";
import type { AgentUsage } from "./agent-usage";
import type { AgentStreamEventInput } from "@/lib/agent-stream/types";

// Re-export the shared stdout parsers so existing importers keep working —
// the parsing now lives in agent-output-parser.ts, shared by every adapter.
export {
  parseFilesChanged,
  parseFilesChangedFromGit,
  parseResultSummary,
  parseValidationOutput,
} from "./agent-output-parser";

/** Maps Avion permission levels to Claude Code `--permission-mode` flags. */
const PERMISSION_MODE_MAP: Record<PermissionLevel, string> = {
  read_only: "default",
  suggest: "default",
  execute: "acceptEdits",
  full: "bypassPermissions",
};

/** Options for constructing a ClaudeCodeAdapter instance. */
export interface ClaudeCodeAdapterOptions {
  /** When set, overrides the permission mode derived from context.permissionLevel. */
  permissionModeOverride?: string;
  /**
   * Sandbox that wraps the agent spawn (Goal 1). Defaults to the env-resolved
   * runner ({@link resolveSandboxRunner}); the `none` runner spawns `claude`
   * directly (unchanged), the `docker` runner isolates it in a container.
   */
  sandbox?: SandboxRunner;
}

/**
 * Execution adapter that invokes the Claude Code CLI via `claude -p`.
 *
 * Passes the implementation brief on stdin, maps permission levels to
 * `--permission-mode` flags, and parses structured sections from stdout.
 */
export class ClaudeCodeAdapter implements ExecutionAdapter {
  readonly agentType = "claude_code" as const;

  private readonly permissionModeOverride: string | undefined;
  private readonly sandbox: SandboxRunner;

  /**
   * Creates a Claude Code adapter.
   *
   * @param options - Optional overrides for permission mode and sandbox.
   */
  constructor(options?: ClaudeCodeAdapterOptions) {
    this.permissionModeOverride = options?.permissionModeOverride;
    this.sandbox = options?.sandbox ?? resolveSandboxRunner();
  }

  /**
   * Runs `claude -p` with the given brief and execution context.
   *
   * @param brief - Markdown brief written to the process stdin.
   * @param context - Repository path, branch, permissions, and timeout.
   * @returns Structured execution result with parsed stdout sections.
   */
  async run(brief: string, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const mode =
      this.permissionModeOverride ?? PERMISSION_MODE_MAP[context.permissionLevel];

    let stdout = "";
    let stderr = "";
    let exitCode = 1;
    let timedOut = false;
    let spawnError: Error | null = null;
    let errorMessage: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let child: ChildProcessWithoutNullStreams | undefined;

    const onStream = context.onStream;
    // Best-effort live-output sink. A throwing handler is swallowed so streaming
    // can never break the run or alter the returned result.
    const emit = (event: AgentStreamEventInput): void => {
      try {
        onStream?.(event);
      } catch {
        // Ignored — streaming is best-effort and must never affect execution.
      }
    };
    // stdout is `--output-format stream-json`: newline-delimited JSON events.
    // The parser folds them into live feed events (text/tool), the reconstructed
    // final assistant text (fed to the stdout parsers), and REAL usage/cost. Raw
    // JSONL lines are reassembled first, WITHOUT disturbing the full capture.
    const streamJson = createClaudeStreamJsonParser((event: StreamJsonEvent) =>
      emit({
        type: event.type,
        label: event.label,
        detail: event.detail ?? event.label,
        atMs: Date.now() - startTime,
      })
    );
    const stdoutLines = createLineEmitter((line) => streamJson.push(line));
    const stderrLines = createLineEmitter((line) =>
      emit({ type: "stderr", label: line, detail: line, atMs: Date.now() - startTime })
    );

    try {
      // Wrap the host invocation through the sandbox. `none` → spawn `claude`
      // directly (unchanged); `docker` → spawn `docker run … claude -p …` so the
      // agent is isolated from the host and can safely run at full power.
      // `--output-format stream-json --verbose` gives a live feed AND real usage.
      const invocation = this.sandbox.wrap({
        command: "claude",
        args: [
          "-p",
          "--output-format",
          "stream-json",
          "--verbose",
          "--permission-mode",
          mode,
        ],
        repositoryPath: context.repositoryPath,
      });
      child = spawn(invocation.command, invocation.args, {
        cwd: invocation.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });
      emit({ type: "status", label: "Agent started", detail: this.agentType, atMs: 0 });

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        stdoutLines.push(chunk.toString());
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        stderrLines.push(chunk.toString());
      });

      exitCode = await new Promise<number>((resolve) => {
        let settled = false;
        const settle = (code: number): void => {
          if (settled) return;
          settled = true;
          resolve(code);
        };

        timeoutId = setTimeout(() => {
          timedOut = true;
          child?.kill("SIGTERM");
        }, context.timeoutSeconds * 1000);

        // A missing/unspawnable binary (ENOENT) or runtime spawn failure emits
        // 'error'; without this listener it becomes an UNCAUGHT exception that
        // crashes the whole worker instead of failing just this session (MUS-283).
        child!.on("error", (err: Error) => {
          spawnError = err;
          settle(1);
        });
        child!.on("close", (code) => settle(code ?? 1));

        // If the process never starts (or exits before reading stdin), writing
        // the brief emits EPIPE — swallow it so it can't surface as an unhandled
        // stream error; the 'error'/'close' handlers own the outcome.
        child!.stdin.on("error", () => {});
        try {
          child!.stdin.write(brief);
          child!.stdin.end();
        } catch {
          // Ignored — the 'error' event settles the promise.
        }
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    const durationMs = Date.now() - startTime;

    // Drain any trailing partial line into the parser before folding.
    stdoutLines.flush();
    stderrLines.flush();
    const folded = streamJson.result();
    // The reconstructed assistant text is what the section parsers expect; raw
    // JSONL never reaches them. When no stream-json result was seen (older CLI /
    // plain text), fall back to the raw stdout so parsing still works.
    const parseText = folded.sawResult ? folded.text : stdout;
    const usage: AgentUsage | null = folded.usage;

    if (spawnError) {
      errorMessage = `Agent process error: ${(spawnError as Error).message}`;
    } else if (timedOut) {
      errorMessage = `Agent timed out after ${context.timeoutSeconds}s`;
    } else if (exitCode !== 0) {
      errorMessage = stderr.trim() || `Process exited with code ${exitCode}`;
    } else if (folded.isError) {
      errorMessage = folded.text.trim() || "Agent reported an error";
    }

    const resultSummary = parseResultSummary(parseText);
    // On-disk git truth is authoritative for what actually changed; the stdout
    // parse is only a fallback when this is not a git repo (MUS-278).
    const fromGit = parseFilesChangedFromGit(context.repositoryPath);
    const filesChanged = fromGit.length > 0 ? fromGit : parseFilesChanged(parseText);
    const validationOutput = parseValidationOutput(parseText);
    const success = exitCode === 0 && !timedOut && !spawnError && !folded.isError;

    // Mark the run's lifecycle end. This runs after the process has settled and
    // `success` is known; the folded result above is already computed.
    emit({
      type: "status",
      label: success ? "Agent finished" : "Agent stopped",
      detail: `exit ${exitCode}`,
      atMs: durationMs,
    });

    return {
      exitCode,
      stdout: parseText,
      stderr,
      success,
      resultSummary,
      filesChanged,
      validationOutput,
      errorMessage,
      durationMs,
      usage,
    };
  }
}

/**
 * Resolves the Claude Code permission mode for a given permission level.
 *
 * @param level - Avion permission level.
 * @returns Claude Code `--permission-mode` flag value.
 */
export function mapPermissionLevelToMode(level: PermissionLevel): string {
  return PERMISSION_MODE_MAP[level];
}
