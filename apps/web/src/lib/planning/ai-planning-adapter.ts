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

/** Max stored length of a fallback reason (persisted to a text column). */
const MAX_FALLBACK_REASON_LENGTH = 500;

/**
 * Truncates a fallback reason for storage.
 *
 * @param reason - Raw reason text.
 * @returns The reason, capped at {@link MAX_FALLBACK_REASON_LENGTH} with an ellipsis.
 */
function truncateReason(reason: string): string {
  const trimmed = reason.trim();
  return trimmed.length > MAX_FALLBACK_REASON_LENGTH
    ? `${trimmed.slice(0, MAX_FALLBACK_REASON_LENGTH - 1)}…`
    : trimmed;
}

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
        return this.fallbackWith(input, `LLM completion failed: ${completion.error}`);
      }

      const parsed = parseAiPlanningDraft(completion.text);
      if (!parsed.ok) {
        return this.fallbackWith(
          input,
          `AI output did not parse into a valid plan: ${parsed.error}`
        );
      }

      const qualityIssues = validatePlanningDraftQuality(parsed.draft);
      const grounding = checkPlanGrounding(parsed.draft, input);

      if (qualityIssues.length > 0 || grounding.hardIssues.length > 0) {
        const reasons = [
          ...qualityIssues.map((issue) => issue.message),
          ...grounding.hardIssues,
        ];
        return this.fallbackWith(
          input,
          `AI plan failed validation: ${reasons.slice(0, 3).join("; ")}`
        );
      }

      return {
        status: "success",
        draft: parsed.draft,
        provenance: { provider: "ai", providerAttempted: "ai", fallbackReason: null },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.fallbackWith(input, `AI planning threw: ${message}`);
    }
  }

  /**
   * Runs the deterministic fallback and stamps provenance recording that the AI
   * path was attempted and why it fell back (MUS-271). A failed fallback is
   * returned as-is (nothing to attribute).
   *
   * @param input - Company-scoped outcome context.
   * @param reason - Why the AI path could not be trusted.
   * @returns The fallback's result, provenance-stamped on success.
   */
  private async fallbackWith(
    input: OutcomePlanningInput,
    reason: string
  ): Promise<PlanningGenerationResult> {
    const result = await this.deps.fallback.generate(input);
    if (result.status !== "success") {
      return result;
    }
    return {
      ...result,
      provenance: {
        provider: "deterministic",
        providerAttempted: "ai",
        fallbackReason: truncateReason(reason),
      },
    };
  }
}
