import { prisma } from "@/lib/prisma";
import { getLatestRepositoryChangeIntelligence } from "@/lib/repository-change-intelligence";
import {
  classifyTaskKind,
  parseJsonStringArray,
  type DeterministicPlanningDraft,
  type GeneratedPlanningTask,
  type PlanningGenerationFailure,
  type PlanningGenerationResult,
  type PlanningProvenance,
  type PlanningRepositoryContext,
} from "@/lib/planning-generator";
import { resolvePlanningAdapter } from "@/lib/planning/planning-provider";
import { describePlanProvenance } from "@/lib/planning/plan-provenance";
import { getRelevantCompanyMemory } from "@/lib/memory/memory-retrieval-service";
import type { PlanningDraftStatus } from "@/lib/outcome-planning";
import {
  OUTCOME_PLANNING_EVENT_TYPES,
  PENDING_PLAN_REVIEW_STATUSES,
} from "@/lib/outcome-planning-lifecycle";

const INITIAL_DRAFT_VERSION = 1;

export interface PlanningDraftGenerationInput {
  readonly companyId: string;
  readonly outcomeId: string;
  readonly actorId: string | null;
  /**
   * Regenerate the latest draft in place when it is still pending CEO review
   * ("draft"/"reviewing"), so new outcome constraints — e.g. CEO chat
   * follow-ups (MUS-261) — reach the plan before approval. Approved and
   * applied drafts are never regenerated, even with this flag.
   */
  readonly regeneratePendingDraft?: boolean;
}

export interface PlanningDraftGenerationResponse {
  readonly outcomeId: string;
  readonly planningDraftId: string;
  readonly status: PlanningDraftStatus;
  readonly message: string;
}

interface OutcomeForPlanning {
  readonly id: string;
  readonly companyId: string;
  readonly runtimeRequestId: string | null;
  readonly title: string;
  readonly rawRequest: string;
  readonly brief: string | null;
  readonly businessValue: string | null;
  readonly successCriteria: string;
  readonly constraints: string;
}

/**
 * Generates or finds the deterministic planning draft for a company-owned outcome.
 *
 * @param input - Company, outcome, and optional actor context for ownership and events.
 * @example
 * ```ts
 * await createOrUpdatePlanningDraftForOutcome({
 *   companyId: "company_123",
 *   outcomeId: "outcome_123",
 *   actorId: "user_123",
 * });
 * ```
 * @returns The persisted planning draft identity and lifecycle status.
 * @throws Error when the outcome is not owned by the supplied company.
 */
export async function createOrUpdatePlanningDraftForOutcome(
  input: PlanningDraftGenerationInput
): Promise<PlanningDraftGenerationResponse> {
  // Draft versioning: the latest non-rejected, non-failed draft is reused as-is.
  // A REJECTED latest draft no longer strands the outcome — generation proceeds
  // at the next version so the CEO can re-plan. A FAILED latest draft is
  // regenerated in place at the same version. A PENDING draft ("draft" /
  // "reviewing") is also regenerated in place — same version, upsert replaces
  // it — when the caller opts in via `regeneratePendingDraft` (MUS-261).
  const latestDraft = await prisma.planningDraft.findFirst({
    where: {
      companyId: input.companyId,
      outcomeId: input.outcomeId,
    },
    orderBy: { version: "desc" },
    select: { id: true, outcomeId: true, status: true, version: true },
  });

  const regeneratePending =
    input.regeneratePendingDraft === true &&
    latestDraft !== null &&
    PENDING_PLAN_REVIEW_STATUSES.includes(latestDraft.status as PlanningDraftStatus);

  if (
    latestDraft &&
    latestDraft.status !== "failed" &&
    latestDraft.status !== "rejected" &&
    !regeneratePending
  ) {
    return {
      outcomeId: latestDraft.outcomeId,
      planningDraftId: latestDraft.id,
      status: latestDraft.status as PlanningDraftStatus,
      message: "Planning draft already exists for this outcome.",
    };
  }

  const draftVersion =
    latestDraft === null
      ? INITIAL_DRAFT_VERSION
      : latestDraft.status === "rejected"
        ? latestDraft.version + 1
        : latestDraft.version;

  const outcome = await prisma.outcome.findFirst({
    where: { id: input.outcomeId, companyId: input.companyId },
    select: {
      id: true,
      companyId: true,
      runtimeRequestId: true,
      title: true,
      rawRequest: true,
      brief: true,
      businessValue: true,
      successCriteria: true,
      constraints: true,
    },
  });

  if (!outcome) {
    throw new Error("Outcome not found for this company.");
  }

  const [employees, repositories, companySettings] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: input.companyId, status: "active" },
      select: {
        id: true,
        name: true,
        title: true,
        responsibilities: true,
        role: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.repository.findMany({
      where: { workspace: { companyId: input.companyId } },
      select: {
        id: true,
        name: true,
        description: true,
        primaryLanguage: true,
        techStack: true,
        frameworks: true,
        dependencies: true,
        importantFiles: true,
        analysisStatus: true,
        analysisNotes: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.companySettings.findUnique({
      where: { companyId: input.companyId },
      select: { planningProvider: true, cultureProfile: true },
    }),
  ]);

  const planningRepositories = await Promise.all(
    repositories.map((repository) => toPlanningRepositoryContext(repository, input.companyId))
  );

  // Surface durable company memory (promoted standards + lessons) so the planner
  // compounds prior experience: the AI planner renders it into its prompt, and the
  // deterministic generator renders the top items as explicit plan assumptions.
  const companyMemory = await getRelevantCompanyMemory({ companyId: input.companyId });

  // Per-company provider override (MUS-262): a stored CompanySettings.planningProvider
  // wins; null falls through to the EOS_PLANNING_PROVIDER environment default. Only the
  // adapter *selection* changes — validation, grounding, and the deterministic fallback
  // inside the AI adapter are untouched.
  const generation = await resolvePlanningAdapter({
    provider: companySettings?.planningProvider ?? null,
  }).generate({
    companyId: outcome.companyId,
    outcomeId: outcome.id,
    title: outcome.title,
    rawRequest: outcome.rawRequest,
    brief: outcome.brief,
    businessValue: outcome.businessValue,
    successCriteria: parseJsonStringArray(outcome.successCriteria),
    constraints: parseJsonStringArray(outcome.constraints),
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      title: employee.title,
      roleName: employee.role?.name ?? null,
      responsibilities: employee.responsibilities,
    })),
    repositories: planningRepositories,
    companyMemory,
    cultureProfile: companySettings?.cultureProfile ?? null,
  });

  return persistPlanningGeneration({
    actorId: input.actorId,
    generation,
    outcome,
    version: draftVersion,
  });
}

/**
 * Converts persisted repository rows into pure generator context.
 *
 * @param repository - Repository row selected for planning context.
 * @example
 * ```ts
 * const context = toPlanningRepositoryContext(repository);
 * ```
 * @returns Repository context with parsed JSON metadata arrays.
 */
async function toPlanningRepositoryContext(repository: {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly primaryLanguage: string | null;
  readonly techStack: string;
  readonly frameworks: string;
  readonly dependencies: string;
  readonly importantFiles: string;
  readonly analysisStatus: string;
  readonly analysisNotes: string | null;
}, companyId: string): Promise<PlanningRepositoryContext> {
  const changeIntelligence = await getLatestRepositoryChangeIntelligence({
    repositoryId: repository.id,
    companyId,
  });
  const impact = changeIntelligence.impact;
  const impactSummary = impact && !("error" in impact) ? impact.summary : null;

  return {
    id: repository.id,
    name: repository.name,
    description: repository.description,
    primaryLanguage: repository.primaryLanguage,
    techStack: parseJsonStringArray(repository.techStack),
    frameworks: parseJsonStringArray(repository.frameworks),
    dependencies: parseJsonStringArray(repository.dependencies),
    importantFiles: parseJsonStringArray(repository.importantFiles),
    analysisStatus: repository.analysisStatus,
    analysisNotes: repository.analysisNotes,
    latestChangeSummary: impactSummary,
    latestChangeImpactLevel: impact && !("error" in impact) ? impact.overallImpactLevel : null,
    latestChangeAffectedAreas: impact && !("error" in impact) ? impact.affectedAreas : [],
    latestChangeRecommendedActions:
      impact && !("error" in impact)
        ? impact.recommendedActions.map((action) => action.action)
        : [],
  };
}

/**
 * Persists a successful or failed planning generation result.
 *
 * @param input - Outcome, generation result, and optional actor metadata.
 * @example
 * ```ts
 * await persistPlanningGeneration({ outcome, generation, actorId: "user_123" });
 * ```
 * @returns The persisted draft status and identity.
 */
async function persistPlanningGeneration(input: {
  readonly outcome: OutcomeForPlanning;
  readonly generation: PlanningGenerationResult;
  readonly actorId: string | null;
  readonly version: number;
}): Promise<PlanningDraftGenerationResponse> {
  if (input.generation.status === "success") {
    return persistSuccessfulGeneration(
      input.outcome,
      input.generation.draft,
      input.generation.provenance ?? null,
      input.actorId,
      input.version
    );
  }

  return persistFailedGeneration(
    input.outcome,
    input.generation,
    input.actorId,
    input.version
  );
}

/**
 * Persists a successful deterministic planning draft and records events.
 *
 * @param outcome - Company-owned outcome row.
 * @param draft - Generated planning draft payload.
 * @param actorId - Optional user ID for timeline attribution.
 * @returns The persisted draft status and identity.
 */
async function persistSuccessfulGeneration(
  outcome: OutcomeForPlanning,
  draft: DeterministicPlanningDraft,
  provenance: PlanningProvenance | null,
  actorId: string | null,
  version: number
): Promise<PlanningDraftGenerationResponse> {
  // Provenance suffix (MUS-271) so the timeline distinguishes an AI plan from an
  // AI→deterministic fallback instead of presenting both identically.
  const provenanceBadge = describePlanProvenance({
    provider: provenance?.provider ?? null,
    providerAttempted: provenance?.providerAttempted ?? null,
    fallbackReason: provenance?.fallbackReason ?? null,
  });
  const provenanceSuffix = ` [${provenanceBadge.label}${
    provenanceBadge.detail ? `: ${provenanceBadge.detail}` : ""
  }]`;

  // Stamp a task kind on every generated task before persistence so the stored
  // plan JSON is the single source of truth for which tasks are implementation vs
  // analysis. The deterministic generator already sets `kind`; an AI draft may not,
  // so fall back to the conservative role classifier. plan-application (which tasks
  // become rows) and task-selection (which dependencies block) both read this.
  const normalizedGeneratedTasks: GeneratedPlanningTask[] = draft.generatedTasks.map(
    (task) => ({
      ...task,
      kind: task.kind ?? classifyTaskKind(task.recommendedRole),
    })
  );
  const generatedTasksJson = JSON.stringify(normalizedGeneratedTasks);

  const planningDraft = await prisma.$transaction(async (tx) => {
    const persistedDraft = await tx.planningDraft.upsert({
      where: {
        companyId_outcomeId_version: {
          companyId: outcome.companyId,
          outcomeId: outcome.id,
          version,
        },
      },
      create: {
        companyId: outcome.companyId,
        outcomeId: outcome.id,
        title: draft.title,
        summary: draft.summary,
        status: draft.status,
        version,
        provider: provenance?.provider ?? null,
        providerAttempted: provenance?.providerAttempted ?? null,
        fallbackReason: provenance?.fallbackReason ?? null,
        scope: JSON.stringify(draft.scope),
        nonScope: JSON.stringify(draft.nonScope),
        assumptions: JSON.stringify(draft.assumptions),
        risks: JSON.stringify(draft.risks),
        dependencies: JSON.stringify(draft.dependencies),
        recommendedAssignments: JSON.stringify(draft.recommendedAssignments),
        generatedProjects: JSON.stringify(draft.generatedProjects),
        generatedFeatures: JSON.stringify(draft.generatedFeatures),
        generatedTasks: generatedTasksJson,
        reviewPlan: JSON.stringify(draft.reviewPlan),
        qaPlan: JSON.stringify(draft.qaPlan),
        releasePlan: JSON.stringify(draft.releasePlan),
      },
      update: {
        title: draft.title,
        summary: draft.summary,
        status: draft.status,
        scope: JSON.stringify(draft.scope),
        nonScope: JSON.stringify(draft.nonScope),
        assumptions: JSON.stringify(draft.assumptions),
        risks: JSON.stringify(draft.risks),
        dependencies: JSON.stringify(draft.dependencies),
        recommendedAssignments: JSON.stringify(draft.recommendedAssignments),
        generatedProjects: JSON.stringify(draft.generatedProjects),
        generatedFeatures: JSON.stringify(draft.generatedFeatures),
        generatedTasks: generatedTasksJson,
        reviewPlan: JSON.stringify(draft.reviewPlan),
        qaPlan: JSON.stringify(draft.qaPlan),
        releasePlan: JSON.stringify(draft.releasePlan),
        provider: provenance?.provider ?? null,
        providerAttempted: provenance?.providerAttempted ?? null,
        fallbackReason: provenance?.fallbackReason ?? null,
        generationError: null,
      },
      select: { id: true, status: true },
    });

    await tx.outcome.updateMany({
      where: { id: outcome.id, companyId: outcome.companyId },
      data: {
        status: "planned",
        failureReason: null,
        successCriteria: JSON.stringify(draft.acceptanceCriteria),
        constraints: JSON.stringify(draft.openCeoQuestions),
      },
    });

    if (outcome.runtimeRequestId) {
      await tx.runtimeRequest.updateMany({
        where: { id: outcome.runtimeRequestId, companyId: outcome.companyId },
        data: {
          status: "planning",
          clarification: null,
          resolution: "A deterministic planning draft has been generated and is ready for CEO review.",
        },
      });

      await tx.runtimeEvent.create({
        data: {
          requestId: outcome.runtimeRequestId,
          type: OUTCOME_PLANNING_EVENT_TYPES.planGenerated,
          description: `Planning draft generated for outcome "${outcome.title}".${provenanceSuffix} No work records were created.`,
          actor: "System",
        },
      });
    }

    await tx.timelineEntry.create({
      data: {
        entityType: "outcome",
        entityId: outcome.id,
        eventType: OUTCOME_PLANNING_EVENT_TYPES.planGenerated,
        summary: `Planning draft generated for "${outcome.title}".${provenanceSuffix} No work records were created.`,
        actorId,
        metadata: JSON.stringify({
          planningDraftId: persistedDraft.id,
          generatorVersion: draft.generatorVersion,
          createdWorkRecords: false,
          provider: provenanceBadge.tone,
          fallbackReason: provenanceBadge.detail,
        }),
      },
    });

    await tx.timelineEntry.create({
      data: {
        entityType: "planning_draft",
        entityId: persistedDraft.id,
        eventType: OUTCOME_PLANNING_EVENT_TYPES.planGenerated,
        summary: `Plan ready for CEO review: "${draft.title}".`,
        actorId,
        metadata: JSON.stringify({
          outcomeId: outcome.id,
          planningDraftId: persistedDraft.id,
          createdWorkRecords: false,
        }),
      },
    });

    return persistedDraft;
  });

  return {
    outcomeId: outcome.id,
    planningDraftId: planningDraft.id,
    status: planningDraft.status as PlanningDraftStatus,
    message: "Planning draft generated.",
  };
}

/**
 * Persists a failed deterministic planning attempt and records events.
 *
 * @param outcome - Company-owned outcome row.
 * @param failure - Deterministic generation failure details.
 * @param actorId - Optional user ID for timeline attribution.
 * @returns The persisted failed draft status and identity.
 */
async function persistFailedGeneration(
  outcome: OutcomeForPlanning,
  failure: PlanningGenerationFailure,
  actorId: string | null,
  version: number
): Promise<PlanningDraftGenerationResponse> {
  const planningDraft = await prisma.$transaction(async (tx) => {
    const persistedDraft = await tx.planningDraft.upsert({
      where: {
        companyId_outcomeId_version: {
          companyId: outcome.companyId,
          outcomeId: outcome.id,
          version,
        },
      },
      create: {
        companyId: outcome.companyId,
        outcomeId: outcome.id,
        title: `${outcome.title} Planning Draft`,
        summary: failure.reason,
        status: "failed",
        version,
        scope: "[]",
        nonScope: JSON.stringify(COMMON_FAILED_NON_SCOPE),
        assumptions: "[]",
        risks: "[]",
        dependencies: "[]",
        recommendedAssignments: "[]",
        generatedProjects: "[]",
        generatedFeatures: "[]",
        generatedTasks: "[]",
        reviewPlan: "{}",
        qaPlan: "{}",
        releasePlan: "{}",
        generationError: JSON.stringify({
          reason: failure.reason,
          openCeoQuestions: failure.openCeoQuestions,
        }),
      },
      update: {
        summary: failure.reason,
        status: "failed",
        generationError: JSON.stringify({
          reason: failure.reason,
          openCeoQuestions: failure.openCeoQuestions,
        }),
      },
      select: { id: true, status: true },
    });

    await tx.outcome.updateMany({
      where: { id: outcome.id, companyId: outcome.companyId },
      data: {
        status: "needs_clarification",
        failureReason: failure.reason,
      },
    });

    if (outcome.runtimeRequestId) {
      await tx.runtimeRequest.updateMany({
        where: { id: outcome.runtimeRequestId, companyId: outcome.companyId },
        data: {
          status: "blocked",
          clarification: failure.openCeoQuestions.join("\n"),
        },
      });

      await tx.runtimeEvent.create({
        data: {
          requestId: outcome.runtimeRequestId,
          type: OUTCOME_PLANNING_EVENT_TYPES.planFailed,
          description: `Planning draft generation failed for outcome "${outcome.title}": ${failure.reason}`,
          actor: "System",
        },
      });
    }

    await tx.timelineEntry.create({
      data: {
        entityType: "outcome",
        entityId: outcome.id,
        eventType: OUTCOME_PLANNING_EVENT_TYPES.planFailed,
        summary: failure.reason,
        actorId,
        metadata: JSON.stringify({
          planningDraftId: persistedDraft.id,
          openCeoQuestions: failure.openCeoQuestions,
          createdWorkRecords: false,
        }),
      },
    });

    return persistedDraft;
  });

  return {
    outcomeId: outcome.id,
    planningDraftId: planningDraft.id,
    status: planningDraft.status as PlanningDraftStatus,
    message: failure.reason,
  };
}

const COMMON_FAILED_NON_SCOPE = [
  "Do not create work records from a failed planning draft.",
  "Ask the CEO focused clarification questions before retrying generation.",
] as const;
