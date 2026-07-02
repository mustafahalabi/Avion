import {
  validatePlanningDraftQuality,
  type OutcomePlanningInput,
  type PlanningGenerationResult,
} from "@/lib/planning-generator";
import type { LlmClient } from "@/lib/llm/llm-client";

import type { PlanningAdapter } from "./planning-adapter";
import { buildPlanningPrompt } from "./planning-prompt";
import { parseAiPlanningDraft } from "./plan-parser";
import { checkPlanGrounding } from "./plan-grounding";

/** Wall-clock budget (seconds) granted to the LLM for a planning completion. */
const AI_PLANNING_TIMEOUT_SECONDS = 180;

/** Dependencies injected into {@link AiPlanningAdapter}. */
export interface AiPlanningAdapterDeps {
  /** Provider-independent LLM used to generate the raw draft text. */
  readonly llm: LlmClient;
  /** Adapter used whenever the AI path cannot produce a trustworthy draft. */
  readonly fallback: PlanningAdapter;
}

/**
 * Planning adapter backed by a real LLM, with a guaranteed deterministic fallback.
 *
 * The AI path is only trusted when it produces a draft that (a) parses into the exact
 * {@link import("@/lib/planning-generator").DeterministicPlanningDraft} shape, (b) passes
 * {@link validatePlanningDraftQuality} with zero issues, and (c) has no hard grounding
 * issues (e.g. invented employee ids). On ANY problem — LLM failure, unparseable output,
 * a quality issue, a grounding fabrication, or an unexpected throw — it falls back to the
 * injected deterministic adapter, so AI planning can never be worse than the baseline.
 */
export class AiPlanningAdapter implements PlanningAdapter {
  readonly provider = "ai-claude";

  /**
   * Creates an AI planning adapter.
   *
   * @param deps - The LLM client and the deterministic fallback adapter.
   */
  constructor(private readonly deps: AiPlanningAdapterDeps) {}

  /**
   * Generates a planning draft via the LLM, falling back deterministically on any problem.
   *
   * @param input - Company-scoped outcome, employee, and repository context.
   * @returns A successful AI draft (stamped `ai-claude-v1`) or the fallback's result.
   */
  async generate(
    input: OutcomePlanningInput
  ): Promise<PlanningGenerationResult> {
    try {
      const { system, prompt } = buildPlanningPrompt(input);
      const completion = await this.deps.llm.complete({
        system,
        prompt,
        timeoutSeconds: AI_PLANNING_TIMEOUT_SECONDS,
      });

      if (!completion.ok) {
        return this.deps.fallback.generate(input);
      }

      const parsed = parseAiPlanningDraft(completion.text);
      if (!parsed.ok) {
        return this.deps.fallback.generate(input);
      }

      const qualityIssues = validatePlanningDraftQuality(parsed.draft);
      const grounding = checkPlanGrounding(parsed.draft, input);

      if (qualityIssues.length > 0 || grounding.hardIssues.length > 0) {
        return this.deps.fallback.generate(input);
      }

      return { status: "success", draft: parsed.draft };
    } catch {
      return this.deps.fallback.generate(input);
    }
  }
}
