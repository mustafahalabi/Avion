"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { notify } from "@/lib/notify";
import {
  recordReviewResult,
  type ReviewVerdict,
  type ReviewFinding,
} from "@/lib/review-service";

export type CreateReviewState =
  | undefined
  | { error: string }
  | { success: true; id: string };

const createReviewSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.literal("task"),
  title: z.string().min(1).max(300),
  reviewerId: z.string().optional(),
});

export async function createReview(
  _prev: CreateReviewState,
  formData: FormData
): Promise<CreateReviewState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const parsed = createReviewSchema.safeParse({
    entityId: formData.get("entityId"),
    entityType: formData.get("entityType") ?? "task",
    title: formData.get("title"),
    reviewerId: formData.get("reviewerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // Validate task ownership to prevent cross-company injection
  const task = await prisma.task.findFirst({
    where: { id: parsed.data.entityId, companyId: company.id },
    select: { id: true },
  });
  if (!task) return { error: "Task not found or not accessible." };

  const review = await prisma.review.create({
    data: {
      companyId: company.id,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      title: parsed.data.title,
      reviewerId: parsed.data.reviewerId,
      status: "pending",
    },
  });

  revalidatePath("/work/quality");
  revalidatePath(`/work/tasks/${parsed.data.entityId}`);
  return { success: true, id: review.id };
}

export type SubmitVerdict = ReviewVerdict;

export async function submitReviewVerdict(
  reviewId: string,
  verdict: SubmitVerdict,
  notes: string,
  findings: ReviewFinding[] = []
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  let result;
  try {
    result = await recordReviewResult({
      companyId: company.id,
      reviewId,
      verdict,
      notes: notes.trim() || null,
      findings,
    });
  } catch {
    return;
  }

  // Notify on changes_requested
  if (verdict === "changes_requested" && result.taskId) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, companyId: company.id },
      select: { title: true },
    });
    if (review) {
      await notify({
        userId: user.id,
        companyId: company.id,
        title: "Changes requested",
        body: `Review for "${review.title}" requires changes${notes ? `: ${notes.slice(0, 80)}` : "."}`,
        type: "alert",
        priority: "high",
        entityType: "task",
        entityId: result.taskId,
        actionUrl: `/work/quality/${reviewId}`,
      });
    }
  }

  revalidatePath("/work/quality");
  revalidatePath(`/work/quality/${reviewId}`);
  if (result.taskId) {
    revalidatePath(`/work/tasks/${result.taskId}`);
  }
}

export type CreateQAState =
  | undefined
  | { error: string }
  | { success: true; id: string };

const createQASchema = z.object({
  entityId: z.string().min(1),
  entityType: z.literal("task"),
  checks: z.string().default("[]"),
});

export async function createQAResult(
  _prev: CreateQAState,
  formData: FormData
): Promise<CreateQAState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const parsed = createQASchema.safeParse({
    entityId: formData.get("entityId"),
    entityType: formData.get("entityType") ?? "task",
    checks: formData.get("checks") ?? "[]",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // Validate task ownership to prevent cross-company injection
  const qaTask = await prisma.task.findFirst({
    where: { id: parsed.data.entityId, companyId: company.id },
    select: { id: true },
  });
  if (!qaTask) return { error: "Task not found or not accessible." };

  let checksData: { label: string; passed: boolean }[] = [];
  try {
    checksData = JSON.parse(parsed.data.checks);
  } catch {
    checksData = [];
  }

  const passed = checksData.filter((c) => c.passed).length;
  const failed = checksData.filter((c) => !c.passed).length;
  const allPassed = failed === 0 && passed > 0;

  const qa = await prisma.qAResult.create({
    data: {
      companyId: company.id,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      status: allPassed ? "passed" : failed > 0 ? "failed" : "pending",
      passedCount: passed,
      failedCount: failed,
      checks: parsed.data.checks,
    },
  });

  revalidatePath("/work/quality");
  revalidatePath(`/work/tasks/${parsed.data.entityId}`);
  return { success: true, id: qa.id };
}

export async function updateQAStatus(qaId: string, status: string, notes: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  const qa = await prisma.qAResult.findFirst({
    where: { id: qaId, companyId: company.id },
    select: { id: true, entityType: true, entityId: true },
  });
  if (!qa) return;

  await prisma.qAResult.update({
    where: { id: qaId },
    data: { status, notes, updatedAt: new Date() },
  });

  // When QA passes on a task, mark the task done
  if (status === "passed" && qa.entityType === "task") {
    await prisma.task.updateMany({
      where: {
        id: qa.entityId,
        companyId: company.id,
        status: { notIn: ["done", "cancelled"] },
      },
      data: { status: "done", updatedAt: new Date() },
    });
    revalidatePath(`/work/tasks/${qa.entityId}`);
  }

  revalidatePath("/work/quality");
}
