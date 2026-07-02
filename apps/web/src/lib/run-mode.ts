// ─── Types ────────────────────────────────────────────────────────────────────

export type RunMode = "interactive" | "background" | "supervised";
export type ExecutionAdapter = "claude_code" | "codex" | "human";

export interface RunModeConfig {
  mode: RunMode;
  adapter: ExecutionAdapter;
  maxConcurrentSessions: number;
  autoStartOnApproval: boolean;
  requireConfirmationBeforeRun: boolean;
  sessionTimeoutMinutes: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_RUN_MODE_CONFIG: RunModeConfig = {
  mode: "interactive",
  adapter: "claude_code",
  maxConcurrentSessions: 1,
  autoStartOnApproval: false,
  requireConfirmationBeforeRun: true,
  sessionTimeoutMinutes: 60,
};

// ─── Derived config from autonomy level ───────────────────────────────────────

/**
 * Returns a sensible RunModeConfig based on the company's autonomy level.
 * Used as the suggested default when no stored config exists.
 */
export function getRunModeConfig(autonomyLevel: string): RunModeConfig {
  switch (autonomyLevel) {
    case "manual":
      return {
        mode: "interactive",
        adapter: "human",
        maxConcurrentSessions: 1,
        autoStartOnApproval: false,
        requireConfirmationBeforeRun: true,
        sessionTimeoutMinutes: 120,
      };
    case "assist":
      return {
        mode: "interactive",
        adapter: "claude_code",
        maxConcurrentSessions: 1,
        autoStartOnApproval: false,
        requireConfirmationBeforeRun: true,
        sessionTimeoutMinutes: 60,
      };
    case "delegate":
      return {
        mode: "supervised",
        adapter: "claude_code",
        maxConcurrentSessions: 2,
        autoStartOnApproval: true,
        requireConfirmationBeforeRun: false,
        sessionTimeoutMinutes: 60,
      };
    case "autonomous":
      return {
        mode: "background",
        adapter: "claude_code",
        maxConcurrentSessions: 3,
        autoStartOnApproval: true,
        requireConfirmationBeforeRun: false,
        sessionTimeoutMinutes: 30,
      };
    default:
      return { ...DEFAULT_RUN_MODE_CONFIG };
  }
}

// ─── Descriptions ─────────────────────────────────────────────────────────────

const ADAPTER_LABELS: Record<ExecutionAdapter, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  human: "Human",
};

const MODE_DESCRIPTIONS: Record<RunMode, string> = {
  interactive:
    "runs tasks in the foreground so you can watch and intervene",
  background:
    "runs tasks silently in the background without interruption",
  supervised:
    "runs tasks in the background with checkpoints for your review",
};

/**
 * Returns a human-readable description of a RunModeConfig.
 *
 * Example:
 *   "Claude Code runs tasks in the foreground so you can watch and intervene
 *    (requires confirmation before running, up to 1 concurrent session, 60min timeout)"
 */
export function describeRunMode(config: RunModeConfig): string {
  const adapter = ADAPTER_LABELS[config.adapter];
  const modeDesc = MODE_DESCRIPTIONS[config.mode];

  const extras: string[] = [];
  if (config.autoStartOnApproval) extras.push("auto-starts on approval");
  if (config.requireConfirmationBeforeRun)
    extras.push("requires confirmation before running");
  extras.push(
    `up to ${config.maxConcurrentSessions} concurrent session${
      config.maxConcurrentSessions !== 1 ? "s" : ""
    }`
  );
  extras.push(`${config.sessionTimeoutMinutes}min timeout`);

  return `${adapter} ${modeDesc} (${extras.join(", ")})`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the config is set up for fully automatic task execution:
 * auto-start is enabled AND no manual confirmation gate is in place.
 */
export function isAutoRunEnabled(config: RunModeConfig): boolean {
  return config.autoStartOnApproval && !config.requireConfirmationBeforeRun;
}
