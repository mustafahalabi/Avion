import type { PreviewSession } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getProviderConnection } from "@/lib/provider-connection-service";

/**
 * Database layer for the live-preview service — the durable mirror of what the
 * out-of-process service is doing, and the claim/reconcile primitives that make
 * web → service intent flow through Postgres (mirrors `session-claimer.ts`).
 */

/** Statuses that mean a service process should currently own a live child. */
export const ACTIVE_PREVIEW_STATUSES = [
  "starting",
  "installing",
  "running",
  "stopping",
] as const;

export type TerminalPreviewStatus = "stopped" | "failed" | "crashed";

/** Truncates preview logs to the last `maxChars`, keeping the useful tail. */
export function truncatePreviewLogs(logs: string, maxChars: number): string {
  if (logs.length <= maxChars) return logs;
  return `…[truncated to last ${maxChars} chars]\n${logs.slice(-maxChars)}`;
}

/**
 * Best-effort kill of a detached child's whole process group. A dev server run
 * via `pnpm run dev` forks the real server as a grandchild, so we must signal
 * the group (negative pid), not just the shell. Never throws (ESRCH = gone).
 */
export function killProcessGroup(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    // Group may not exist (already exited) or not be a group leader.
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Atomically claims the oldest `queued` preview, flipping it to `starting`.
 * Returns null when none are queued or another instance won the race.
 */
export async function claimNextQueuedPreview(input: {
  host: string;
  maxLifetimeSeconds: number;
}): Promise<PreviewSession | null> {
  const row = await prisma.previewSession.findFirst({
    // A queued row whose intent is already "stopped" was superseded before it
    // ran — skip it so we don't clone/install work the user already canceled.
    where: { status: "queued", desiredState: "running" },
    orderBy: { createdAt: "asc" },
  });
  if (!row) return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.maxLifetimeSeconds * 1000);
  const claim = await prisma.previewSession.updateMany({
    where: { id: row.id, status: "queued" },
    data: {
      status: "starting",
      startedAt: now,
      claimedByHost: input.host,
      expiresAt,
    },
  });
  if (claim.count === 0) return null;

  return prisma.previewSession.findFirst({ where: { id: row.id } });
}

/** Reloads a preview row (used each tick to observe `desiredState` changes). */
export function loadPreviewSession(id: string): Promise<PreviewSession | null> {
  return prisma.previewSession.findFirst({ where: { id } });
}

/** Ports currently held by active previews, so the allocator can skip them. */
export async function occupiedPorts(): Promise<Set<number>> {
  const rows = await prisma.previewSession.findMany({
    where: { status: { in: [...ACTIVE_PREVIEW_STATUSES] }, port: { not: null } },
    select: { port: true },
  });
  return new Set(rows.map((r) => r.port).filter((p): p is number => p != null));
}

/**
 * Reconciles previews left in an active status by a service that died: their
 * OS children are gone, so mark the rows terminal, best-effort kill any recorded
 * pid, and remove the checkout dir. The `reapStaleRunningSessions` analogue.
 */
export async function reconcileOrphansOnStartup(): Promise<number> {
  const orphans = await prisma.previewSession.findMany({
    where: { status: { in: [...ACTIVE_PREVIEW_STATUSES] } },
    select: { id: true, pid: true },
  });

  for (const orphan of orphans) {
    if (orphan.pid) killProcessGroup(orphan.pid, "SIGKILL");
  }

  if (orphans.length > 0) {
    await prisma.previewSession.updateMany({
      where: { id: { in: orphans.map((o) => o.id) } },
      data: {
        status: "stopped",
        desiredState: "stopped",
        pid: null,
        stoppedAt: new Date(),
        errorMessage:
          "Preview service restarted; this session's process was orphaned and cleaned up.",
      },
    });
  }

  return orphans.length;
}

// ─── State-transition helpers (the only writers of preview status) ────────────

/** Marks a claimed preview as installing dependencies, recording the branch/PM. */
export function markPreviewInstalling(
  id: string,
  data: { branch: string; packageManager: string }
): Promise<PreviewSession> {
  return prisma.previewSession.update({
    where: { id },
    data: { status: "installing", branch: data.branch, packageManager: data.packageManager },
  });
}

/** Marks a preview as running, recording the pid/port/url/command. */
export function markPreviewRunning(
  id: string,
  data: { pid: number; port: number; previewUrl: string; command: string }
): Promise<PreviewSession> {
  return prisma.previewSession.update({
    where: { id },
    data: {
      status: "running",
      readyAt: new Date(),
      pid: data.pid,
      port: data.port,
      previewUrl: data.previewUrl,
      command: data.command,
      lastHeartbeatAt: new Date(),
      errorMessage: null,
    },
  });
}

/** Marks a preview as `stopping` while the child is being signalled. */
export function markPreviewStopping(id: string): Promise<PreviewSession> {
  return prisma.previewSession.update({
    where: { id },
    data: { status: "stopping" },
  });
}

/** Finalizes a preview into a terminal state, clearing the pid. */
export function finalizePreview(
  id: string,
  status: TerminalPreviewStatus,
  data?: { errorMessage?: string | null; logs?: string }
): Promise<PreviewSession> {
  return prisma.previewSession.update({
    where: { id },
    data: {
      status,
      desiredState: "stopped",
      pid: null,
      stoppedAt: new Date(),
      ...(data?.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      ...(data?.logs !== undefined ? { logs: data.logs } : {}),
    },
  });
}

/** Flushes the current log tail and touches the heartbeat. */
export function setPreviewLogs(id: string, logs: string): Promise<PreviewSession> {
  return prisma.previewSession.update({
    where: { id },
    data: { logs, lastHeartbeatAt: new Date() },
  });
}

/** Repository URL + encrypted GitHub credentials for a preview checkout. */
export interface PreviewRepositoryInfo {
  url: string;
  /** Encrypted provider-token blob for private-repo clones, or null. */
  credentials: string | null;
}

/**
 * Loads a repository's clone URL and the company's encrypted GitHub credentials
 * for a preview checkout. Returns null when the repo is missing or has no URL.
 */
export async function loadRepositoryForPreview(
  repositoryId: string,
  companyId: string
): Promise<PreviewRepositoryInfo | null> {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { companyId } },
    select: { url: true },
  });
  if (!repo?.url) return null;

  const githubConnection = await getProviderConnection(companyId, "github");
  return { url: repo.url, credentials: githubConnection?.encryptedTokens ?? null };
}
