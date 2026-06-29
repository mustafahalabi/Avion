import { describe, expect, it } from "vitest";
import {
  computeOnboardingProgress,
  type OnboardingSnapshot,
  type OnboardingStepId,
} from "./onboarding-progress";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(
  overrides: Partial<OnboardingSnapshot> = {}
): OnboardingSnapshot {
  return {
    companyConfigured: false,
    providerConnected: false,
    repositoryAdded: false,
    firstOutcomeSubmitted: false,
    ...overrides,
  };
}

const EXPECTED_ORDER: OnboardingStepId[] = [
  "company",
  "provider",
  "repository",
  "outcome",
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("computeOnboardingProgress", () => {
  // ── Step ordering ───────────────────────────────────────────────────────────

  it("emits steps in canonical order", () => {
    const progress = computeOnboardingProgress(makeSnapshot());
    expect(progress.steps.map((s) => s.id)).toEqual(EXPECTED_ORDER);
  });

  it("gives every step a title and description", () => {
    const progress = computeOnboardingProgress(makeSnapshot());
    for (const step of progress.steps) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  // ── Nothing done ────────────────────────────────────────────────────────────

  describe("nothing done", () => {
    it("marks the first step current and the rest upcoming", () => {
      const progress = computeOnboardingProgress(makeSnapshot());
      expect(progress.steps[0].status).toBe("current");
      expect(progress.steps[1].status).toBe("upcoming");
      expect(progress.steps[2].status).toBe("upcoming");
      expect(progress.steps[3].status).toBe("upcoming");
    });

    it("reports zero progress and company as current step", () => {
      const progress = computeOnboardingProgress(makeSnapshot());
      expect(progress.completedCount).toBe(0);
      expect(progress.percentComplete).toBe(0);
      expect(progress.isComplete).toBe(false);
      expect(progress.currentStep).toBe("company");
    });
  });

  // ── Partial completion ──────────────────────────────────────────────────────

  describe("partial completion", () => {
    it("advances current to the first non-complete step", () => {
      const progress = computeOnboardingProgress(
        makeSnapshot({ companyConfigured: true })
      );
      expect(progress.steps[0].status).toBe("complete");
      expect(progress.steps[1].status).toBe("current");
      expect(progress.steps[2].status).toBe("upcoming");
      expect(progress.steps[3].status).toBe("upcoming");
      expect(progress.completedCount).toBe(1);
      expect(progress.percentComplete).toBe(25);
      expect(progress.isComplete).toBe(false);
      expect(progress.currentStep).toBe("provider");
    });

    it("handles two completed leading steps", () => {
      const progress = computeOnboardingProgress(
        makeSnapshot({ companyConfigured: true, providerConnected: true })
      );
      expect(progress.completedCount).toBe(2);
      expect(progress.percentComplete).toBe(50);
      expect(progress.currentStep).toBe("repository");
      expect(progress.steps[2].status).toBe("current");
    });
  });

  // ── Exactly one current step ─────────────────────────────────────────────────

  it("has exactly one current step while incomplete", () => {
    const snapshots: OnboardingSnapshot[] = [
      makeSnapshot(),
      makeSnapshot({ companyConfigured: true }),
      makeSnapshot({ companyConfigured: true, providerConnected: true }),
      makeSnapshot({
        companyConfigured: true,
        providerConnected: true,
        repositoryAdded: true,
      }),
    ];
    for (const snapshot of snapshots) {
      const progress = computeOnboardingProgress(snapshot);
      const currentCount = progress.steps.filter(
        (s) => s.status === "current"
      ).length;
      expect(currentCount).toBe(1);
    }
  });

  // ── All done ─────────────────────────────────────────────────────────────────

  describe("all done", () => {
    const progress = computeOnboardingProgress(
      makeSnapshot({
        companyConfigured: true,
        providerConnected: true,
        repositoryAdded: true,
        firstOutcomeSubmitted: true,
      })
    );

    it("is complete at 100 percent with no current step", () => {
      expect(progress.isComplete).toBe(true);
      expect(progress.completedCount).toBe(4);
      expect(progress.percentComplete).toBe(100);
      expect(progress.currentStep).toBeNull();
    });

    it("marks every step complete and none current", () => {
      expect(progress.steps.every((s) => s.status === "complete")).toBe(true);
      expect(progress.steps.some((s) => s.status === "current")).toBe(false);
    });
  });
});
