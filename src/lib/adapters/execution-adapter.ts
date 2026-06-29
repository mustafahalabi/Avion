/**
 * Provider-independent execution adapter contract.
 *
 * Defines shared types for invoking AI agent CLIs (Claude Code, Codex, etc.)
 * with a structured brief and collecting normalized execution results.
 */

/** Capability tier controlling how much autonomy the agent has during execution. */
export type PermissionLevel = "read_only" | "suggest" | "execute" | "full";

/** Runtime context passed to an execution adapter for a single session. */
export interface ExecutionContext {
  /** Absolute path to the checked-out repository on disk. */
  repositoryPath: string;
  /** Branch the agent should work on. */
  branchName: string;
  /** Permission level from worker-permissions.ts. */
  permissionLevel: PermissionLevel;
  /** Timeout in seconds before the process is killed. */
  timeoutSeconds: number;
  /** Session ID for logging and correlation. */
  sessionId: string;
}

/** Normalized result returned after an agent run completes or fails. */
export interface ExecutionResult {
  /** Exit code from the CLI process. */
  exitCode: number;
  /** Combined stdout from the agent. */
  stdout: string;
  /** Combined stderr from the agent. */
  stderr: string;
  /** Whether the agent reported success. */
  success: boolean;
  /** Human-readable summary extracted from output. */
  resultSummary: string | null;
  /** Relative file paths the agent changed. */
  filesChanged: string[];
  /** Validation command output block from the agent's output. */
  validationOutput: string | null;
  /** Error message if the process failed or timed out. */
  errorMessage: string | null;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
}

/** Contract implemented by provider-specific execution adapters. */
export interface ExecutionAdapter {
  /** Identifier matching ExecutionSession.agentType. */
  readonly agentType: "claude_code" | "codex";
  /**
   * Run the brief in the given context and return a structured result.
   *
   * @param brief - Markdown implementation brief passed via stdin.
   * @param context - Repository path, permissions, and timeout settings.
   * @returns Parsed execution result with stdout/stderr capture.
   */
  run(brief: string, context: ExecutionContext): Promise<ExecutionResult>;
}
