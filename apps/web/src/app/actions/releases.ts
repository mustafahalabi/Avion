"use server";

import { getCurrentUser } from "@/lib/current-user";
import { markOutcomeReleased } from "@/lib/outcome-completion-service";
import { prisma } from "@/lib/prisma";
import {
  createReleaseCandidate as createReleaseCandidateRecord,
  listEligibleReleaseTasks,
} from "@/lib/release-candidate-service";
import { assessReleaseReadiness } from "@/lib/release-readiness";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const DEFAULT_CHECKLIST = [
  { id: "tests", label: "All tests passing", checked: false },
  { id: "review", label: "Code review approved", checked: false },
  { id: "qa", label: "QA validation passed", checked: false },
  { id: "docs", label: "Release notes written", checked: false },
  { id: "rollback", label: "Rollback plan documented", checked: false },
  { id: "deploy", label: "Deployment environment verified", checked: false },
];

export type CreateReleaseState =
  | undefined
  | { error: string }
  | { success: true; id: string };

const createSchema = z.object({
  version: z.string().min(1).max(50).trim(),
  title: z.string().max(300).trim().optional(),
  description: z.string().max(2000).trim().optional(),
});

export async function createRelease(
  _prev: CreateReleaseState,
  formData: FormData
): Promise<CreateReleaseState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const parsed = createSchema.safeParse({
    version: formData.get("version"),
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const release = await prisma.release.create({
    data: {
      companyId: company.id,
      version: parsed.data.version,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "draft",
      deploymentStatus: "not_started",
      checklist: JSON.stringify(DEFAULT_CHECKLIST),
      taskIds: "[]",
    },
  });

  revalidatePath("/work/releases");
  return { success: true, id: release.id };
}

const checklistItemSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(300),
  checked: z.boolean(),
});
const checklistSchema = z.array(checklistItemSchema).max(50);

export async function updateReleaseChecklist(
  releaseId: string,
  checklist: { id: string; label: string; checked: boolean }[]
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  // Boundary validation: the checklist is client-supplied — reject anything
  // that is not a well-formed checklist before persisting it.
  const parsed = checklistSchema.safeParse(checklist);
  if (!parsed.success) return;

  const allChecked =
    parsed.data.length > 0 && parsed.data.every((c) => c.checked);
  const newStatus = allChecked ? "ready" : "draft";

  await prisma.release.updateMany({
    where: { id: releaseId, companyId: company.id },
    data: {
      checklist: JSON.stringify(parsed.data),
      status: newStatus,
      updatedAt: new Date(),
    },
  });

  revalidatePath(`/work/releases/${releaseId}`);
  revalidatePath("/work/releases");
}

export async function updateReleaseNotes(
  releaseId: string,
  releaseNotes: string,
  rollbackPlan: string
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await prisma.release.updateMany({
    where: { id: releaseId, companyId: company.id },
    data: { releaseNotes, rollbackPlan, updatedAt: new Date() },
  });

  revalidatePath(`/work/releases/${releaseId}`);
}

export type MarkReleasedResult = { error?: string };

export async function markReleased(releaseId: string): Promise<MarkReleasedResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const release = await prisma.release.findFirst({
    where: { id: releaseId, companyId: company.id },
    select: { checklist: true, status: true, outcomeId: true },
  });
  if (!release) return { error: "Release not found." };
  if (release.status === "released") return {};

  // Release gate: every checklist item must actually be checked before the
  // release can be declared released/deployed.
  const readiness = assessReleaseReadiness(release.checklist);
  if (!readiness.ready) {
    return {
      error: `Cannot mark released — unchecked checklist items: ${readiness.missing.join(", ")}.`,
    };
  }

  await prisma.release.updateMany({
    where: { id: releaseId, companyId: company.id },
    data: {
      status: "released",
      deploymentStatus: "deployed",
      releasedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Outcome lifecycle (MUS-259): a shipped release moves its linked outcome to
  // the terminal `released` status. Best-effort.
  if (release.outcomeId) {
    try {
      await markOutcomeReleased(company.id, release.outcomeId, releaseId);
    } catch {
      // Outcome bookkeeping is best-effort.
    }
  }

  revalidatePath(`/work/releases/${releaseId}`);
  revalidatePath("/work/releases");
  revalidatePath("/dashboard");
  return {};
}

export async function addTaskToRelease(releaseId: string, taskId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  const release = await prisma.release.findFirst({
    where: { id: releaseId, companyId: company.id },
    select: { id: true, taskIds: true },
  });
  if (!release) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: company.id },
    select: { id: true },
  });
  if (!task) return;

  let ids: string[] = [];
  try { ids = JSON.parse(release.taskIds); } catch { ids = []; }
  if (!ids.includes(taskId)) {
    ids.push(taskId);
    await prisma.release.update({
      where: { id: releaseId },
      data: { taskIds: JSON.stringify(ids), updatedAt: new Date() },
    });
  }

  revalidatePath(`/work/releases/${releaseId}`);
}

export async function removeTaskFromRelease(releaseId: string, taskId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  const release = await prisma.release.findFirst({
    where: { id: releaseId, companyId: company.id },
    select: { id: true, taskIds: true },
  });
  if (!release) return;

  let ids: string[] = [];
  try { ids = JSON.parse(release.taskIds); } catch { ids = []; }
  ids = ids.filter((id) => id !== taskId);

  await prisma.release.update({
    where: { id: releaseId },
    data: { taskIds: JSON.stringify(ids), updatedAt: new Date() },
  });

  revalidatePath(`/work/releases/${releaseId}`);
}

export type CreateReleaseCandidateState =
  | undefined
  | { error: string }
  | { success: true; id: string; rejectedTasks: readonly { taskId: string; reason: string }[] };

const candidateSchema = z.object({
  version: z.string().min(1).max(50).trim(),
  title: z.string().max(300).trim().optional(),
  taskIds: z.array(z.string().min(1)).min(1, "Select at least one eligible task."),
});

/**
 * Creates a release candidate from completed tasks that passed review and QA.
 */
export async function createReleaseCandidate(
  _prev: CreateReleaseCandidateState,
  formData: FormData
): Promise<CreateReleaseCandidateState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const rawTaskIds = formData.getAll("taskIds");
  const taskIds = rawTaskIds.filter((id): id is string => typeof id === "string" && id.length > 0);

  const parsed = candidateSchema.safeParse({
    version: formData.get("version"),
    title: formData.get("title") || undefined,
    taskIds,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await createReleaseCandidateRecord({
      companyId: company.id,
      version: parsed.data.version,
      title: parsed.data.title,
      taskIds: parsed.data.taskIds,
    });

    revalidatePath("/work/releases");
    revalidatePath("/timeline");
    return {
      success: true,
      id: result.releaseId,
      rejectedTasks: result.rejectedTasks,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create release candidate.";
    return { error: message };
  }
}

/** Loads tasks eligible for release candidate creation for the current company. */
export async function getEligibleReleaseTasks(): Promise<
  readonly { id: string; title: string; projectId: string | null; outcomeId: string | null }[]
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return [];

  return listEligibleReleaseTasks(company.id);
}
