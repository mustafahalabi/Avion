/**
 * Provider-independent execution adapter contract.
 *
 * Defines shared types for invoking AI agent CLIs (Claude Code, Codex, etc.)
 * with a structured brief and collecting normalized execution results.
 */

import type { AgentStreamHandler } from "@/lib/agent-stream/types";
import type { AgentUsage } from "./agent-usage";

/** Capability tier controlling how much autonomy the agent has during execution. */
export type PermissionLevel = "read_only" | "suggest" | "execute" | "full";

/**
 * Agent types with a runnable execution adapter. Matches the
 * `ExecutionSession.agentType` values the worker can execute — "human"
 * sessions have no adapter by design.
 */
export const EXECUTION_ADAPTER_AGENT_TYPES = ["claude_code", "codex"] as const;

/** Identifier of a runnable execution adapter. */
export type ExecutionAdapterAgentType =
  (typeof EXECUTION_ADAPTER_AGENT_TYPES)[number];

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
  /**
   * Optional live-output sink. When provided, the adapter emits a lifecycle
   * "status" event at start/finish and one event per observed stdout/stderr
   * line as the agent runs, so the worker can persist a live stream. The
   * handler must never throw; adapters treat streaming as best-effort and it
   * never affects the returned result. Omit for a silent (buffered-only) run.
   */
  onStream?: AgentStreamHandler;
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
  /**
   * Real token/cost usage the agent CLI reported for this run (Goal 3), or null
   * when the provider/output-format didn't surface it. Never estimated.
   */
  usage?: AgentUsage | null;
}

/** Contract implemented by provider-specific execution adapters. */
export interface ExecutionAdapter {
  /** Identifier matching ExecutionSession.agentType. */
  readonly agentType: ExecutionAdapterAgentType;
  /**
   * Run the brief in the given context and return a structured result.
   *
   * @param brief - Markdown implementation brief passed via stdin.
   * @param context - Repository path, permissions, and timeout settings.
   * @returns Parsed execution result with stdout/stderr capture.
   */
  run(brief: string, context: ExecutionContext): Promise<ExecutionResult>;
}
