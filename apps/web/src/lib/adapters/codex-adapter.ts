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
import type { AgentStreamEventInput } from "@/lib/agent-stream/types";

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
    // Reassemble chunked stdout/stderr into complete lines for the live stream,
    // WITHOUT disturbing the full buffered capture the stdout parsers depend on.
    const stdoutLines = createLineEmitter((line) =>
      emit({ type: "text", label: line, detail: line, atMs: Date.now() - startTime })
    );
    const stderrLines = createLineEmitter((line) =>
      emit({ type: "stderr", label: line, detail: line, atMs: Date.now() - startTime })
    );

    try {
      // "-" makes codex exec read the entire prompt from stdin (headless mode).
      child = spawn("codex", ["exec", "--sandbox", mode, "-"], {
        cwd: context.repositoryPath,
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
        // This is especially relevant for codex, whose CLI may be absent on the
        // worker host (see MUS-276).
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

    // Drain any trailing partial line, then mark the run's lifecycle end. This
    // runs after the process has settled and `success` is known; the buffered
    // result above is already computed and unaffected.
    stdoutLines.flush();
    stderrLines.flush();
    emit({
      type: "status",
      label: success ? "Agent finished" : "Agent stopped",
      detail: `exit ${exitCode}`,
      atMs: durationMs,
    });

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
