"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/current-user";
import { createOrUpdatePlanningDraftForOutcome } from "@/lib/planning-draft-service";
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
