import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";

import type { PreviewSession } from "@/generated/prisma/client";
import { PREVIEW_CONFIG } from "@/worker/preview-config";
import { workerLogger } from "@/worker/worker-logger";
import {
  checkoutDefaultBranch,
  type CheckoutRepositoryInput,
  type DefaultBranchCheckoutResult,
} from "@/worker/repo-manager";
import { ensureDependenciesInstalled } from "@/worker/dependency-installer";
import { resolveDevCommand } from "@/lib/preview/preview-command-resolver";
import {
  buildFrameworkPortArgs,
  buildPreviewEnv,
  getFreePort,
} from "@/lib/preview/preview-port";
import { decryptEnvVars } from "@/lib/preview/preview-env";
import {
  finalizePreview,
  killProcessGroup,
  loadPreviewSession,
  loadRepositoryForPreview,
  markPreviewInstalling,
  markPreviewRunning,
  markPreviewStopping,
  occupiedPorts,
  setPreviewLogs,
  truncatePreviewLogs,
  type TerminalPreviewStatus,
} from "@/lib/preview/preview-service-db";

/**
 * The live-preview runner: clones a repo's default branch, installs deps, starts
 * its dev server as a long-lived detached child, streams logs, and tears it down.
 * All OS/DB collaborators are injectable so the control flow is unit-testable
 * without real processes or a database.
 */

/** A running preview's in-memory handle (the DB row is the durable mirror). */
export interface ActivePreview {
  readonly id: string;
  readonly child: ChildProcess;
  readonly port: number;
  readonly cleanup: () => Promise<void>;
  /** Returns the current truncated log tail. */
  getLogs(): string;
  /** Set once a stop has been requested (prevents double-signal). */
  stopping: boolean;
  /** Set once the child has exited and been finalized (prevents double-finalize). */
  finalized: boolean;
  /** How to finalize on exit: a requested stop vs. an unexpected crash. */
  stopReason: { terminalStatus: TerminalPreviewStatus; reason: string | null } | null;
}

export type PreviewRegistry = Map<string, ActivePreview>;

/** Injectable collaborators (defaults are the real implementations). */
export interface StartPreviewDeps {
  loadRepo: typeof loadRepositoryForPreview;
  checkout: typeof checkoutDefaultBranch;
  resolve: typeof resolveDevCommand;
  install: typeof ensureDependenciesInstalled;
  getOccupiedPorts: typeof occupiedPorts;
  allocatePort: typeof getFreePort;
  spawn: typeof spawnDevServer;
}

const defaultDeps: StartPreviewDeps = {
  loadRepo: loadRepositoryForPreview,
  checkout: checkoutDefaultBranch,
  resolve: resolveDevCommand,
  install: ensureDependenciesInstalled,
  getOccupiedPorts: occupiedPorts,
  allocatePort: getFreePort,
  spawn: spawnDevServer,
};

/**
 * Spawns the dev server as a detached child so it becomes a process-group
 * leader — the real server (a grandchild of `pnpm run dev`) can then be killed
 * as a group. stdout/stderr are piped for streaming; stdin is ignored.
 */
export function spawnDevServer(
  command: string,
  opts: { cwd: string; env: NodeJS.ProcessEnv }
): ChildProcess {
  return nodeSpawn("/bin/sh", ["-c", command], {
    cwd: opts.cwd,
    env: opts.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Finalizes a preview when its child exits (the single finalize path). */
async function finalizeOnExit(
  active: ActivePreview & { buffer: string },
  registry: PreviewRegistry,
  code: number | null,
  signal: NodeJS.Signals | null
): Promise<void> {
  if (active.finalized) return;
  active.finalized = true;

  const status: TerminalPreviewStatus = active.stopReason
    ? active.stopReason.terminalStatus
    : "crashed";
  const errorMessage =
    active.stopReason?.reason ??
    (status === "crashed"
      ? `Dev server exited unexpectedly (code ${code ?? "null"}${
          signal ? `, signal ${signal}` : ""
        }). Check the logs — the app may need env vars or a database to run.`
      : null);

  await finalizePreview(active.id, status, {
    errorMessage,
    logs: active.getLogs(),
  }).catch((err) => logSwallow("finalize", err));
  await active.cleanup().catch((err) => logSwallow("cleanup", err));
  registry.delete(active.id);
  workerLogger.info(`Preview ${active.id} finalized as "${status}".`);
}

function logSwallow(op: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  workerLogger.warn(`Preview ${op} failed: ${message}`);
}

/**
 * Runs a claimed preview session end-to-end: checkout → install → resolve dev
 * command → allocate port → spawn dev server → mark running (registered in
 * `registry`). Any failure before the child is registered finalizes the row and
 * cleans up the checkout. Never throws.
 */
export async function startPreview(input: {
  session: PreviewSession;
  registry: PreviewRegistry;
  deps?: Partial<StartPreviewDeps>;
}): Promise<void> {
  const { session, registry } = input;
  const deps = { ...defaultDeps, ...input.deps };
  const host = PREVIEW_CONFIG.PREVIEW_HOST;

  const repoInfo = await deps.loadRepo(session.repositoryId, session.companyId);
  if (!repoInfo) {
    await finalizePreview(session.id, "failed", {
      errorMessage: "Repository not found or has no URL.",
    });
    return;
  }

  // 1) Clone the default branch.
  let checkout: DefaultBranchCheckoutResult;
  try {
    const repo: CheckoutRepositoryInput = {
      url: repoInfo.url,
      credentials: repoInfo.credentials,
    };
    checkout = await deps.checkout(repo, PREVIEW_CONFIG.PREVIEW_BASE_DIR, session.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clone failed.";
    await finalizePreview(session.id, "failed", {
      errorMessage: `Failed to clone repository: ${message}`,
    });
    return;
  }

  try {
    // 2) Resolve the dev command from the checkout's package.json.
    const resolved = deps.resolve({ repoPath: checkout.path });
    if (!resolved.ok) {
      await finalizePreview(session.id, "failed", { errorMessage: resolved.error });
      await checkout.cleanup();
      return;
    }

    await markPreviewInstalling(session.id, {
      branch: checkout.branch,
      packageManager: resolved.packageManager,
    });

    // 3) Install dependencies.
    const install = await deps.install({
      repoPath: checkout.path,
      timeoutSeconds: PREVIEW_CONFIG.PREVIEW_INSTALL_TIMEOUT_SECONDS,
    });
    const preLog = [
      `$ (branch: ${checkout.branch})`,
      install.summary,
      install.output,
    ]
      .filter(Boolean)
      .join("\n");

    if (!install.ok) {
      await finalizePreview(session.id, "failed", {
        errorMessage: install.summary,
        logs: preLog,
      });
      await checkout.cleanup();
      return;
    }

    // 4) Re-check intent: a Stop during the (slow) install aborts before spawn.
    const fresh = await loadPreviewSession(session.id);
    if (!fresh || fresh.desiredState === "stopped") {
      await finalizePreview(session.id, "stopped", {
        errorMessage: "Stopped before the dev server started.",
        logs: preLog,
      });
      await checkout.cleanup();
      return;
    }

    // 5) Allocate a port and build the run command + environment.
    const occupied = await deps.getOccupiedPorts();
    const port = await deps.allocatePort({
      host,
      rangeStart: PREVIEW_CONFIG.PREVIEW_PORT_RANGE_START,
      rangeEnd: PREVIEW_CONFIG.PREVIEW_PORT_RANGE_END,
      occupied,
    });
    const command =
      resolved.command + buildFrameworkPortArgs(resolved.framework, port, host);
    const env = buildPreviewEnv({
      base: process.env,
      port,
      host,
      userEnv: decryptEnvVars(session.envVars),
    });

    // 6) Spawn the dev server and register it.
    const child = deps.spawn(command, { cwd: checkout.path, env });
    const previewUrl = `http://${host}:${port}`;

    const active = {
      id: session.id,
      child,
      port,
      cleanup: checkout.cleanup,
      buffer: `${preLog}\n\n$ ${command}\n`,
      stopping: false,
      finalized: false,
      stopReason: null as ActivePreview["stopReason"],
      getLogs(): string {
        return truncatePreviewLogs(this.buffer, PREVIEW_CONFIG.PREVIEW_LOG_MAX_CHARS);
      },
    };

    const append = (chunk: Buffer) => {
      active.buffer += chunk.toString();
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.once("exit", (code, signal) => {
      void finalizeOnExit(active, registry, code, signal as NodeJS.Signals | null);
    });
    child.once("error", (err) => {
      active.buffer += `\n[spawn error] ${String(err)}`;
      void finalizeOnExit(active, registry, 1, null);
    });

    registry.set(session.id, active);

    await markPreviewRunning(session.id, {
      pid: child.pid ?? 0,
      port,
      previewUrl,
      command,
    });
    workerLogger.info(`Preview ${session.id} running at ${previewUrl} (pid ${child.pid}).`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizePreview(session.id, "failed", {
      errorMessage: `Preview failed to start: ${message}`,
    }).catch(() => {});
    await checkout.cleanup().catch(() => {});
    registry.delete(session.id);
  }
}

/**
 * Requests a stop: marks the row `stopping`, SIGTERMs the process group, and
 * schedules a SIGKILL after the grace period. The child's `exit` handler is the
 * single place that finalizes the row (as the requested terminal status).
 */
export async function stopPreview(
  active: ActivePreview,
  opts: { reason: string | null; terminalStatus: TerminalPreviewStatus }
): Promise<void> {
  if (active.stopping || active.finalized) return;
  active.stopping = true;
  active.stopReason = { terminalStatus: opts.terminalStatus, reason: opts.reason };

  await markPreviewStopping(active.id).catch((err) => logSwallow("mark stopping", err));

  const pid = active.child.pid;
  if (!pid) return;

  killProcessGroup(pid, "SIGTERM");
  setTimeout(() => {
    if (!active.finalized && active.child.exitCode === null) {
      killProcessGroup(pid, "SIGKILL");
    }
  }, PREVIEW_CONFIG.PREVIEW_STOP_GRACE_MS);
}

/**
 * Per-tick reconciliation of live previews: honor Stop intent, enforce the max
 * lifetime, and flush buffered logs + heartbeat to the DB.
 */
export async function reconcileActivePreviews(
  registry: PreviewRegistry
): Promise<void> {
  const now = Date.now();
  for (const active of [...registry.values()]) {
    if (active.finalized || active.stopping) continue;

    const row = await loadPreviewSession(active.id);
    if (!row || row.desiredState === "stopped") {
      await stopPreview(active, {
        reason: row ? "Stopped by request." : "Preview record removed.",
        terminalStatus: "stopped",
      });
      continue;
    }
    if (row.expiresAt && row.expiresAt.getTime() <= now) {
      await stopPreview(active, {
        reason: "Maximum preview lifetime reached; auto-stopped.",
        terminalStatus: "stopped",
      });
      continue;
    }

    await setPreviewLogs(active.id, active.getLogs()).catch((err) =>
      logSwallow("log flush", err)
    );
  }
}

/**
 * Force-stops every live preview on shutdown: SIGKILL the group, mark the row
 * `stopped`, and remove the checkout. Best-effort and synchronous-ish so the
 * process can exit promptly.
 */
export async function shutdownAllPreviews(registry: PreviewRegistry): Promise<void> {
  for (const active of [...registry.values()]) {
    active.stopping = true;
    active.stopReason = {
      terminalStatus: "stopped",
      reason: "Preview service shutting down.",
    };
    if (active.child.pid) killProcessGroup(active.child.pid, "SIGKILL");
    if (!active.finalized) {
      active.finalized = true;
      await finalizePreview(active.id, "stopped", {
        errorMessage: "Preview service shutting down.",
        logs: active.getLogs(),
      }).catch((err) => logSwallow("shutdown finalize", err));
      await active.cleanup().catch((err) => logSwallow("shutdown cleanup", err));
    }
    registry.delete(active.id);
  }
}
