export const OUTCOME_STATUSES = [
  "proposed",
  "analyzing",
  "needs_clarification",
  "planned",
  "awaiting_approval",
  "approved",
  "in_delivery",
  "validating",
  "releasing",
  "released",
  "completed",
  "archived",
  "cancelled",
  "rejected",
  "deferred",
  "failed",
  "superseded",
] as const;

export const PLANNING_DRAFT_STATUSES = [
  "draft",
  "reviewing",
  "approved",
  "rejected",
  "applied",
  "failed",
] as const;

export const OUTCOME_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];
export type PlanningDraftStatus = (typeof PLANNING_DRAFT_STATUSES)[number];
export type OutcomePriority = (typeof OUTCOME_PRIORITIES)[number];

export interface RuntimeOutcomeInput {
  readonly companyId: string;
  readonly runtimeRequestId: string;
  readonly title: string;
  readonly rawRequest: string;
  readonly priority?: OutcomePriority;
}

export interface OutcomeCreateData {
  readonly companyId: string;
  readonly runtimeRequestId: string;
  readonly title: string;
  readonly rawRequest: string;
  readonly successCriteria: string;
  readonly constraints: string;
  readonly status: OutcomeStatus;
  readonly priority: OutcomePriority;
  readonly ownerRole: string;
}

export interface PlanningDraftWorkGuardInput {
  readonly id: string;
  readonly companyId: string;
  readonly outcomeId: string;
  readonly status: PlanningDraftStatus;
  readonly approvedAt: Date | null;
  readonly rejectedAt: Date | null;
}

export interface GeneratedWorkTraceInput {
  readonly companyId: string;
  readonly outcomeId: string;
  readonly planningDraftId: string;
  readonly planItemId: string;
}

export interface GeneratedWorkTraceData {
  readonly companyId: string;
  readonly outcomeId: string;
  readonly planningDraftId: string;
  readonly planItemId: string;
}

export interface WorkEntityOwnershipInput {
  readonly companyId: string;
  readonly entityType: "task";
  readonly entityCompanyId: string | null;
}

/**
 * Builds the deterministic Outcome payload for a captured runtime request.
 *
 * @param input - Runtime request context that anchors the future planning flow.
 * @example
 * ```ts
 * const data = buildOutcomeCreateData({
 *   companyId: "company_123",
 *   runtimeRequestId: "request_123",
 *   title: "Improve onboarding",
 *   rawRequest: "Improve activation for new users",
 * });
 * ```
 * @returns A company-scoped Outcome creation payload with no generated planning content.
 */
export function buildOutcomeCreateData(input: RuntimeOutcomeInput): OutcomeCreateData {
  return {
    companyId: input.companyId,
    runtimeRequestId: input.runtimeRequestId,
    title: input.title,
    rawRequest: input.rawRequest,
    successCriteria: "[]",
    constraints: "[]",
    status: "proposed",
    priority: input.priority ?? "medium",
    ownerRole: "Product Manager",
  };
}

/**
 * Ensures a planning draft is allowed to create traced work records.
 *
 * @param draft - Company-scoped planning draft lifecycle fields to validate.
 * @example
 * ```ts
 * assertPlanningDraftCanCreateWork({
 *   id: "plan_123",
 *   companyId: "company_123",
 *   outcomeId: "outcome_123",
 *   status: "approved",
 *   approvedAt: new Date(),
 *   rejectedAt: null,
 * });
 * ```
 * @returns Nothing when the draft is approved or already applied.
 * @throws Error when the draft is rejected, failed, unapproved, or otherwise cannot create work.
 */
export function assertPlanningDraftCanCreateWork(draft: PlanningDraftWorkGuardInput): void {
  if (draft.status === "rejected" || draft.rejectedAt !== null) {
    throw new Error("Rejected planning drafts cannot create work.");
  }

  if (draft.status === "failed") {
    throw new Error("Failed planning drafts cannot create work.");
  }

  if (draft.status !== "approved" && draft.status !== "applied") {
    throw new Error("Only approved or applied planning drafts can create work.");
  }

  if (draft.approvedAt === null) {
    throw new Error("Planning drafts must record approval before creating work.");
  }
}

/**
 * Builds the trace columns required for idempotent generated work creation.
 *
 * @param input - Company, outcome, planning draft, and deterministic plan item identifiers.
 * @example
 * ```ts
 * const trace = buildGeneratedWorkTraceData({
 *   companyId: "company_123",
 *   outcomeId: "outcome_123",
 *   planningDraftId: "plan_123",
 *   planItemId: "task:setup-auth",
 * });
 * ```
 * @returns The normalized trace payload to spread into generated work create/upsert data.
 * @throws Error when the deterministic plan item ID is empty.
 */
export function buildGeneratedWorkTraceData(
  input: GeneratedWorkTraceInput
): GeneratedWorkTraceData {
  const planItemId = input.planItemId.trim();

  if (planItemId.length === 0) {
    throw new Error("Generated work must include a deterministic plan item ID.");
  }

  return {
    companyId: input.companyId,
    outcomeId: input.outcomeId,
    planningDraftId: input.planningDraftId,
    planItemId,
  };
}

/**
 * Guards ownership for polymorphic work entity links that SQLite cannot express as foreign keys.
 *
 * @param input - Company and linked entity ownership details.
 * @example
 * ```ts
 * assertWorkEntityBelongsToCompany({
 *   companyId: "company_123",
 *   entityType: "task",
 *   entityCompanyId: "company_123",
 * });
 * ```
 * @returns Nothing when the entity belongs to the expected company.
 * @throws Error when the linked entity is missing or belongs to another company.
 */
export function assertWorkEntityBelongsToCompany(input: WorkEntityOwnershipInput): void {
  if (input.entityCompanyId !== input.companyId) {
    throw new Error(`${input.entityType} does not belong to this company.`);
  }
}

/**
 * Checks whether a planning draft is terminal for the pre-work approval flow.
 *
 * @param status - Planning draft status to evaluate.
 * @example
 * ```ts
 * const terminal = isPlanningDraftTerminalStatus("rejected");
 * ```
 * @returns `true` when the plan can no longer be edited as an active draft.
 */
export function isPlanningDraftTerminalStatus(status: PlanningDraftStatus): boolean {
  return status === "rejected" || status === "applied" || status === "failed";
}
