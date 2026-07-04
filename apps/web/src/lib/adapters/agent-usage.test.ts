import { describe, expect, it } from "vitest";

import { parseClaudeResultUsage, sumAgentUsage } from "./agent-usage";

describe("parseClaudeResultUsage", () => {
  it("extracts real cost + token counts from a claude result object", () => {
    const usage = parseClaudeResultUsage({
      total_cost_usd: 0.057572,
      usage: {
        input_tokens: 3154,
        output_tokens: 4,
        cache_read_input_tokens: 15084,
        cache_creation_input_tokens: 3416,
      },
      modelUsage: { "claude-opus-4-8[1m]": { costUSD: 0.057572 } },
    });
    expect(usage).toEqual({
      model: "claude-opus-4-8[1m]",
      inputTokens: 3154,
      outputTokens: 4,
      cachedInputTokens: 15084 + 3416,
      costUsd: 0.057572,
    });
  });

  it("falls back to summing per-model costUSD when total_cost_usd is absent", () => {
    const usage = parseClaudeResultUsage({
      usage: { input_tokens: 10, output_tokens: 2 },
      modelUsage: {
        "model-a": { costUSD: 0.02 },
        "model-b": { costUSD: 0.03 },
      },
    });
    expect(usage?.costUsd).toBeCloseTo(0.05);
    expect(usage?.model).toBe("model-a");
  });

  it("returns null when there is no usage or cost", () => {
    expect(parseClaudeResultUsage({ type: "result" })).toBeNull();
    expect(parseClaudeResultUsage(null)).toBeNull();
    expect(parseClaudeResultUsage("nope")).toBeNull();
  });

  it("tolerates missing token fields (coerces to 0)", () => {
    const usage = parseClaudeResultUsage({ total_cost_usd: 0.5, usage: {} });
    expect(usage).toEqual({
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      costUsd: 0.5,
    });
  });
});

describe("sumAgentUsage", () => {
  it("adds token counts and cost across samples", () => {
    const total = sumAgentUsage([
      { model: "a", inputTokens: 10, outputTokens: 5, cachedInputTokens: 100, costUsd: 0.1 },
      { model: "b", inputTokens: 20, outputTokens: 7, cachedInputTokens: 200, costUsd: 0.2 },
    ]);
    expect(total).toEqual({
      model: null,
      inputTokens: 30,
      outputTokens: 12,
      cachedInputTokens: 300,
      costUsd: 0.30000000000000004, // float add
    });
  });

  it("returns a zero aggregate for no samples", () => {
    expect(sumAgentUsage([])).toEqual({
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      costUsd: 0,
    });
  });
});
