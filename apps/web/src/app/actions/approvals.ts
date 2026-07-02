"use server";

import { revalidatePath } from "next/cache";

import {
  approveQaCheckpoint,
  approveReviewCheckpoint,
  rejectReviewCheckpoint,
} from "@/lib/approval-checkpoints";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

/** Result of an approval action. */
export type ApprovalActionResult = { ok: true } | { error: string };

/** Resolves the logged-in CEO's company id, or null when unauthenticated. */
async function resolveCompanyId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  return company?.id ?? null;
}

function revalidate(taskId: string | null | undefined): void {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  if (taskId) revalidatePath(`/work/tasks/${taskId}`);
}

/**
 * Approves a pending review checkpoint, resuming the flow (creates the QA step).
 */
export async function approveReviewCheckpointAction(
  reviewId: string
): Promise<ApprovalActionResult> {
  const companyId = await resolveCompanyId();
  if (!companyId) return { error: "Not authenticated." };
  try {
    const result = await approveReviewCheckpoint(companyId, reviewId);
    revalidate(result.taskId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to approve review." };
  }
}

/**
 * Rejects a pending review checkpoint, sending the task back to implementation.
 */
export async function rejectReviewCheckpointAction(
  reviewId: string
): Promise<ApprovalActionResult> {
  const companyId = await resolveCompanyId();
  if (!companyId) return { error: "Not authenticated." };
  try {
    const result = await rejectReviewCheckpoint(companyId, reviewId);
    revalidate(result.taskId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reject review." };
  }
}

/**
 * Approves a pending QA checkpoint, completing the task.
 */
export async function approveQaCheckpointAction(
  qaResultId: string
): Promise<ApprovalActionResult> {
  const companyId = await resolveCompanyId();
  if (!companyId) return { error: "Not authenticated." };
  try {
    const result = await approveQaCheckpoint(companyId, qaResultId);
    revalidate(result.taskId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to approve QA." };
  }
}
