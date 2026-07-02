import { afterEach, describe, expect, it, vi } from "vitest";

import { AiPlanningAdapter } from "./ai-planning-adapter";
import { DeterministicPlanningAdapter } from "./deterministic-planning-adapter";
import {
  isPlanningProviderId,
  resolvePlanningAdapter,
  resolvePlanningProviderId,
} from "./planning-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolvePlanningProviderId", () => {
  it("prefers an explicit override over the environment", () => {
    vi.stubEnv("EOS_PLANNING_PROVIDER", "deterministic");
    expect(resolvePlanningProviderId({ provider: "ai" })).toBe("ai");
  });

  it("falls back to the environment when the override is null", () => {
    vi.stubEnv("EOS_PLANNING_PROVIDER", "ai");
    expect(resolvePlanningProviderId({ provider: null })).toBe("ai");
  });

  it("defaults to deterministic without an override or environment value", () => {
    vi.stubEnv("EOS_PLANNING_PROVIDER", undefined);
    expect(resolvePlanningProviderId()).toBe("deterministic");
    expect(resolvePlanningProviderId({ provider: null })).toBe("deterministic");
  });

  it("normalizes unknown provider values to deterministic", () => {
    expect(resolvePlanningProviderId({ provider: "gpt" })).toBe("deterministic");
  });
});

describe("resolvePlanningAdapter", () => {
  it("returns the AI adapter for an explicit ai override", () => {
    expect(resolvePlanningAdapter({ provider: "ai" })).toBeInstanceOf(
      AiPlanningAdapter
    );
  });

  it("returns the deterministic adapter by default", () => {
    vi.stubEnv("EOS_PLANNING_PROVIDER", undefined);
    expect(resolvePlanningAdapter()).toBeInstanceOf(DeterministicPlanningAdapter);
  });
});

describe("isPlanningProviderId", () => {
  it("accepts every supported provider id", () => {
    expect(isPlanningProviderId("deterministic")).toBe(true);
    expect(isPlanningProviderId("ai")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPlanningProviderId("default")).toBe(false);
    expect(isPlanningProviderId("AI")).toBe(false);
    expect(isPlanningProviderId("")).toBe(false);
  });
});
