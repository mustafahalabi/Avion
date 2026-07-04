import { describe, expect, it } from "vitest";

import { evaluateSpendCeiling, resolveSpendCeilingUsd } from "./spend-ceiling";

describe("resolveSpendCeilingUsd", () => {
  it("prefers a positive company setting", () => {
    expect(resolveSpendCeilingUsd(5, "10")).toBe(5);
  });

  it("falls back to the env default when the company setting is null", () => {
    expect(resolveSpendCeilingUsd(null, "10")).toBe(10);
    expect(resolveSpendCeilingUsd(undefined, "2.5")).toBe(2.5);
  });

  it("returns null when neither is a positive number", () => {
    expect(resolveSpendCeilingUsd(null, undefined)).toBeNull();
    expect(resolveSpendCeilingUsd(0, "0")).toBeNull();
    expect(resolveSpendCeilingUsd(-3, "not-a-number")).toBeNull();
  });
});

describe("evaluateSpendCeiling", () => {
  it("never exceeds when there is no ceiling", () => {
    const d = evaluateSpendCeiling(999, null);
    expect(d).toEqual({ ceilingUsd: null, spentUsd: 999, remainingUsd: null, exceeded: false });
  });

  it("is under budget below the ceiling", () => {
    const d = evaluateSpendCeiling(3, 10);
    expect(d.exceeded).toBe(false);
    expect(d.remainingUsd).toBe(7);
  });

  it("is exceeded at or over the ceiling", () => {
    expect(evaluateSpendCeiling(10, 10).exceeded).toBe(true);
    expect(evaluateSpendCeiling(12, 10).exceeded).toBe(true);
    expect(evaluateSpendCeiling(12, 10).remainingUsd).toBe(0);
  });
});
