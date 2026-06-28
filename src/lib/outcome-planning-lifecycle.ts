import { prisma } from "@/lib/prisma";
import type { PlanningDraftStatus } from "@/lib/outcome-planning";

/** Timeline event types for the outcome planning vertical slice. */
export const OUTCOME_PLANNING_EVENT_TYPES = {
  outcomeSubmitted: "outcome.submitted",
  planGenerated: "plan.generated",
  planApproved: "plan.approved",
  planRejected: "plan.rejected",
  workCreated: "work.created",
  planFailed: "plan.failed",
} as const;

export const PENDING_PLAN_REVIEW_STATUSES: readonly PlanningDraftStatus[] = [
  "draft",
  "reviewing",
];

export interface PlanningDashboardPlanItem {
  readonly planningDraftId: string;
  readonly outcomeId: string;
  readonly outcomeTitle: string;
  readonly planTitle: string;
  readonly status: PlanningDraftStatus;
  readonly updatedAt: Date;
}

export interface PlanningTimelineItem {
  readonly id: string;
  readonly eventType: string;
  readonly summary: string;
  readonly createdAt: Date;
  readonly outcomeId: string | null;
  readonly outcomeTitle: string | null;
  readonly planningDraftId: string | null;
  readonly href: string;
}

/**
 * Records a timeline entry when a CEO submits an outcome.
 *
 * @param input - Outcome submission context.
 */
export async function recordOutcomeSubmittedEvent(input: {
  readonly companyId: string;
  readonly outcomeId: string;
  readonly outcomeTitle: string;
  readonly actorId: string | null;
  readonly source: "outcome_form" | "runtime_request";
}): Promise<void> {
  await prisma.timelineEntry.create({
    data: {
      entityType: "outcome",
      entityId: input.outcomeId,
      eventType: OUTCOME_PLANNING_EVENT_TYPES.outcomeSubmitted,
      summary: `Outcome submitted: "${input.outcomeTitle}". Planning has not started.`,
      actorId: input.actorId,
      metadata: JSON.stringify({
        companyId: input.companyId,
        source: input.source,
      }),
    },
  });
}

/**
 * Loads planning drafts awaiting CEO review for the dashboard.
 *
 * @param companyId - Company identifier.
 * @returns Pending plan rows ordered by most recently updated.
 */
export async function getPendingPlanningDrafts(
  companyId: string
): Promise<readonly PlanningDashboardPlanItem[]> {
  const drafts = await prisma.planningDraft.findMany({
    where: {
      companyId,
      status: { in: [...PENDING_PLAN_REVIEW_STATUSES] },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      outcome: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return drafts.map((draft) => ({
    planningDraftId: draft.id,
    outcomeId: draft.outcome.id,
    outcomeTitle: draft.outcome.title,
    planTitle: draft.title,
    status: draft.status as PlanningDraftStatus,
    updatedAt: draft.updatedAt,
  }));
}

/**
 * Loads recently approved planning drafts for dashboard visibility.
 *
 * @param companyId - Company identifier.
 * @returns Approved plans not yet applied, ordered by approval time.
 */
export async function getRecentlyApprovedPlanningDrafts(
  companyId: string
): Promise<readonly PlanningDashboardPlanItem[]> {
  const drafts = await prisma.planningDraft.findMany({
    where: {
      companyId,
      status: "approved",
    },
    orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }],
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      outcome: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return drafts.map((draft) => ({
    planningDraftId: draft.id,
    outcomeId: draft.outcome.id,
    outcomeTitle: draft.outcome.title,
    planTitle: draft.title,
    status: draft.status as PlanningDraftStatus,
    updatedAt: draft.updatedAt,
  }));
}

/**
 * Counts planning drafts awaiting CEO review.
 *
 * @param companyId - Company identifier.
 * @returns Number of draft/reviewing plans.
 */
export async function countPendingPlanningDrafts(companyId: string): Promise<number> {
  return prisma.planningDraft.count({
    where: {
      companyId,
      status: { in: [...PENDING_PLAN_REVIEW_STATUSES] },
    },
  });
}

/**
 * Builds a unified planning lifecycle timeline for dashboard and timeline pages.
 *
 * @param companyId - Company identifier.
 * @param limit - Maximum number of entries to return.
 * @returns Planning timeline items with navigation links.
 */
export async function getPlanningLifecycleTimeline(
  companyId: string,
  limit: number
): Promise<readonly PlanningTimelineItem[]> {
  const outcomeIds = await prisma.outcome.findMany({
    where: { companyId },
    select: { id: true, title: true },
  });
  const outcomeTitleById = new Map(outcomeIds.map((outcome) => [outcome.id, outcome.title]));
  const outcomeIdSet = new Set(outcomeIds.map((outcome) => outcome.id));

  const draftIds = await prisma.planningDraft.findMany({
    where: { companyId },
    select: { id: true, outcomeId: true },
  });
  const draftOutcomeById = new Map(
    draftIds.map((draft) => [draft.id, draft.outcomeId])
  );
  const draftIdSet = new Set(draftIds.map((draft) => draft.id));

  const entries = await prisma.timelineEntry.findMany({
    where: {
      OR: [
        { entityType: "outcome", entityId: { in: [...outcomeIdSet] } },
        { entityType: "planning_draft", entityId: { in: [...draftIdSet] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      eventType: true,
      summary: true,
      metadata: true,
      createdAt: true,
    },
  });

  return entries.map((entry) => {
    let outcomeId: string | null = null;
    let planningDraftId: string | null = null;

    if (entry.entityType === "outcome") {
      outcomeId = entry.entityId;
    } else if (entry.entityType === "planning_draft") {
      planningDraftId = entry.entityId;
      outcomeId = draftOutcomeById.get(entry.entityId) ?? null;
    }

    let metadataPlanningDraftId: string | null = null;
    try {
      const metadata = JSON.parse(entry.metadata) as { planningDraftId?: string };
      metadataPlanningDraftId = metadata.planningDraftId ?? null;
    } catch {
      metadataPlanningDraftId = null;
    }

    if (!planningDraftId && metadataPlanningDraftId) {
      planningDraftId = metadataPlanningDraftId;
    }

    const href =
      outcomeId !== null
        ? `/work/outcomes/${outcomeId}`
        : planningDraftId !== null
          ? `/work/outcomes/${draftOutcomeById.get(planningDraftId) ?? ""}`
          : "/work/projects";

    return {
      id: entry.id,
      eventType: entry.eventType,
      summary: entry.summary ?? entry.eventType,
      createdAt: entry.createdAt,
      outcomeId,
      outcomeTitle: outcomeId ? (outcomeTitleById.get(outcomeId) ?? null) : null,
      planningDraftId,
      href,
    };
  });
}

/**
 * Builds the outcome detail URL used for plan review navigation.
 *
 * @param outcomeId - Outcome identifier.
 * @returns Outcome detail path.
 */
export function buildOutcomePlanningUrl(outcomeId: string): string {
  return `/work/outcomes/${outcomeId}`;
}
