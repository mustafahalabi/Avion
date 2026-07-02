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
import {
  recordQaResult,
  type QaVerdict,
  type QaFinding,
} from "@/lib/qa-service";
import {
  generateQaChecklist,
  serializeChecklist,
  countChecklist,
} from "@/lib/qa-checklist";

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

  // Boundary validation: only well-formed { label, passed } entries survive —
  // the raw client JSON is never persisted verbatim.
  let checksData: { label: string; passed: boolean }[] = [];
  try {
    const raw = JSON.parse(parsed.data.checks) as unknown;
    if (Array.isArray(raw)) {
      checksData = raw.filter(
        (item): item is { label: string; passed: boolean } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { label?: unknown }).label === "string" &&
          typeof (item as { passed?: unknown }).passed === "boolean"
      );
    }
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
      checks: JSON.stringify(checksData),
    },
  });

  revalidatePath("/work/quality");
  revalidatePath(`/work/tasks/${parsed.data.entityId}`);
  return { success: true, id: qa.id };
}

export type SubmitQaVerdict = QaVerdict;

export async function submitQaVerdict(
  qaResultId: string,
  verdict: SubmitQaVerdict,
  notes: string,
  findings: QaFinding[] = []
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  let result;
  try {
    result = await recordQaResult({
      companyId: company.id,
      qaResultId,
      verdict,
      notes: notes.trim() || null,
      findings,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to record QA result.";
    return { error: message };
  }

  if (verdict === "failed" && result.taskId) {
    await notify({
      userId: user.id,
      companyId: company.id,
      title: "QA failed",
      body: `QA validation failed${notes ? `: ${notes.slice(0, 80)}` : "."}`,
      type: "alert",
      priority: "high",
      entityType: "task",
      entityId: result.taskId,
      actionUrl: `/work/quality/qa/${qaResultId}`,
    });
  }

  revalidatePath("/work/quality");
  revalidatePath(`/work/quality/qa/${qaResultId}`);
  if (result.taskId) {
    revalidatePath(`/work/tasks/${result.taskId}`);
  }

  return {};
}

/** @deprecated Use submitQaVerdict instead. */
export async function updateQAStatus(qaId: string, status: string, notes: string): Promise<void> {
  if (status === "passed" || status === "failed" || status === "blocked" || status === "needs_clarification") {
    await submitQaVerdict(qaId, status as SubmitQaVerdict, notes);
  }
}

export type GenerateQaChecklistState =
  | undefined
  | { error: string }
  | { success: true; qaId: string; count: number };

/**
 * Generates a QA checklist from task acceptance criteria, review output,
 * files changed, and validation commands. Stores the result in the pending
 * QAResult for the task.
 *
 * Requires an approved review to exist for the task (review gate).
 */
export async function generateQaChecklistForTask(
  _prev: GenerateQaChecklistState,
  formData: FormData
): Promise<GenerateQaChecklistState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const taskId = formData.get("taskId");
  if (!taskId || typeof taskId !== "string") return { error: "Task ID required." };

  // Validate task ownership
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: company.id },
    include: { planningDraft: { select: { generatedTasks: true } } },
  });
  if (!task) return { error: "Task not found or not accessible." };

  // Review gate: must have an approved review
  const approvedReview = await prisma.review.findFirst({
    where: {
      companyId: company.id,
      entityType: "task",
      entityId: taskId,
      status: "approved",
    },
    select: {
      id: true,
      notes: true,
      findings: true,
    },
  });
  if (!approvedReview) {
    return { error: "QA checklist requires an approved review. No approved review found for this task." };
  }

  // Fetch latest completed session for files changed and validation output
  const session = await prisma.executionSession.findFirst({
    where: {
      companyId: company.id,
      taskId,
      status: { in: ["completed", "failed"] },
    },
    orderBy: { completedAt: "desc" },
    select: { filesChanged: true, validationOutput: true },
  });

  // Extract acceptance criteria from planning draft or fall back to description
  let acceptanceCriteria: string[] = [];
  if (task.planningDraft?.generatedTasks && task.planItemId) {
    try {
      const parsed = JSON.parse(task.planningDraft.generatedTasks) as unknown[];
      const payload = parsed.find(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          (item as Record<string, unknown>).planItemId === task.planItemId
      ) as Record<string, unknown> | undefined;
      if (payload?.acceptanceCriteria && Array.isArray(payload.acceptanceCriteria)) {
        acceptanceCriteria = payload.acceptanceCriteria as string[];
      }
    } catch {
      acceptanceCriteria = [];
    }
  }
  if (acceptanceCriteria.length === 0 && task.description) {
    acceptanceCriteria = [task.description];
  }

  // Parse files changed
  let filesChanged: string[] = [];
  try {
    filesChanged = JSON.parse(session?.filesChanged ?? "[]") as string[];
  } catch {
    filesChanged = [];
  }

  // Parse review findings
  type RawFinding = { severity: string; description: string };
  let reviewFindings: RawFinding[] = [];
  try {
    reviewFindings = JSON.parse(approvedReview.findings ?? "[]") as RawFinding[];
  } catch {
    reviewFindings = [];
  }

  // Standard validation commands (always include)
  const validationCommands = [
    "npx prisma validate",
    "npx tsc --noEmit",
    "npm run lint",
    "npm run build",
    "npm run test",
  ];

  const checklist = generateQaChecklist({
    acceptanceCriteria,
    reviewNotes: approvedReview.notes ?? null,
    reviewFindings,
    filesChanged,
    validationCommands,
  });

  const checksJson = serializeChecklist(checklist);
  const { passed, failed } = countChecklist(checklist);

  // Find or create a pending QAResult for this task
  const existingQa = await prisma.qAResult.findFirst({
    where: {
      companyId: company.id,
      entityType: "task",
      entityId: taskId,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let qaId: string;
  if (existingQa) {
    await prisma.qAResult.update({
      where: { id: existingQa.id },
      data: {
        checks: checksJson,
        passedCount: passed,
        failedCount: failed,
        updatedAt: new Date(),
      },
    });
    qaId = existingQa.id;
  } else {
    const newQa = await prisma.qAResult.create({
      data: {
        companyId: company.id,
        entityType: "task",
        entityId: taskId,
        status: "pending",
        checks: checksJson,
        passedCount: passed,
        failedCount: failed,
      },
    });
    qaId = newQa.id;
  }

  revalidatePath("/work/quality");
  revalidatePath(`/work/tasks/${taskId}`);
  return { success: true, qaId, count: checklist.length };
}
