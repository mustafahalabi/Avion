import {
  EXECUTION_ADAPTER_AGENT_TYPES,
  type ExecutionAdapter,
  type ExecutionAdapterAgentType,
} from "./execution-adapter";
import { ClaudeCodeAdapter } from "./claude-code-adapter";
import { CodexAdapter } from "./codex-adapter";
import type { SandboxRunner } from "./sandbox-runner";

/** Options forwarded to the constructed adapter. */
export interface ResolveAdapterOptions {
  /**
   * Host-isolation sandbox to inject into the adapter (Goal 1). Omit to let the
   * adapter resolve one from the environment itself.
   */
  sandbox?: SandboxRunner;
}

/**
 * Registry mapping `ExecutionSession.agentType` values to execution adapters.
 *
 * The worker resolves the adapter for each claimed session from here instead
 * of hardcoding one provider — this is what makes provider independence real.
 * Unknown agent types (including "human", which has no CLI by design) fail
 * with an explicit error so the session is ingested as failed, never crashing
 * the worker or silently running the wrong agent.
 */

const ADAPTER_FACTORIES: Record<
  ExecutionAdapterAgentType,
  (options?: ResolveAdapterOptions) => ExecutionAdapter
> = {
  claude_code: (options) => new ClaudeCodeAdapter({ sandbox: options?.sandbox }),
  codex: (options) => new CodexAdapter({ sandbox: options?.sandbox }),
};

/**
 * Returns true when the agent type has a registered execution adapter.
 *
 * @param agentType - Raw `ExecutionSession.agentType` value.
 * @returns Whether the worker can execute sessions of this type.
 */
export function isRunnableAgentType(
  agentType: string
): agentType is ExecutionAdapterAgentType {
  return (EXECUTION_ADAPTER_AGENT_TYPES as readonly string[]).includes(agentType);
}

/**
 * Resolves a fresh execution adapter for a session's agent type.
 *
 * @param agentType - Raw `ExecutionSession.agentType` value.
 * @param options - Optional adapter options (e.g. a host-isolation sandbox).
 * @returns The adapter instance for the agent type.
 * @throws Error with an explicit message when no adapter is registered.
 */
export function resolveExecutionAdapter(
  agentType: string,
  options?: ResolveAdapterOptions
): ExecutionAdapter {
  if (!isRunnableAgentType(agentType)) {
    throw new Error(
      `No execution adapter registered for agent type "${agentType}". ` +
        `Supported agent types: ${EXECUTION_ADAPTER_AGENT_TYPES.join(", ")}.`
    );
  }
  return ADAPTER_FACTORIES[agentType](options);
}
