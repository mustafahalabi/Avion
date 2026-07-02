import {
  generateDeterministicPlanningDraft,
  type OutcomePlanningInput,
  type PlanningGenerationResult,
} from "@/lib/planning-generator";
import type { PlanningAdapter } from "./planning-adapter";

/**
 * Baseline planning adapter wrapping the deterministic, templated generator.
 *
 * Always available, never performs network/LLM I/O, and fully synchronous under the hood.
 * It is both the default provider and the fallback for {@link import("./ai-planning-adapter").AiPlanningAdapter},
 * which guarantees AI planning can never produce a worse result than the deterministic baseline.
 */
export class DeterministicPlanningAdapter implements PlanningAdapter {
  readonly provider = "deterministic";

  /**
   * Generates a deterministic planning draft.
   *
   * @param input - Company-scoped outcome, employee, and repository context.
   * @returns A successful deterministic draft or a structured failure.
   */
  async generate(
    input: OutcomePlanningInput
  ): Promise<PlanningGenerationResult> {
    return generateDeterministicPlanningDraft(input);
  }
}
