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

  /**
   * Creates a Claude Code adapter.
   *
   * @param options - Optional overrides for permission mode.
   */
  constructor(options?: ClaudeCodeAdapterOptions) {
    this.permissionModeOverride = options?.permissionModeOverride;
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

    try {
      child = spawn("claude", ["-p", "--permission-mode", mode], {
        cwd: context.repositoryPath,
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
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

    if (spawnError) {
      errorMessage = `Agent process error: ${(spawnError as Error).message}`;
    } else if (timedOut) {
      errorMessage = `Agent timed out after ${context.timeoutSeconds}s`;
    } else if (exitCode !== 0) {
      errorMessage = stderr.trim() || `Process exited with code ${exitCode}`;
    }

    const resultSummary = parseResultSummary(stdout);
    // On-disk git truth is authoritative for what actually changed; the stdout
    // parse is only a fallback when this is not a git repo (MUS-278).
    const fromGit = parseFilesChangedFromGit(context.repositoryPath);
    const filesChanged = fromGit.length > 0 ? fromGit : parseFilesChanged(stdout);
    const validationOutput = parseValidationOutput(stdout);
    const success = exitCode === 0 && !timedOut && !spawnError;

    return {
      exitCode,
      stdout,
      stderr,
      success,
      resultSummary,
      filesChanged,
      validationOutput,
      errorMessage,
      durationMs,
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
