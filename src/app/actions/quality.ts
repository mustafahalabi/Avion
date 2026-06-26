"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { notify } from "@/lib/notify";

export type CreateReviewState =
  | undefined
  | { error: string }
  | { success: true; id: string };

const createReviewSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().default("task"),
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

export type SubmitVerdict = "approved" | "changes_requested";

export async function submitReviewVerdict(
  reviewId: string,
  verdict: SubmitVerdict,
  notes: string
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  
  

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  const review = await prisma.review.findFirst({
    where: { id: reviewId, companyId: company.id },
  });
  if (!review) return;

  const newStatus = verdict === "approved" ? "approved" : "changes_requested";

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: newStatus,
      verdict,
      notes,
      changeRequestNotes: verdict === "changes_requested" ? notes : null,
    },
  });

  if (verdict === "changes_requested") {
    await prisma.changeRequest.create({
      data: {
        reviewId,
        reason: notes,
        requestedBy: "Reviewer",
      },
    });

    await notify({
      userId: user.id,
      companyId: company.id,
      title: "Changes requested",
      body: `Review for "${review.title}" requires changes: ${notes.slice(0, 80)}`,
      type: "alert",
      priority: "high",
      entityType: review.entityType,
      entityId: review.entityId,
      actionUrl: `/work/quality/${reviewId}`,
    });
  }

  revalidatePath("/work/quality");
  revalidatePath(`/work/quality/${reviewId}`);
  revalidatePath(`/work/tasks/${review.entityId}`);
}

export type CreateQAState =
  | undefined
  | { error: string }
  | { success: true; id: string };

const createQASchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().default("task"),
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

  await prisma.qAResult.updateMany({
    where: { id: qaId, companyId: company.id },
    data: { status, notes, updatedAt: new Date() },
  });

  revalidatePath("/work/quality");
}
