"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
} from "@/lib/active-workspace-constants";
import { createRepositoryRecord, csvToArray } from "@/lib/repository-write";
import { getGitHubConnectionStatus } from "@/lib/github-connection-service";
import {
  cloneRepositoryToTempDir,
  type RepositoryCloneResult,
} from "@/lib/repository-clone";

const addRepositorySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  url: z.string().url().trim().optional().or(z.literal("")),
  description: z.string().max(1000).trim().optional(),
  primaryLanguage: z.string().max(100).trim().optional(),
  techStack: z.string().max(2000).trim().optional(),
  frameworks: z.string().max(2000).trim().optional(),
  dependencies: z.string().max(5000).trim().optional(),
  importantFiles: z.string().max(2000).trim().optional(),
  // Optional target workspace; defaults to the company's default workspace.
  workspaceId: z.string().trim().optional().or(z.literal("")),
});

export type AddRepositoryState =
  | {
      errors?: {
        name?: string[];
        url?: string[];
        description?: string[];
      };
      message?: string;
    }
  | undefined;

export type RepositoryAnalysisActionState =
  | {
      message?: string;
      snapshotId?: string;
      status?: string;
      comparison?: unknown;
      impact?: unknown;
    }
  | undefined;

async function getCurrentCompany() {
  const user = await getCurrentUser();
  if (!user) return null;

  return prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { workspaces: { select: { id: true } } },
  });
}

export async function addRepository(
  _prev: AddRepositoryState,
  formData: FormData
): Promise<AddRepositoryState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = addRepositorySchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url") || undefined,
    description: formData.get("description") || undefined,
    primaryLanguage: formData.get("primaryLanguage") || undefined,
    techStack: formData.get("techStack") || undefined,
    frameworks: formData.get("frameworks") || undefined,
    dependencies: formData.get("dependencies") || undefined,
    importantFiles: formData.get("importantFiles") || undefined,
    workspaceId: formData.get("workspaceId") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  const repo = await createRepositoryRecord({
    companyId: company.id,
    name: parsed.data.name,
    workspaceId: parsed.data.workspaceId || null,
    url: parsed.data.url || null,
    description: parsed.data.description,
    primaryLanguage: parsed.data.primaryLanguage,
    techStack: csvToArray(parsed.data.techStack),
    frameworks: csvToArray(parsed.data.frameworks),
    dependencies: csvToArray(parsed.data.dependencies),
    importantFiles: csvToArray(parsed.data.importantFiles),
  });

  // Select the new repo's workspace (so the sidebar switcher reflects it) and
  // navigate straight to the repo inside its workspace.
  const workspace = await prisma.workspace.findUnique({
    where: { id: repo.workspaceId },
    select: { slug: true },
  });
  if (workspace) {
    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, repo.workspaceId, {
      path: "/",
      maxAge: ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
    redirect(`/w/${workspace.slug}/repositories/${repo.id}`);
  }

  redirect(`/work/repositories/${repo.id}`);
}

export async function analyzeRepository(
  _prev: RepositoryAnalysisActionState,
  formData: FormData,
): Promise<RepositoryAnalysisActionState> {
  const company = await getCurrentCompany();
  if (!company) return { message: "No company found." };

  const repositoryId = String(formData.get("repositoryId") ?? "");
  const localPath = String(formData.get("localPath") ?? "");

  if (!repositoryId || !localPath) {
    return { message: "Repository id and local path are required." };
  }

  const { createRepositoryAnalysisSnapshot } = await import("@/lib/repository-snapshot-service");
  const snapshot = await createRepositoryAnalysisSnapshot({
    repositoryId,
    companyId: company.id,
    localPath,
  });

  return {
    message: snapshot.status === "failed" ? snapshot.error ?? "Repository analysis failed." : "Repository analysis snapshot created.",
    snapshotId: snapshot.id,
    status: snapshot.status,
  };
}

/**
 * Analyzes a repository straight from its GitHub URL — no local path required.
 *
 * Clones the repository (using the company's stored GitHub token for private
 * repos) into a temp directory, runs the analyzer against that checkout, then
 * deletes it. Clone failures are recorded on the repository so they surface in
 * the same "analysis notes" area as analyzer failures.
 */
export async function analyzeRepositoryFromGitHub(
  _prev: RepositoryAnalysisActionState,
  formData: FormData,
): Promise<RepositoryAnalysisActionState> {
  const company = await getCurrentCompany();
  if (!company) return { message: "No company found." };

  const repositoryId = String(formData.get("repositoryId") ?? "");
  if (!repositoryId) return { message: "Repository id is required." };

  const repository = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { companyId: company.id } },
    select: { id: true, url: true },
  });
  if (!repository) return { message: "Repository not found." };
  if (!repository.url) {
    return {
      message: "This repository has no URL. Add a GitHub URL before analyzing.",
    };
  }

  const status = await getGitHubConnectionStatus(company.id);
  const token = status.raw?.tokens.accessToken ?? null;

  let clone: RepositoryCloneResult | null = null;
  try {
    clone = await cloneRepositoryToTempDir({ url: repository.url, token });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to clone repository.";
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { analysisStatus: "failed", analysisNotes: message },
    });
    return { message, status: "failed" };
  }

  try {
    const { createRepositoryAnalysisSnapshot } = await import(
      "@/lib/repository-snapshot-service"
    );
    const snapshot = await createRepositoryAnalysisSnapshot({
      repositoryId,
      companyId: company.id,
      localPath: clone.path,
    });
    return {
      message:
        snapshot.status === "failed"
          ? snapshot.error ?? "Repository analysis failed."
          : "Repository analysis complete.",
      snapshotId: snapshot.id,
      status: snapshot.status,
    };
  } finally {
    clone.cleanup();
  }
}

export async function compareLatestRepositorySnapshots(
  _prev: RepositoryAnalysisActionState,
  formData: FormData,
): Promise<RepositoryAnalysisActionState> {
  const company = await getCurrentCompany();
  if (!company) return { message: "No company found." };

  const repositoryId = String(formData.get("repositoryId") ?? "");
  if (!repositoryId) return { message: "Repository id is required." };

  const { compareLatestRepositoryAnalysisSnapshots } = await import("@/lib/repository-snapshot-service");
  const comparison = await compareLatestRepositoryAnalysisSnapshots({
    repositoryId,
    companyId: company.id,
  });

  return {
    message: "Latest repository snapshots compared.",
    comparison,
  };
}

export async function analyzeLatestRepositorySnapshotImpact(
  _prev: RepositoryAnalysisActionState,
  formData: FormData,
): Promise<RepositoryAnalysisActionState> {
  const company = await getCurrentCompany();
  if (!company) return { message: "No company found." };

  const repositoryId = String(formData.get("repositoryId") ?? "");
  if (!repositoryId) return { message: "Repository id is required." };

  const { analyzeLatestRepositoryImpact } = await import("@/lib/repository-snapshot-service");
  const impact = await analyzeLatestRepositoryImpact({
    repositoryId,
    companyId: company.id,
  });

  return {
    message: "Latest repository impact analysis generated.",
    impact,
  };
}
