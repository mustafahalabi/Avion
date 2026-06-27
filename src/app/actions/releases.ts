"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
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

  const allChecked = checklist.every((c) => c.checked);
  const newStatus = allChecked ? "ready" : "draft";

  await prisma.release.updateMany({
    where: { id: releaseId, companyId: company.id },
    data: {
      checklist: JSON.stringify(checklist),
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

export async function markReleased(releaseId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await prisma.release.updateMany({
    where: { id: releaseId, companyId: company.id },
    data: {
      status: "released",
      deploymentStatus: "deployed",
      releasedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  revalidatePath(`/work/releases/${releaseId}`);
  revalidatePath("/work/releases");
  revalidatePath("/dashboard");
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
