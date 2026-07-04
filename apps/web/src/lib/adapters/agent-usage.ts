/**
 * Real token/cost usage captured from an agent CLI run (Goal 3 — observability).
 *
 * The Claude CLI reports true usage when invoked with `--output-format json`
 * (planner) or `stream-json` (executor): a final `result` event carrying
 * `total_cost_usd` and a `usage` block with input/output/cache token counts, plus
 * a `modelUsage` map keyed by model id. This module is the pure extractor for
 * that shape — no I/O — so it is unit-testable and shared by both the executor
 * adapter and the planner CLI client. Numbers here are always REAL (from the
 * model), never estimated.
 */

/** Normalized usage from a single agent run. */
export interface AgentUsage {
  /** Model id the run billed against, or null when the CLI didn't report one. */
  readonly model: string | null;
  /** Non-cached input tokens. */
  readonly inputTokens: number;
  /** Output tokens. */
  readonly outputTokens: number;
  /** Cache read + cache-creation input tokens (billed at reduced/again rates). */
  readonly cachedInputTokens: number;
  /** Real dollar cost the CLI reported for the run. */
  readonly costUsd: number;
}

/** Coerces an unknown to a finite number, or 0. */
function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Extracts {@link AgentUsage} from a parsed Claude CLI `result` object (the shape
 * emitted by `--output-format json`, and by the final `type:"result"` event of
 * `--output-format stream-json`).
 *
 * @param obj - A parsed result object (unknown shape).
 * @returns Normalized usage, or null when the object carries no usage/cost.
 */
export function parseClaudeResultUsage(obj: unknown): AgentUsage | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;

  const usage = record.usage as Record<string, unknown> | undefined;
  const totalCost = record.total_cost_usd;
  // No usage block and no cost → nothing real to record.
  if (!usage && typeof totalCost !== "number") return null;

  const inputTokens = num(usage?.input_tokens);
  const outputTokens = num(usage?.output_tokens);
  const cachedInputTokens =
    num(usage?.cache_read_input_tokens) + num(usage?.cache_creation_input_tokens);

  // Prefer the explicit top-level cost; else sum per-model costUSD.
  let costUsd = num(totalCost);
  const modelUsage = record.modelUsage as Record<string, unknown> | undefined;
  let model: string | null = null;
  if (modelUsage && typeof modelUsage === "object") {
    const entries = Object.entries(modelUsage);
    if (entries.length > 0) {
      model = entries[0][0];
      if (costUsd === 0) {
        costUsd = entries.reduce(
          (sum, [, v]) => sum + num((v as Record<string, unknown>)?.costUSD),
          0
        );
      }
    }
  }

  return { model, inputTokens, outputTokens, cachedInputTokens, costUsd };
}

/** Sums a list of usage samples into one aggregate (model set to null). */
export function sumAgentUsage(samples: readonly AgentUsage[]): AgentUsage {
  return samples.reduce<AgentUsage>(
    (acc, u) => ({
      model: null,
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cachedInputTokens: acc.cachedInputTokens + u.cachedInputTokens,
      costUsd: acc.costUsd + u.costUsd,
    }),
    { model: null, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 }
  );
}
