import type {
  OutcomePlanningInput,
  PlanningGenerationResult,
} from "@/lib/planning-generator";

/**
 * Provider-independent contract for turning a CEO outcome into a reviewable planning draft.
 *
 * Mirrors the {@link import("@/lib/adapters/execution-adapter").ExecutionAdapter} pattern:
 * Engineering OS owns the full outcome → draft → review → apply lifecycle, and the adapter
 * is responsible for the single *generation* step only. Every implementation MUST return a
 * value in the exact {@link PlanningGenerationResult} shape so the downstream quality
 * validation, CEO/autonomy review gate, and idempotent application path are identical
 * regardless of whether the draft came from deterministic templates or a real LLM.
 */
export interface PlanningAdapter {
  /** Stable identifier for telemetry, audit, and timeline attribution (e.g. "deterministic", "ai-claude"). */
  readonly provider: string;

  /**
   * Produces a planning draft (or a structured failure) for the given outcome context.
   *
   * @param input - Company-scoped outcome, employee, and repository context.
   * @returns A successful draft or a failure with open CEO questions.
   */
  generate(input: OutcomePlanningInput): Promise<PlanningGenerationResult>;
}
