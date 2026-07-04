/**
 * Per-outcome spend ceiling (Goal 3) — pure decision logic.
 *
 * Retry budgets bound *correctness* (how many times a task re-runs); this bounds
 * *spend* (how many real dollars an outcome may burn) so a runaway outcome can't
 * quietly cost a fortune. The effective ceiling is the company's
 * `CompanySettings.spendCeilingUsd` when set, else the
 * `EOS_OUTCOME_SPEND_CEILING_USD` env default, else none. No I/O here — the
 * worker reads the outcome's real spend from the usage ledger and calls this.
 */

/** The ceiling decision for an outcome given its spend so far. */
export interface SpendCeilingDecision {
  /** Effective ceiling in USD, or null when no ceiling applies. */
  readonly ceilingUsd: number | null;
  /** Real dollars already spent on this outcome. */
  readonly spentUsd: number;
  /** Dollars left before the ceiling, or null when no ceiling applies. */
  readonly remainingUsd: number | null;
  /** True when spend has reached/exceeded the ceiling — halt before spending more. */
  readonly exceeded: boolean;
}

/**
 * Resolves the effective spend ceiling from the company setting and env default.
 *
 * @param companySetting - `CompanySettings.spendCeilingUsd`, or null/undefined.
 * @param envValue - The `EOS_OUTCOME_SPEND_CEILING_USD` value (defaults to env).
 * @returns A positive ceiling in USD, or null when none is configured.
 */
export function resolveSpendCeilingUsd(
  companySetting: number | null | undefined,
  envValue: string | undefined = process.env.EOS_OUTCOME_SPEND_CEILING_USD
): number | null {
  if (companySetting != null && companySetting > 0) return companySetting;
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Decides whether an outcome has hit its spend ceiling.
 *
 * @param spentUsd - Real dollars spent on the outcome so far.
 * @param ceilingUsd - Effective ceiling (null → no ceiling, never exceeded).
 * @returns The ceiling decision.
 */
export function evaluateSpendCeiling(
  spentUsd: number,
  ceilingUsd: number | null
): SpendCeilingDecision {
  if (ceilingUsd == null) {
    return { ceilingUsd: null, spentUsd, remainingUsd: null, exceeded: false };
  }
  return {
    ceilingUsd,
    spentUsd,
    remainingUsd: Math.max(0, ceilingUsd - spentUsd),
    exceeded: spentUsd >= ceilingUsd,
  };
}
