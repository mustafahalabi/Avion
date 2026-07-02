/**
 * Human-facing description of a planning draft's provenance (MUS-271).
 *
 * The charter guarantees "AI planning, validated, with a deterministic fallback".
 * That fallback used to be silent: a CEO could not tell an AI plan from a plan the
 * template produced after the AI attempt failed a gate. This pure helper turns the
 * persisted provenance columns into a badge label + tone, used by both the plan
 * timeline summary and the plan-review UI.
 */

/** A renderable provenance badge for a planning draft. */
export interface PlanProvenanceBadge {
  /** Short label, e.g. "AI-planned" or "Deterministic (AI fallback)". */
  readonly label: string;
  /** Rendering tone: a genuine AI plan, a plain deterministic plan, or an AI→deterministic fallback. */
  readonly tone: "ai" | "deterministic" | "fallback";
  /** The fallback reason when this was an AI→deterministic fallback, else null. */
  readonly detail: string | null;
}

/** The persisted provenance columns (all nullable on legacy rows). */
export interface PlanProvenanceInput {
  readonly provider: string | null;
  readonly providerAttempted: string | null;
  readonly fallbackReason: string | null;
}

/**
 * Describes a planning draft's provenance for display.
 *
 * @param input - The persisted `provider` / `providerAttempted` / `fallbackReason` columns.
 * @returns A badge label, tone, and optional fallback detail.
 * @example
 * ```ts
 * describePlanProvenance({ provider: "deterministic", providerAttempted: "ai", fallbackReason: "AI plan failed validation: ..." });
 * // → { label: "Deterministic (AI fallback)", tone: "fallback", detail: "AI plan failed validation: ..." }
 * ```
 */
export function describePlanProvenance(
  input: PlanProvenanceInput
): PlanProvenanceBadge {
  if (input.provider === "ai") {
    return { label: "AI-planned", tone: "ai", detail: null };
  }
  if (input.providerAttempted === "ai") {
    return {
      label: "Deterministic (AI fallback)",
      tone: "fallback",
      detail: input.fallbackReason,
    };
  }
  return { label: "Deterministic", tone: "deterministic", detail: null };
}
