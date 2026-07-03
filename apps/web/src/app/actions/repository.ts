"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
} from "@/lib/active-workspace-constants";
import { createRepositoryRecord, csvToArray } from "@/lib/repository-write";
import { runRepositoryAnalysis } from "@/lib/repository-analysis-runner";

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

  // Kick off analysis automatically on connect. `after()` runs the clone +
  // analysis after the response is sent (same Node process under next
  // dev/start), so the redirect below isn't blocked by the clone. The repo
  // page auto-refreshes while `analysisStatus` is pending/analyzing.
  if (repo.url) {
    after(() => runRepositoryAnalysis({ repositoryId: repo.id, companyId: company.id }));
  }

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

// NOTE: A prior `analyzeRepository` "use server" action took a client-supplied
// `localPath` and read it straight off the host filesystem — an authenticated
// arbitrary-host-path read (MUS-299). It was never wired to any UI (the
// GitHub-URL path below superseded it), so it has been removed rather than
// allowlisted. Repository analysis now only runs against a repo we cloned into a
// controlled temp dir (`analyzeRepositoryFromGitHub`), never a client-named path.

/**
 * Analyzes a repository straight from its GitHub URL — no local path required.
 *
 * Thin wrapper over the shared `runRepositoryAnalysis` core (which clones into a
 * controlled temp dir, runs the analyzer, and cleans up). This action is the
 * manual "Analyze" button; the same core also runs automatically on connect.
 */
export async function analyzeRepositoryFromGitHub(
  _prev: RepositoryAnalysisActionState,
  formData: FormData,
): Promise<RepositoryAnalysisActionState> {
  const company = await getCurrentCompany();
  if (!company) return { message: "No company found." };

  const repositoryId = String(formData.get("repositoryId") ?? "");
  if (!repositoryId) return { message: "Repository id is required." };

  const result = await runRepositoryAnalysis({
    repositoryId,
    companyId: company.id,
  });

  // Preserve the friendlier manual-button message for the no-URL case.
  if (result.status === "skipped") {
    return {
      message: "This repository has no URL. Add a GitHub URL before analyzing.",
      status: result.status,
    };
  }

  return {
    message: result.message,
    snapshotId: result.snapshotId,
    status: result.status,
  };
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
