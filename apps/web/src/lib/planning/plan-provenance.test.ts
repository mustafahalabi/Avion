import { describe, expect, it } from "vitest";

import { describePlanProvenance } from "./plan-provenance";

describe("describePlanProvenance (MUS-271)", () => {
  it("labels a genuine AI plan", () => {
    expect(
      describePlanProvenance({
        provider: "ai",
        providerAttempted: "ai",
        fallbackReason: null,
      })
    ).toEqual({ label: "AI-planned", tone: "ai", detail: null });
  });

  it("labels a plain deterministic plan", () => {
    expect(
      describePlanProvenance({
        provider: "deterministic",
        providerAttempted: null,
        fallbackReason: null,
      })
    ).toEqual({ label: "Deterministic", tone: "deterministic", detail: null });
  });

  it("labels an AI→deterministic fallback and surfaces the reason", () => {
    const badge = describePlanProvenance({
      provider: "deterministic",
      providerAttempted: "ai",
      fallbackReason: "AI plan failed validation: Task task:1 description is too short",
    });
    expect(badge.label).toBe("Deterministic (AI fallback)");
    expect(badge.tone).toBe("fallback");
    expect(badge.detail).toContain("failed validation");
  });

  it("treats a legacy row with no provenance as deterministic", () => {
    expect(
      describePlanProvenance({
        provider: null,
        providerAttempted: null,
        fallbackReason: null,
      })
    ).toEqual({ label: "Deterministic", tone: "deterministic", detail: null });
  });
});
