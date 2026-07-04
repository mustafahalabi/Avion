/**
 * Dependency installer for worker checkouts.
 *
 * Fresh clones have no `node_modules`, which previously meant the repository's
 * real validation commands (tsc / lint / test / build) were skipped on
 * virtually every run — leaving the QA gate with no real evidence. This module
 * installs JS dependencies in the checkout (bounded, guarded by the worker
 * permission model, injectable spawn for tests) so validation can actually run.
 *
 * Non-JS repositories (no `package.json`) are a successful no-op: their
 * validation commands do not need `node_modules`.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getWorkerPermissions,
  validateCommand,
  type WorkerPermissions,
} from "@/lib/worker-permissions";
import type { CommandSpawn } from "@/lib/validation-runner";
import { spawn as nodeSpawn } from "node:child_process";

/** Default wall-clock bound for a dependency install. */
const DEFAULT_INSTALL_TIMEOUT_SECONDS = 600;

/** Outcome of {@link ensureDependenciesInstalled}. */
export interface DependencyInstallResult {
  /** True when an install command was actually executed. */
  readonly attempted: boolean;
  /** True when dependencies are usable (installed now, already present, or not needed). */
  readonly ok: boolean;
  /** The command that ran (or was denied), when one was chosen. */
  readonly command: string | null;
  /** Human-readable outcome for the session's validation output. */
  readonly summary: string;
  /** Combined output of the install command, truncated. Empty when not run. */
  readonly output: string;
}

/** Maximum characters of install output retained. */
const MAX_INSTALL_OUTPUT_CHARS = 2000;

/**
 * Picks the install command for a checkout from its lockfile.
 *
 * @param repoPath - Checked-out repository path.
 * @param fileExists - Existence probe (injectable for tests).
 * @returns The exact install command, and a lockfile-free fallback used when
 *   the strict (frozen-lockfile) variant fails.
 */
export function detectInstallCommand(
  repoPath: string,
  fileExists: (path: string) => boolean = existsSync
): { command: string; fallback: string | null } {
  if (fileExists(join(repoPath, "pnpm-lock.yaml"))) {
    return { command: "pnpm install --frozen-lockfile", fallback: "pnpm install" };
  }
  if (fileExists(join(repoPath, "yarn.lock"))) {
    return { command: "yarn install --frozen-lockfile", fallback: "yarn install" };
  }
  if (fileExists(join(repoPath, "package-lock.json"))) {
    return { command: "npm ci", fallback: "npm install" };
  }
  return { command: "npm install", fallback: null };
}

/** Default spawn mirroring validation-runner's `/bin/sh -c` executor. */
const defaultSpawn: CommandSpawn = (command, cwd, timeoutMs) =>
  new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    let settled = false;

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
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve({ exitCode, output, timedOut });
    };
    child.on("close", (code) => finish(code ?? 1));
    child.on("error", (err) => {
      output += String(err);
      finish(1);
    });
  });

/**
 * Ensures the checkout's JS dependencies are installed so validation commands
 * can run.
 *
 * Behavior:
 * - No `package.json` → ok, nothing to install (non-JS repo).
 * - `node_modules` already present → ok, nothing to do.
 * - Otherwise the lockfile-appropriate install runs (guarded by
 *   `validateCommand`); when a strict frozen-lockfile install fails, one
 *   fallback attempt without the frozen flag is made.
 *
 * @param input.repoPath - Checked-out repository path.
 * @param input.permissions - Worker permission profile guarding the command.
 * @param input.timeoutSeconds - Wall-clock bound per install attempt.
 * @param input.spawn - Injected executor (for tests).
 * @param input.fileExists - Injected existence probe (for tests).
 * @returns The install outcome; `ok` gates whether validation should run.
 */
export async function ensureDependenciesInstalled(input: {
  repoPath: string;
  permissions?: WorkerPermissions;
  timeoutSeconds?: number;
  spawn?: CommandSpawn;
  fileExists?: (path: string) => boolean;
}): Promise<DependencyInstallResult> {
  const {
    repoPath,
    permissions = getWorkerPermissions("autonomous"),
    timeoutSeconds = DEFAULT_INSTALL_TIMEOUT_SECONDS,
    spawn = defaultSpawn,
    fileExists = existsSync,
  } = input;

  if (!fileExists(join(repoPath, "package.json"))) {
    return {
      attempted: false,
      ok: true,
      command: null,
      summary: "No package.json — dependency install not needed.",
      output: "",
    };
  }

  if (fileExists(join(repoPath, "node_modules"))) {
    return {
      attempted: false,
      ok: true,
      command: null,
      summary: "node_modules already present — install skipped.",
      output: "",
    };
  }

  const detected = detectInstallCommand(repoPath, fileExists);

  const guard = validateCommand(detected.command, permissions);
  if (!guard.allowed) {
    return {
      attempted: false,
      ok: false,
      command: detected.command,
      summary: `Install denied by worker permissions: ${guard.reason}`,
      output: "",
    };
  }

  const timeoutMs = timeoutSeconds * 1000;
  const first = await spawn(detected.command, repoPath, timeoutMs);
  if (first.exitCode === 0 && !first.timedOut) {
    return {
      attempted: true,
      ok: true,
      command: detected.command,
      summary: `Installed dependencies with \`${detected.command}\`.`,
      output: truncate(first.output),
    };
  }

  if (detected.fallback && !first.timedOut) {
    const fallbackGuard = validateCommand(detected.fallback, permissions);
    if (fallbackGuard.allowed) {
      const second = await spawn(detected.fallback, repoPath, timeoutMs);
      if (second.exitCode === 0 && !second.timedOut) {
        return {
          attempted: true,
          ok: true,
          command: detected.fallback,
          summary: `Installed dependencies with \`${detected.fallback}\` (after \`${detected.command}\` failed).`,
          output: truncate(second.output),
        };
      }
      return {
        attempted: true,
        ok: false,
        command: detected.fallback,
        summary: `Dependency install failed: \`${detected.command}\` and \`${detected.fallback}\` both failed.`,
        output: truncate(second.output),
      };
    }
  }

  return {
    attempted: true,
    ok: false,
    command: detected.command,
    summary: first.timedOut
      ? `Dependency install timed out after ${timeoutSeconds}s (\`${detected.command}\`).`
      : `Dependency install failed (\`${detected.command}\`, exit ${first.exitCode}).`,
    output: truncate(first.output),
  };
}

/** Truncates install output to a bounded length. */
function truncate(output: string): string {
  if (output.length <= MAX_INSTALL_OUTPUT_CHARS) return output;
  return `${output.slice(-MAX_INSTALL_OUTPUT_CHARS)}\n…[truncated to last ${MAX_INSTALL_OUTPUT_CHARS} chars]`;
}

/**
 * Renders an install result as a markdown block for the session's validation
 * output / PR body.
 *
 * @param result - The install outcome.
 * @returns Markdown summary block.
 */
export function summarizeDependencyInstall(
  result: DependencyInstallResult
): string {
  return `## Dependency install\n${result.summary}`;
}
