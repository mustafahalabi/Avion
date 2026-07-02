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
    const result = generateDeterministicPlanningDraft(input);
    if (result.status !== "success") {
      return result;
    }
    // Stamp provenance so downstream persistence can distinguish a plain
    // deterministic plan from an AI plan or an AI→deterministic fallback (MUS-271).
    return {
      ...result,
      provenance: {
        provider: "deterministic",
        providerAttempted: null,
        fallbackReason: null,
      },
    };
  }
}
