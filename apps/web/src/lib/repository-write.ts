import { prisma } from "@/lib/prisma";
import type { Repository } from "@/generated/prisma/client";
import { ensureDefaultWorkspace } from "@/lib/workspace-service";

/**
 * Shared repository write helpers — the single place that owns workspace
 * get-or-create, JSON-string array storage, and url-based dedupe. Both the
 * manual add-repository form action and the OAuth import actions call through
 * here so the storage shape can never drift between paths.
 */

export interface CreateRepositoryRecordInput {
  companyId: string;
  name: string;
  /** Target workspace. Defaults to the company's default workspace when omitted. */
  workspaceId?: string | null;
  url?: string | null;
  description?: string | null;
  primaryLanguage?: string | null;
  techStack?: string[];
  frameworks?: string[];
  dependencies?: string[];
  importantFiles?: string[];
}

/** Splits a comma-separated string into a trimmed, de-blanked array. */
export function csvToArray(input: string | undefined | null): string[] {
  if (!input?.trim()) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Canonicalizes a repository URL for dedupe: drops a trailing `.git`, trailing
 * slashes, and lowercases. Used so the same repo isn't imported twice.
 */
export function normalizeRepoUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "") // strip trailing slashes first
    .replace(/\.git$/i, "") // then a trailing .git (handles ".git/" inputs)
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Resolves the workspace a new repository should land in. Honours an explicit
 * `workspaceId` (validated to belong to the company), otherwise falls back to
 * the company's default workspace via the shared workspace service.
 */
async function resolveWorkspaceId(
  companyId: string,
  workspaceId?: string | null
): Promise<string> {
  if (workspaceId) {
    const owned = await prisma.workspace.findFirst({
      where: { id: workspaceId, companyId },
      select: { id: true },
    });
    if (owned) return owned.id;
  }
  return ensureDefaultWorkspace(companyId);
}

/**
 * Finds an existing repository in the company whose URL matches (after
 * normalization). Returns null when none match or `url` is empty.
 */
export async function findRepositoryByUrl(
  companyId: string,
  url: string | null | undefined
): Promise<{ id: string } | null> {
  if (!url?.trim()) return null;
  const normalized = normalizeRepoUrl(url);
  if (!normalized) return null;

  const candidates = await prisma.repository.findMany({
    where: { workspace: { companyId }, NOT: { url: null } },
    select: { id: true, url: true },
  });
  const match = candidates.find(
    (r) => r.url && normalizeRepoUrl(r.url) === normalized
  );
  return match ? { id: match.id } : null;
}

/**
 * Creates a Repository record under the company's workspace.
 * Pure persistence — no redirect, so it is reusable from any caller.
 */
export async function createRepositoryRecord(
  input: CreateRepositoryRecordInput
): Promise<Repository> {
  const workspaceId = await resolveWorkspaceId(input.companyId, input.workspaceId);

  return prisma.repository.create({
    data: {
      workspaceId,
      name: input.name,
      url: input.url || null,
      description: input.description ?? null,
      primaryLanguage: input.primaryLanguage ?? null,
      techStack: JSON.stringify(input.techStack ?? []),
      frameworks: JSON.stringify(input.frameworks ?? []),
      dependencies: JSON.stringify(input.dependencies ?? []),
      importantFiles: JSON.stringify(input.importantFiles ?? []),
      analysisStatus: "pending",
    },
  });
}
