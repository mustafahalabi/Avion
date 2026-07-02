import { getRepositoryValidationView } from "@/lib/repository-validation-service";

/**
 * Pre-run execution readiness verdict for a task's repository.
 *
 * This is a deliberately *soft* gate: only a `blocked` repository validation
 * assessment sets {@link ExecutionReadiness.ready} to false. Missing analysis,
 * a missing repository, or a merely `partial` assessment are surfaced as
 * reasons but never block execution — they are transient/soft states that the
 * autonomous loop should be allowed to proceed through.
 */
export interface ExecutionReadiness {
  /** Whether execution may proceed. Only a `blocked` assessment makes this false. */
  readonly ready: boolean;
  /** Mapped readiness level; `unknown` when there is nothing concrete to assess. */
  readonly readiness: "ready" | "partial" | "blocked" | "unknown";
  /** Human-readable reasons explaining the verdict (missing / unknown signals). */
  readonly reasons: string[];
}

/** Input identifying the company-scoped repository to assess (if any). */
export interface AssessExecutionReadinessInput {
  /** Company that owns the work. */
  readonly companyId: string;
  /** Repository attached to the task, or null when no repository is attached. */
  readonly repositoryId: string | null;
}

/**
 * Assesses whether a task's repository is ready for an unattended execution run.
 *
 * Behavior:
 * - No repository attached (`repositoryId === null`) → `unknown`, `ready: true`.
 *   There is nothing to check, so the gate is skipped rather than blocking.
 * - Repository not found for the company → `unknown`, `ready: true`. The gate
 *   refuses to invent a blocking condition from a lookup miss.
 * - Repository has no analysis snapshot yet → `unknown`, `ready: true`. Missing
 *   analysis is a soft state; the underlying assessment reports `blocked`, but
 *   this gate deliberately does NOT propagate that as a hard block.
 * - Otherwise map `assessment.readiness`: `ready`/`partial` → `ready: true`,
 *   `blocked` → `ready: false`. Reasons are drawn from the assessment's
 *   `missing` and `unknowns` fields.
 *
 * @param input - Company id plus the (possibly null) repository id.
 * @returns The readiness verdict; only a `blocked` assessment blocks execution.
 */
export async function assessExecutionReadiness(
  input: AssessExecutionReadinessInput
): Promise<ExecutionReadiness> {
  if (input.repositoryId === null) {
    return {
      ready: true,
      readiness: "unknown",
      reasons: ["No repository attached to this task; skipping readiness gate."],
    };
  }

  const view = await getRepositoryValidationView({
    repositoryId: input.repositoryId,
    companyId: input.companyId,
  });

  if (view === null) {
    return {
      ready: true,
      readiness: "unknown",
      reasons: [
        `Repository ${input.repositoryId} was not found for this company; skipping readiness gate.`,
      ],
    };
  }

  // Missing analysis is a soft state. The pure assessment reports `blocked`
  // when no analysis has run, but we intentionally do not propagate that as a
  // hard block — we report it as an unknown and allow execution to proceed.
  if (!view.hasAnalysis) {
    const reasons = [
      ...view.missingData,
      ...view.assessment.unknowns,
    ].filter((reason) => reason.length > 0);
    return {
      ready: true,
      readiness: "unknown",
      reasons:
        reasons.length > 0
          ? reasons
          : ["Repository analysis has not been run yet; skipping readiness gate."],
    };
  }

  const { readiness, missing, unknowns } = view.assessment;
  const reasons = [...missing, ...unknowns].filter(
    (reason) => reason.length > 0
  );

  return {
    ready: readiness !== "blocked",
    readiness,
    reasons,
  };
}
