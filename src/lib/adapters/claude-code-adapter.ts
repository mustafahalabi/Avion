import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { execSync } from "node:child_process";

import type {
  ExecutionAdapter,
  ExecutionContext,
  ExecutionResult,
  PermissionLevel,
} from "./execution-adapter";

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
    let filesChanged = parseFilesChanged(stdout);
    if (filesChanged.length === 0) {
      filesChanged = parseFilesChangedFromGit(context.repositoryPath);
    }
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
 * Resolves the Claude Code permission mode for a given permission level.
 *
 * @param level - Avion permission level.
 * @returns Claude Code `--permission-mode` flag value.
 */
export function mapPermissionLevelToMode(level: PermissionLevel): string {
  return PERMISSION_MODE_MAP[level];
}

/**
 * Extracts the paragraph following a `## Result Summary` or `## Summary` heading.
 *
 * @param stdout - Combined agent stdout.
 * @returns Summary text or null when not found.
 */
export function parseResultSummary(stdout: string): string | null {
  const match = stdout.match(
    /## (?:Result Summary|Summary)\s*\n+([^\n#][^\n]*(?:\n(?![#])[^\n]+)*)/i
  );
  if (!match?.[1]) {
    return null;
  }
  const summary = match[1].trim();
  return summary.length > 0 ? summary : null;
}

/**
 * Parses file change lines from agent stdout.
 *
 * Supports `Created:`, `Modified:`, `Deleted:` prefixes and bullet lists
 * under a `Files changed:` heading.
 *
 * @param stdout - Combined agent stdout.
 * @returns Relative file paths detected in output.
 */
export function parseFilesChanged(stdout: string): string[] {
  const files = new Set<string>();

  for (const line of stdout.split("\n")) {
    const prefixMatch = line.match(/^(?:Created|Modified|Deleted):\s*(.+)$/i);
    if (prefixMatch?.[1]) {
      files.add(prefixMatch[1].trim());
      continue;
    }

    const bulletMatch = line.match(/^\s*-\s+(.+)$/);
    if (bulletMatch?.[1] && isUnderFilesChangedSection(stdout, line)) {
      files.add(bulletMatch[1].trim());
    }
  }

  return [...files];
}

/**
 * Falls back to `git diff --name-only HEAD~1` when stdout parsing finds nothing.
 *
 * @param repositoryPath - Checked-out repository path.
 * @returns Changed file paths from git, or empty array on failure.
 */
export function parseFilesChangedFromGit(repositoryPath: string): string[] {
  try {
    const output = execSync("git diff --name-only HEAD~1", {
      cwd: repositoryPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Extracts text between `## Validation` and the next `##` heading.
 *
 * @param stdout - Combined agent stdout.
 * @returns Validation block text or null when not found.
 */
export function parseValidationOutput(stdout: string): string | null {
  const match = stdout.match(/## Validation\s*\n([\s\S]*?)(?=\n## |\s*$)/i);
  if (!match?.[1]) {
    return null;
  }
  const block = match[1].trim();
  return block.length > 0 ? block : null;
}

/**
 * Returns true when a bullet line appears after a `Files changed:` heading.
 *
 * @param stdout - Full stdout text.
 * @param line - The bullet line being evaluated.
 * @returns Whether the line is within a files-changed section.
 */
function isUnderFilesChangedSection(stdout: string, line: string): boolean {
  const lineIndex = stdout.indexOf(line);
  if (lineIndex < 0) {
    return false;
  }
  const preceding = stdout.slice(0, lineIndex);
  const filesChangedIndex = preceding.lastIndexOf("Files changed:");
  if (filesChangedIndex < 0) {
    return false;
  }
  const sectionBetween = preceding.slice(filesChangedIndex);
  return !sectionBetween.includes("\n## ");
}
