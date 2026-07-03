"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { parseEnvVars, encryptEnvVars } from "@/lib/preview/preview-env";
import { isPreviewEnabled } from "@/worker/preview-config";

/**
 * Server actions for the Live Preview. These only read/write `PreviewSession`
 * rows — the preview engine (in-process by default, see `instrumentation.ts`)
 * does the actual clone/run. Start creates a `queued` row; Stop flips
 * `desiredState` to "stopped".
 *
 * Preview is ON by default (a built-in capability); `PREVIEW_DISABLED=true`
 * turns it off. See `isPreviewEnabled` in `@/worker/preview-config`.
 */

/** Statuses for which a preview should be considered "active" (supersede on restart). */
const ACTIVE_STATUSES = ["queued", "starting", "installing", "running", "stopping"];

async function getCurrentCompanyId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  return company?.id ?? null;
}

export type StartPreviewResult =
  | { ok: true; previewId: string }
  | { ok: false; error: string };

/**
 * Queues a live preview for a repository. Any existing active preview for the
 * same repo is superseded (its `desiredState` set to "stopped") so re-clicking
 * Start is idempotent. Env vars are parsed + encrypted before storage.
 */
export async function startPreview(input: {
  repositoryId: string;
  envVars?: string;
}): Promise<StartPreviewResult> {
  if (!isPreviewEnabled()) {
    return { ok: false, error: "Live preview is turned off (PREVIEW_DISABLED)." };
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, error: "No company found." };

  const repo = await prisma.repository.findFirst({
    where: { id: input.repositoryId, workspace: { companyId } },
    select: { id: true, url: true, workspaceId: true },
  });
  if (!repo) return { ok: false, error: "Repository not found." };
  if (!repo.url) {
    return { ok: false, error: "This repository has no URL. Add a GitHub URL first." };
  }

  const parsed = parseEnvVars(input.envVars);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Env vars are encrypted at rest — but only when there are any, so the common
  // zero-config path (no env) never needs CREDENTIALS_ENCRYPTION_KEY.
  let envVarsBlob: string | null = null;
  if (Object.keys(parsed.env).length > 0) {
    try {
      envVarsBlob = encryptEnvVars(parsed.env);
    } catch {
      return {
        ok: false,
        error:
          "To use environment variables, set CREDENTIALS_ENCRYPTION_KEY (64-char hex).",
      };
    }
  }

  // Supersede any existing active preview for this repo.
  await prisma.previewSession.updateMany({
    where: {
      repositoryId: repo.id,
      companyId,
      status: { in: ACTIVE_STATUSES },
      desiredState: "running",
    },
    data: { desiredState: "stopped" },
  });

  const created = await prisma.previewSession.create({
    data: {
      companyId,
      workspaceId: repo.workspaceId,
      repositoryId: repo.id,
      status: "queued",
      desiredState: "running",
      envVars: envVarsBlob,
    },
    select: { id: true },
  });

  return { ok: true, previewId: created.id };
}

/**
 * Requests a stop for a preview by setting its intent to "stopped". Idempotent
 * and company-scoped; the service performs the actual process kill.
 */
export async function stopPreview(input: {
  previewId: string;
}): Promise<{ ok: boolean }> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false };

  await prisma.previewSession.updateMany({
    where: { id: input.previewId, companyId },
    data: { desiredState: "stopped" },
  });
  return { ok: true };
}

/** Poll payload for the preview panel — never includes the encrypted env vars. */
export interface PreviewStatus {
  id: string;
  status: string;
  desiredState: string;
  previewUrl: string | null;
  port: number | null;
  branch: string | null;
  command: string | null;
  logs: string;
  errorMessage: string | null;
  updatedAt: string;
}

function toStatus(row: {
  id: string;
  status: string;
  desiredState: string;
  previewUrl: string | null;
  port: number | null;
  branch: string | null;
  command: string | null;
  logs: string;
  errorMessage: string | null;
  updatedAt: Date;
}): PreviewStatus {
  return {
    id: row.id,
    status: row.status,
    desiredState: row.desiredState,
    previewUrl: row.previewUrl,
    port: row.port,
    branch: row.branch,
    command: row.command,
    logs: row.logs,
    errorMessage: row.errorMessage,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const STATUS_SELECT = {
  id: true,
  status: true,
  desiredState: true,
  previewUrl: true,
  port: true,
  branch: true,
  command: true,
  logs: true,
  errorMessage: true,
  updatedAt: true,
} as const;

/** Returns the current status + logs for a preview (company-scoped), or null. */
export async function getPreviewStatus(input: {
  previewId: string;
}): Promise<PreviewStatus | null> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return null;

  const row = await prisma.previewSession.findFirst({
    where: { id: input.previewId, companyId },
    select: STATUS_SELECT,
  });
  return row ? toStatus(row) : null;
}

/**
 * Returns the most recent preview for a repository (company-scoped) so the panel
 * can restore a running/most-recent preview when the page loads.
 */
export async function getLatestPreviewForRepository(
  repositoryId: string
): Promise<PreviewStatus | null> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return null;

  const row = await prisma.previewSession.findFirst({
    where: { repositoryId, companyId },
    orderBy: { createdAt: "desc" },
    select: STATUS_SELECT,
  });
  return row ? toStatus(row) : null;
}
