import { prisma } from "@/lib/prisma";
import {
  buildPlanningReviewView,
  type PlanningReviewOutcomeContext,
  type PlanningReviewView,
} from "@/lib/planning-review-view";

export interface PlanningReviewQueryInput {
  readonly planningDraftId: string;
  readonly companyId: string;
}

export interface PlanningReviewPageData {
  readonly plan: PlanningReviewView;
  readonly outcome: PlanningReviewOutcomeContext;
}

/**
 * Loads a company-scoped planning draft for CEO review.
 *
 * @param input - Planning draft and company identifiers.
 * @returns Review page data or null when not found.
 */
export async function getPlanningReviewPageData(
  input: PlanningReviewQueryInput
): Promise<PlanningReviewPageData | null> {
  const draft = await prisma.planningDraft.findFirst({
    where: {
      id: input.planningDraftId,
      companyId: input.companyId,
    },
    include: {
      outcome: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  if (!draft) return null;

  return {
    plan: buildPlanningReviewView(draft),
    outcome: {
      id: draft.outcome.id,
      title: draft.outcome.title,
      status: draft.outcome.status,
    },
  };
}
