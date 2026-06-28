"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { z } from "zod";
import { redirect } from "next/navigation";

const addRepositorySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  url: z.string().url().trim().optional().or(z.literal("")),
  description: z.string().max(1000).trim().optional(),
  primaryLanguage: z.string().max(100).trim().optional(),
  techStack: z.string().max(2000).trim().optional(),
  frameworks: z.string().max(2000).trim().optional(),
  dependencies: z.string().max(5000).trim().optional(),
  importantFiles: z.string().max(2000).trim().optional(),
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

function csvToJson(input: string | undefined): string {
  if (!input?.trim()) return "[]";
  const items = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

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
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { workspaces: { select: { id: true } } },
  });
  if (!company) return { message: "No company found." };

  let workspaceId: string;
  if (company.workspaces.length > 0) {
    workspaceId = company.workspaces[0].id;
  } else {
    const workspace = await prisma.workspace.create({
      data: { companyId: company.id, name: "Default", slug: "default" },
    });
    workspaceId = workspace.id;
  }

  const repo = await prisma.repository.create({
    data: {
      workspaceId,
      name: parsed.data.name,
      url: parsed.data.url || null,
      description: parsed.data.description,
      primaryLanguage: parsed.data.primaryLanguage,
      techStack: csvToJson(parsed.data.techStack),
      frameworks: csvToJson(parsed.data.frameworks),
      dependencies: csvToJson(parsed.data.dependencies),
      importantFiles: csvToJson(parsed.data.importantFiles),
      analysisStatus: "pending",
    },
  });

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
