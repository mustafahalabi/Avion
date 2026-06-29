/**
 * Validation Command Runner
 *
 * Runs a repository's detected validation commands (type checking, linting,
 * tests, build — see `check-command-profile.ts`) inside a checked-out repo
 * after an agent has finished implementing a task, and maps the real outcomes
 * into the QA `checks` shape that `qa-service.ts` understands.
 *
 * Two layers of safety apply to every command:
 *  1. `validateCommand` from `worker-permissions.ts` guards each command before
 *     it is ever spawned. A command that the guardrail denies is *skipped* (not
 *     executed and not counted as a failure) — the guardrail is conservative by
 *     design and would otherwise turn legitimate stack-specific tooling (e.g.
 *     `pytest`) into spurious failures.
 *  2. Execution itself is injectable (`spawn`) so this module can be unit-tested
 *     without touching the filesystem or spawning real processes — mirroring the
 *     `fetchImpl` / `spawn` injection pattern used by `github-pull-request.ts`
 *     and `claude-code-adapter.ts`.
 */

import { spawn as nodeSpawn } from "node:child_process";

import type { CheckCommand } from "./check-command-profile";
import {
  getWorkerPermissions,
  validateCommand,
  type WorkerPermissions,
} from "./worker-permissions";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of characters of combined stdout+stderr retained per command. */
const MAX_OUTPUT_CHARS = 4000;

/** Fallback per-command timeout used when a CheckCommand omits `timeoutSeconds`. */
const DEFAULT_TIMEOUT_SECONDS = 120;

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Outcome of a single validation command.
 *
 * A `skipped` result was never executed (the guardrail denied it). Skipped
 * results are deliberately treated as *neither* pass nor fail when computing
 * {@link RunValidationResult.allPassed}.
 */
export interface ValidationCommandResult {
  /** Stable identifier for this result — the originating `CheckCommand.id`. */
  id: string;
  /** The kind of check, mirroring the originating `CheckCommand.id` (e.g. `tsc`, `lint`, `test`). */
  kind: string;
  /** The shell command that was run (or would have been run, when skipped). */
  command: string;
  /** True when the command executed and succeeded (exit 0, no timeout). False when it failed or was skipped. */
  passed: boolean;
  /** Process exit code. `0` when not yet run / skipped. */
  exitCode: number;
  /** Combined stdout+stderr, truncated to a bounded length. Empty when skipped. */
  output: string;
  /** True when the guardrail denied the command and it was not executed. */
  skipped: boolean;
  /** Human-readable reason the command was skipped (only set when `skipped` is true). */
  skipReason?: string;
}

/**
 * Aggregate result of running a repository's validation commands.
 */
export interface RunValidationResult {
  /** One entry per input command, in input order. */
  results: ValidationCommandResult[];
  /**
   * True only when at least one command actually ran *and* every command that
   * ran passed. Skipped commands are excluded from this calculation, so a run
   * in which every command was skipped reports `allPassed: false`.
   */
  allPassed: boolean;
}

/**
 * Injectable command executor.
 *
 * @param command - The shell command to execute.
 * @param cwd - Working directory (the checked-out repository path).
 * @param timeoutMs - Maximum wall-clock time before the process is killed.
 * @returns Exit code, combined output, and whether the timeout fired.
 */
export type CommandSpawn = (
  command: string,
  cwd: string,
  timeoutMs: number
) => Promise<{ exitCode: number; output: string; timedOut: boolean }>;

/**
 * QA check entry — the exact value-shape stored in `QAResult.checks` (a JSON
 * array of these objects) that `qa-service.ts` `requiredChecksPassed` and
 * `recordQaResult` consume. Mirrors qa-service's internal `StoredCheck`.
 */
export interface QaCheck {
  /** Human-readable label for the check — also used as a ChangeRequest reason on failure. */
  label: string;
  /** Whether the check passed. `requiredChecksPassed` requires every entry to be true. */
  passed: boolean;
  /** Coarse category grouping; always `"validation"` for runner-derived checks. */
  category?: string;
  /** Whether a failed check is actionable (failed validation checks are actionable). */
  actionable?: boolean;
}

// ─── Default Spawn Implementation ───────────────────────────────────────────

/**
 * Default {@link CommandSpawn} backed by `node:child_process`.
 *
 * Spawns `/bin/sh -c "<command>"` in `cwd`, captures combined stdout+stderr,
 * and enforces a hard timeout via `SIGTERM` — mirroring the spawn + timeout
 * pattern in `claude-code-adapter.ts`.
 */
const defaultSpawn: CommandSpawn = (command, cwd, timeoutMs) =>
  new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      resolve({ exitCode, output, timedOut });
    };

    const child = nodeSpawn("/bin/sh", ["-c", command], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("close", (code) => finish(code ?? 1));
    child.on("error", (err) => {
      output += String(err);
      finish(1);
    });
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Truncates output to {@link MAX_OUTPUT_CHARS}, appending a marker when cut.
 */
function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n…[truncated]`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Runs a repository's validation commands sequentially, guarding each command
 * with the worker permission model before execution.
 *
 * Each command is first checked with `validateCommand`. When the guardrail
 * denies it, the command is recorded as `skipped` (never executed, not counted
 * as a failure). Otherwise it is run via the injected `spawn` (defaulting to a
 * real `/bin/sh -c` child process) with a per-command timeout derived from the
 * `CheckCommand.timeoutSeconds`. A command `passed` only when it exits `0`
 * without timing out.
 *
 * @param input.repoPath - The checked-out repository path to run commands in.
 * @param input.commands - The validation commands to run (already ordered).
 * @param input.timeoutSeconds - Optional fallback timeout for commands lacking one.
 * @param input.permissions - Optional permission profile to guard commands with;
 *   defaults to the `autonomous` (full) profile, which is the level at which
 *   unattended validation runs occur.
 * @param input.spawn - Optional injected executor (for tests); defaults to a real spawn.
 * @returns Per-command results and an aggregate `allPassed` flag.
 *
 * @example
 * ```ts
 * const { results, allPassed } = await runValidationCommands({
 *   repoPath: "/tmp/checkout",
 *   commands: getCommandsForRepo({ frameworks: ["nextjs"] }),
 * });
 * if (!allPassed) { /* keep task in QA *\/ }
 * ```
 */
export async function runValidationCommands(input: {
  repoPath: string;
  commands: readonly CheckCommand[];
  timeoutSeconds?: number;
  permissions?: WorkerPermissions;
  spawn?: CommandSpawn;
}): Promise<RunValidationResult> {
  const {
    repoPath,
    commands,
    timeoutSeconds,
    permissions = getWorkerPermissions("autonomous"),
    spawn = defaultSpawn,
  } = input;

  const results: ValidationCommandResult[] = [];

  for (const command of commands) {
    const guard = validateCommand(command.command, permissions);

    if (!guard.allowed) {
      results.push({
        id: command.id,
        kind: command.id,
        command: command.command,
        passed: false,
        exitCode: 0,
        output: "",
        skipped: true,
        skipReason: guard.reason,
      });
      continue;
    }

    const perCommandSeconds =
      command.timeoutSeconds ?? timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    const { exitCode, output, timedOut } = await spawn(
      command.command,
      repoPath,
      perCommandSeconds * 1000
    );

    const truncated = truncateOutput(output);
    results.push({
      id: command.id,
      kind: command.id,
      command: command.command,
      passed: exitCode === 0 && !timedOut,
      exitCode,
      output: timedOut
        ? `${truncated}\n…[timed out after ${perCommandSeconds}s]`
        : truncated,
      skipped: false,
    });
  }

  const ran = results.filter((r) => !r.skipped);
  const allPassed = ran.length > 0 && ran.every((r) => r.passed);

  return { results, allPassed };
}

/**
 * Maps validation command results into the QA `checks` value-shape consumed by
 * `qa-service.ts`.
 *
 * Only commands that actually ran (non-skipped) are mapped, so that the QA
 * checklist reflects real command outcomes — a check is `passed` exactly when
 * its command succeeded. Failed checks are marked `actionable` so that
 * `recordQaResult` can raise ChangeRequests for them.
 *
 * The returned array is the *unstringified* value; callers persist it via
 * `JSON.stringify(...)` into `QAResult.checks`.
 *
 * @param results - Results from {@link runValidationCommands}.
 * @returns QA check entries, one per non-skipped result.
 *
 * @example
 * ```ts
 * const checks = qaChecksFromValidation(results);
 * await prisma.qAResult.update({ where: { id }, data: { checks: JSON.stringify(checks) } });
 * ```
 */
export function qaChecksFromValidation(
  results: readonly ValidationCommandResult[]
): QaCheck[] {
  return results
    .filter((r) => !r.skipped)
    .map((r) => ({
      label: `${r.kind}: ${r.command}`,
      passed: r.passed,
      category: "validation",
      actionable: !r.passed,
    }));
}
