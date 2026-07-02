import { describe, expect, it, vi } from "vitest";

import { getWorkerPermissions } from "@/lib/worker-permissions";
import {
  detectInstallCommand,
  ensureDependenciesInstalled,
  summarizeDependencyInstall,
} from "./dependency-installer";

/** Builds an existence probe from a set of repo-relative file names. */
function filesPresent(...names: string[]): (path: string) => boolean {
  return (path) => names.some((name) => path.endsWith(`/${name}`));
}

/** A spawn stub that records calls and returns scripted results in order. */
function scriptedSpawn(
  ...results: { exitCode: number; output?: string; timedOut?: boolean }[]
) {
  const calls: { command: string; cwd: string; timeoutMs: number }[] = [];
  let i = 0;
  const spawn = vi.fn(async (command: string, cwd: string, timeoutMs: number) => {
    calls.push({ command, cwd, timeoutMs });
    const result = results[Math.min(i, results.length - 1)];
    i += 1;
    return {
      exitCode: result.exitCode,
      output: result.output ?? "",
      timedOut: result.timedOut ?? false,
    };
  });
  return { spawn, calls };
}

const FULL = getWorkerPermissions("autonomous");

describe("detectInstallCommand", () => {
  it("prefers pnpm, then yarn, then npm ci, then plain npm install", () => {
    expect(
      detectInstallCommand("/r", filesPresent("pnpm-lock.yaml", "package-lock.json"))
        .command
    ).toBe("pnpm install --frozen-lockfile");
    expect(detectInstallCommand("/r", filesPresent("yarn.lock")).command).toBe(
      "yarn install --frozen-lockfile"
    );
    expect(
      detectInstallCommand("/r", filesPresent("package-lock.json")).command
    ).toBe("npm ci");
    expect(detectInstallCommand("/r", filesPresent()).command).toBe("npm install");
    expect(detectInstallCommand("/r", filesPresent()).fallback).toBeNull();
  });
});

describe("ensureDependenciesInstalled", () => {
  it("is a successful no-op for a repo without package.json (non-JS stack)", async () => {
    const { spawn } = scriptedSpawn({ exitCode: 0 });
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: FULL,
      spawn,
      fileExists: filesPresent(),
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("skips the install when node_modules already exists", async () => {
    const { spawn } = scriptedSpawn({ exitCode: 0 });
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: FULL,
      spawn,
      fileExists: filesPresent("package.json", "node_modules"),
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("installs with the lockfile-appropriate command", async () => {
    const { spawn, calls } = scriptedSpawn({ exitCode: 0, output: "done" });
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: FULL,
      spawn,
      fileExists: filesPresent("package.json", "pnpm-lock.yaml"),
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(true);
    expect(calls[0].command).toBe("pnpm install --frozen-lockfile");
    expect(summarizeDependencyInstall(result)).toContain("pnpm install --frozen-lockfile");
  });

  it("falls back to a plain install when the frozen-lockfile install fails", async () => {
    const { spawn, calls } = scriptedSpawn(
      { exitCode: 1, output: "lockfile mismatch" },
      { exitCode: 0 }
    );
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: FULL,
      spawn,
      fileExists: filesPresent("package.json", "pnpm-lock.yaml"),
    });

    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.command)).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm install",
    ]);
  });

  it("reports failure when both attempts fail", async () => {
    const { spawn } = scriptedSpawn({ exitCode: 1 }, { exitCode: 1 });
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: FULL,
      spawn,
      fileExists: filesPresent("package.json", "package-lock.json"),
    });

    expect(result.ok).toBe(false);
    expect(result.attempted).toBe(true);
    expect(result.summary).toMatch(/both failed/i);
  });

  it("reports a timeout without attempting the fallback", async () => {
    const { spawn, calls } = scriptedSpawn({ exitCode: 1, timedOut: true });
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: FULL,
      timeoutSeconds: 5,
      spawn,
      fileExists: filesPresent("package.json", "yarn.lock"),
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/timed out after 5s/);
    expect(calls).toHaveLength(1);
  });

  it("never executes when the permission profile denies the command", async () => {
    const { spawn } = scriptedSpawn({ exitCode: 0 });
    const result = await ensureDependenciesInstalled({
      repoPath: "/r",
      permissions: getWorkerPermissions("manual"),
      spawn,
      fileExists: filesPresent("package.json"),
    });

    expect(result.ok).toBe(false);
    expect(result.attempted).toBe(false);
    expect(result.summary).toMatch(/denied/i);
    expect(spawn).not.toHaveBeenCalled();
  });
});
