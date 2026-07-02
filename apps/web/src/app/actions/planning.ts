"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/current-user";
import { createOrUpdatePlanningDraftForOutcome } from "@/lib/planning-draft-service";
import { approvePlanningDraft, applyApprovedPlan, rejectPlanningDraft } from "@/lib/plan-application-service";
import { prisma } from "@/lib/prisma";

const generatePlanningDraftSchema = z.object({
  outcomeId: z.string().min(1, "Outcome is required.").trim(),
});

export type GeneratePlanningDraftState =
  | {
      readonly message?: string;
      readonly planningDraftId?: string;
      readonly status?: string;
      readonly errors?: {
        readonly outcomeId?: readonly string[];
      };
    }
  | undefined;

/**
 * Triggers deterministic planning generation for a company-owned outcome.
 *
 * @param _prev - Previous action state supplied by `useActionState`.
 * @param formData - Form data containing `outcomeId`.
 * @example
 * ```tsx
 * <form action={generatePlanningDraftForOutcome}>
 *   <input type="hidden" name="outcomeId" value={outcome.id} />
 * </form>
 * ```
 * @returns Action state with the generated or existing PlanningDraft identity.
 */
export async function generatePlanningDraftForOutcome(
  _prev: GeneratePlanningDraftState,
  formData: FormData
): Promise<GeneratePlanningDraftState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = generatePlanningDraftSchema.safeParse({
    outcomeId: formData.get("outcomeId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  try {
    const result = await createOrUpdatePlanningDraftForOutcome({
      companyId: company.id,
      outcomeId: parsed.data.outcomeId,
      actorId: user.id,
    });

    revalidatePath("/inbox");
    revalidatePath("/dashboard");
    revalidatePath("/timeline");

    return {
      message: result.message,
      planningDraftId: result.planningDraftId,
      status: result.status,
    };
  } catch (error: unknown) {
    return {
      message: error instanceof Error ? error.message : "Unable to generate planning draft.",
    };
  }
}

// ─── Approve planning draft ───────────────────────────────────────────────────

export type ApprovePlanState =
  | undefined
  | { error: string }
  | { success: true; status: string };

export async function approvePlan(
  _prev: ApprovePlanState,
  formData: FormData
): Promise<ApprovePlanState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const planningDraftId = formData.get("planningDraftId");
  const notes = formData.get("notes");
  if (!planningDraftId || typeof planningDraftId !== "string") {
    return { error: "Planning draft ID is required." };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "No company found." };

  try {
    const result = await approvePlanningDraft({
      companyId: company.id,
      planningDraftId,
      actorId: user.id,
      notes: typeof notes === "string" ? notes : undefined,
    });

    revalidatePath("/inbox");
    revalidatePath("/dashboard");
    revalidatePath("/timeline");
    revalidatePath("/work/outcomes");
    revalidatePath("/work/plans");

    return { success: true, status: result.status };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to approve plan." };
  }
}

// ─── Reject planning draft ────────────────────────────────────────────────────

export type RejectPlanState =
  | undefined
  | { error: string }
  | { success: true; status: string };

export async function rejectPlan(
  _prev: RejectPlanState,
  formData: FormData
): Promise<RejectPlanState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const planningDraftId = formData.get("planningDraftId");
  const reason = formData.get("reason");
  if (!planningDraftId || typeof planningDraftId !== "string") {
    return { error: "Planning draft ID is required." };
  }
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return { error: "Rejection reason is required." };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "No company found." };

  try {
    const result = await rejectPlanningDraft({
      companyId: company.id,
      planningDraftId,
      actorId: user.id,
      reason: reason.trim(),
    });

    revalidatePath("/inbox");
    revalidatePath("/dashboard");
    revalidatePath("/timeline");
    revalidatePath("/work/outcomes");
    revalidatePath("/work/plans");

    return { success: true, status: result.status };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to reject plan." };
  }
}

// ─── Apply approved plan ──────────────────────────────────────────────────────

export type ApplyPlanState =
  | undefined
  | { error: string }
  | {
      success: true;
      projectsCreated: number;
      featuresCreated: number;
      tasksCreated: number;
    };

export async function applyPlan(
  _prev: ApplyPlanState,
  formData: FormData
): Promise<ApplyPlanState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const planningDraftId = formData.get("planningDraftId");
  if (!planningDraftId || typeof planningDraftId !== "string") {
    return { error: "Planning draft ID is required." };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "No company found." };

  try {
    const result = await applyApprovedPlan({
      companyId: company.id,
      planningDraftId,
      actorId: user.id,
    });

    revalidatePath("/inbox");
    revalidatePath("/dashboard");
    revalidatePath("/work");
    revalidatePath("/timeline");
    revalidatePath("/work/outcomes");
    revalidatePath("/work/plans");

    return {
      success: true,
      projectsCreated: result.projectsCreated,
      featuresCreated: result.featuresCreated,
      tasksCreated: result.tasksCreated,
    };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to apply plan." };
  }
}
