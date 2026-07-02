// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStepId = "company" | "provider" | "repository" | "outcome";

export type OnboardingStepStatus = "complete" | "current" | "upcoming";

/**
 * The derived completion state of each onboarding milestone.
 * Every flag is computed from existing platform state — no dedicated schema.
 */
export interface OnboardingSnapshot {
  companyConfigured: boolean;
  providerConnected: boolean;
  /**
   * GitHub specifically is connected. The repository picker is GitHub-only, so
   * the UI gates it on this even though `providerConnected` (any provider)
   * satisfies the generic provider step.
   */
  githubConnected: boolean;
  repositoryAdded: boolean;
  firstOutcomeSubmitted: boolean;
}

export interface OnboardingStepDescriptor {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly description: string;
  readonly status: OnboardingStepStatus;
}

export interface OnboardingProgress {
  readonly steps: OnboardingStepDescriptor[];
  readonly completedCount: number;
  readonly percentComplete: number;
  readonly isComplete: boolean;
  readonly currentStep: OnboardingStepId | null;
}

// ─── Step definitions ───────────────────────────────────────────────────────

/** Canonical order in which onboarding milestones are completed. */
const STEP_ORDER: readonly OnboardingStepId[] = [
  "company",
  "provider",
  "repository",
  "outcome",
];

const STEP_META: Record<
  OnboardingStepId,
  { title: string; description: string }
> = {
  company: {
    title: "Configure your company",
    description: "Name your company and choose how it operates.",
  },
  provider: {
    title: "Connect a provider",
    description: "Link GitHub so your company can reach your code.",
  },
  repository: {
    title: "Add a repository",
    description: "Point your company at the codebase it will work in.",
  },
  outcome: {
    title: "Submit your first outcome",
    description: "Tell your company what you want built.",
  },
};

/**
 * Maps a step id to its completion flag in the snapshot.
 *
 * @param id - Onboarding step id
 * @param snapshot - Derived completion state
 * @returns True when that milestone is complete
 */
function isStepComplete(
  id: OnboardingStepId,
  snapshot: OnboardingSnapshot
): boolean {
  switch (id) {
    case "company":
      return snapshot.companyConfigured;
    case "provider":
      return snapshot.providerConnected;
    case "repository":
      return snapshot.repositoryAdded;
    case "outcome":
      return snapshot.firstOutcomeSubmitted;
  }
}

// ─── Progress computation ───────────────────────────────────────────────────

/**
 * Derives the guided onboarding progress from a snapshot of platform state.
 * Pure — no I/O; safe to test without a database.
 *
 * Steps are evaluated in canonical order. The first non-complete step becomes
 * `current`; every step after it is `upcoming`. When all steps are complete the
 * flow is finished and `currentStep` is null.
 *
 * @param snapshot - Derived completion state for each milestone
 * @returns Ordered step descriptors plus aggregate progress
 */
export function computeOnboardingProgress(
  snapshot: OnboardingSnapshot
): OnboardingProgress {
  const firstIncompleteIndex = STEP_ORDER.findIndex(
    (id) => !isStepComplete(id, snapshot)
  );
  const isComplete = firstIncompleteIndex === -1;
  const currentIndex = isComplete ? -1 : firstIncompleteIndex;

  const steps: OnboardingStepDescriptor[] = STEP_ORDER.map((id, index) => {
    let status: OnboardingStepStatus;
    if (isComplete || index < currentIndex) {
      status = "complete";
    } else if (index === currentIndex) {
      status = "current";
    } else {
      status = "upcoming";
    }
    return {
      id,
      title: STEP_META[id].title,
      description: STEP_META[id].description,
      status,
    };
  });

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const percentComplete = Math.round(
    (completedCount / STEP_ORDER.length) * 100
  );
  const currentStep = isComplete ? null : STEP_ORDER[currentIndex];

  return { steps, completedCount, percentComplete, isComplete, currentStep };
}
