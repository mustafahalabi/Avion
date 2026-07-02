import type {
  GeneratedPlanningFeature,
  GeneratedPlanningProject,
  GeneratedPlanningTask,
  PlanningAssignmentRecommendation,
  PlanningDependency,
  PlanningQaPlan,
  PlanningReleasePlan,
  PlanningReviewPlan,
  PlanningRisk,
} from "@/lib/planning-generator";
import type { PlanningDraftStatus } from "@/lib/outcome-planning";

export interface PlanningReviewOutcomeContext {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

export interface PlanningReviewDraftInput {
  readonly id: string;
  readonly outcomeId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: string;
  readonly version: number;
  readonly scope: string;
  readonly nonScope: string;
  readonly assumptions: string;
  readonly risks: string;
  readonly dependencies: string;
  readonly recommendedAssignments: string;
  readonly generatedProjects: string;
  readonly generatedFeatures: string;
  readonly generatedTasks: string;
  readonly reviewPlan: string;
  readonly qaPlan: string;
  readonly releasePlan: string;
  readonly approvalNotes: string | null;
  readonly rejectionReason: string | null;
  readonly generationError: string | null;
  readonly applicationError: string | null;
  readonly approvedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly appliedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PlanningReviewView {
  readonly id: string;
  readonly outcomeId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: PlanningDraftStatus;
  readonly version: number;
  readonly scope: readonly string[];
  readonly nonScope: readonly string[];
  readonly assumptions: readonly string[];
  readonly risks: readonly PlanningRisk[];
  readonly dependencies: readonly PlanningDependency[];
  readonly recommendedAssignments: readonly PlanningAssignmentRecommendation[];
  readonly projects: readonly GeneratedPlanningProject[];
  readonly features: readonly GeneratedPlanningFeature[];
  readonly tasks: readonly GeneratedPlanningTask[];
  readonly reviewPlan: PlanningReviewPlan | null;
  readonly qaPlan: PlanningQaPlan | null;
  readonly releasePlan: PlanningReleasePlan | null;
  readonly approvalNotes: string | null;
  readonly rejectionReason: string | null;
  readonly generationError: string | null;
  readonly applicationError: string | null;
  readonly approvedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly appliedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly canApprove: boolean;
  readonly canReject: boolean;
  readonly canApply: boolean;
  readonly executionNotStarted: boolean;
}

/**
 * Parses JSON snapshot fields safely.
 *
 * @param value - JSON string from planning draft storage.
 * @param fallback - Fallback value when parsing fails.
 * @returns Parsed value or fallback.
 */
function parseJsonField<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Builds a CEO-facing planning review view from a persisted planning draft row.
 *
 * @param draft - Company-scoped planning draft record.
 * @returns Structured review payload with explicit action availability flags.
 */
export function buildPlanningReviewView(draft: PlanningReviewDraftInput): PlanningReviewView {
  const status = draft.status as PlanningDraftStatus;
  const reviewable = status === "draft" || status === "reviewing";

  return {
    id: draft.id,
    outcomeId: draft.outcomeId,
    title: draft.title,
    summary: draft.summary,
    status,
    version: draft.version,
    scope: parseJsonField<string[]>(draft.scope, []),
    nonScope: parseJsonField<string[]>(draft.nonScope, []),
    assumptions: parseJsonField<string[]>(draft.assumptions, []),
    risks: parseJsonField<PlanningRisk[]>(draft.risks, []),
    dependencies: parseJsonField<PlanningDependency[]>(draft.dependencies, []),
    recommendedAssignments: parseJsonField<PlanningAssignmentRecommendation[]>(
      draft.recommendedAssignments,
      []
    ),
    projects: parseJsonField<GeneratedPlanningProject[]>(draft.generatedProjects, []),
    features: parseJsonField<GeneratedPlanningFeature[]>(draft.generatedFeatures, []),
    tasks: parseJsonField<GeneratedPlanningTask[]>(draft.generatedTasks, []),
    reviewPlan: parseJsonField<PlanningReviewPlan | null>(draft.reviewPlan, null),
    qaPlan: parseJsonField<PlanningQaPlan | null>(draft.qaPlan, null),
    releasePlan: parseJsonField<PlanningReleasePlan | null>(draft.releasePlan, null),
    approvalNotes: draft.approvalNotes,
    rejectionReason: draft.rejectionReason,
    generationError: draft.generationError,
    applicationError: draft.applicationError,
    approvedAt: draft.approvedAt,
    rejectedAt: draft.rejectedAt,
    appliedAt: draft.appliedAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    canApprove: reviewable,
    canReject: reviewable,
    canApply: status === "approved",
    executionNotStarted: status !== "applied",
  };
}

/**
 * Builds the canonical plan review page URL.
 *
 * @param planningDraftId - Planning draft identifier.
 * @returns Plan review page path.
 */
export function buildPlanningReviewUrl(planningDraftId: string): string {
  return `/work/plans/${planningDraftId}`;
}
