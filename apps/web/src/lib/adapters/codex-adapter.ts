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

/**
 * Maps Avion permission levels to Codex CLI `--sandbox` flags.
 *
 * `codex exec` never prompts for approval, so the sandbox mode is the whole
 * permission story: `read-only` cannot edit files, `workspace-write` can edit
 * inside the checkout, and `danger-full-access` removes sandboxing entirely
 * (the analog of Claude Code's `bypassPermissions`).
 */
const SANDBOX_MODE_MAP: Record<PermissionLevel, string> = {
  read_only: "read-only",
  suggest: "read-only",
  execute: "workspace-write",
  full: "danger-full-access",
};

/** Options for constructing a CodexAdapter instance. */
export interface CodexAdapterOptions {
  /** When set, overrides the sandbox mode derived from context.permissionLevel. */
  sandboxModeOverride?: string;
}

/**
 * Execution adapter that invokes the OpenAI Codex CLI via `codex exec`.
 *
 * Passes the implementation brief on stdin (`codex exec -` reads the entire
 * prompt from stdin), maps permission levels to `--sandbox` flags, and parses
 * structured sections from stdout with the same defensive parsers as every
 * other adapter — including the git-diff fallback for `filesChanged`.
 */
export class CodexAdapter implements ExecutionAdapter {
  readonly agentType = "codex" as const;

  private readonly sandboxModeOverride: string | undefined;

  /**
   * Creates a Codex adapter.
   *
   * @param options - Optional overrides for sandbox mode.
   */
  constructor(options?: CodexAdapterOptions) {
    this.sandboxModeOverride = options?.sandboxModeOverride;
  }

  /**
   * Runs `codex exec` with the given brief and execution context.
   *
   * @param brief - Markdown brief written to the process stdin.
   * @param context - Repository path, branch, permissions, and timeout.
   * @returns Structured execution result with parsed stdout sections.
   */
  async run(brief: string, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const mode =
      this.sandboxModeOverride ?? SANDBOX_MODE_MAP[context.permissionLevel];

    let stdout = "";
    let stderr = "";
    let exitCode = 1;
    let timedOut = false;
    let errorMessage: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let child: ChildProcessWithoutNullStreams | undefined;

    try {
      // "-" makes codex exec read the entire prompt from stdin (headless mode).
      child = spawn("codex", ["exec", "--sandbox", mode, "-"], {
        cwd: context.repositoryPath,
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.stdin.write(brief);
      child.stdin.end();

      exitCode = await new Promise<number>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          child?.kill("SIGTERM");
        }, context.timeoutSeconds * 1000);

        child!.on("close", (code) => {
          resolve(code ?? 1);
        });
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    const durationMs = Date.now() - startTime;

    if (timedOut) {
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
    const success = exitCode === 0 && !timedOut;

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
 * Resolves the Codex sandbox mode for a given permission level.
 *
 * @param level - Avion permission level.
 * @returns Codex CLI `--sandbox` flag value.
 */
export function mapPermissionLevelToSandboxMode(level: PermissionLevel): string {
  return SANDBOX_MODE_MAP[level];
}
