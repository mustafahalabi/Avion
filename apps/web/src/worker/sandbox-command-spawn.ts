/**
 * Sandbox-aware command executor for the worker's host-shell surfaces (Goal 1).
 *
 * The agent CLI is not the only place the worker runs shell inside a checkout:
 * `ensureDependenciesInstalled` and `runValidationCommands` also spawn
 * `/bin/sh -c <command>` in the checkout via the shared {@link CommandSpawn}
 * seam. To make "the session cannot touch the host" true end-to-end, those two
 * surfaces route through the same {@link SandboxRunner} the adapter uses.
 *
 * With the `none` runner this is byte-identical to the modules' own
 * `defaultSpawn` (`/bin/sh -c` in cwd), so worker behavior is unchanged. With
 * the `docker` runner the command runs inside a container that bind-mounts only
 * the checkout — `node_modules` written by an install container persists to the
 * host checkout and is therefore visible to the next validation container.
 */

import { spawn as nodeSpawn } from "node:child_process";

import type { SandboxRunner } from "@/lib/adapters/sandbox-runner";
import type { CommandSpawn } from "@/lib/validation-runner";

/**
 * Generic capture spawn: runs `command args…`, accumulates combined
 * stdout+stderr, and enforces a hard SIGTERM timeout. Parameterized on the
 * binary+argv (unlike the modules' hardcoded `/bin/sh -c`) so a sandbox wrapper
 * can substitute a `docker run …` invocation.
 *
 * @param command - Binary to spawn.
 * @param args - Arguments.
 * @param cwd - Working directory (undefined → inherit, used by docker runs).
 * @param timeoutMs - Wall-clock bound before the process is killed.
 * @returns Exit code, combined output, and whether the timeout fired.
 */
export function spawnCaptured(
  command: string,
  args: string[],
  cwd: string | undefined,
  timeoutMs: number
): Promise<{ exitCode: number; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve({ exitCode, output, timedOut });
    };

    const child = nodeSpawn(command, args, {
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
}

/**
 * Builds a {@link CommandSpawn} that runs each command through the given
 * sandbox runner.
 *
 * The command is wrapped as `/bin/sh -c <command>` in the checkout, then handed
 * to the runner: `none` → runs it directly on the host; `docker` → runs it
 * inside an isolated container mounting only the checkout.
 *
 * @param sandbox - The resolved sandbox runner.
 * @returns A `CommandSpawn` suitable for `runValidationCommands` /
 *   `ensureDependenciesInstalled`.
 */
export function createSandboxedCommandSpawn(sandbox: SandboxRunner): CommandSpawn {
  return (command, cwd, timeoutMs) => {
    const invocation = sandbox.wrap({
      command: "/bin/sh",
      args: ["-c", command],
      repositoryPath: cwd,
    });
    return spawnCaptured(invocation.command, invocation.args, invocation.cwd, timeoutMs);
  };
}
