/**
 * GitHub workflow phases tracked per task/session for Avion.
 *
 * Phases represent the implementation lifecycle from planning through merge.
 */
export const GITHUB_WORKFLOW_PHASES = [
  "planned",
  "running",
  "reviewed",
  "merged",
] as const;

export type GithubWorkflowPhase = (typeof GITHUB_WORKFLOW_PHASES)[number];

export type GithubWorkflowPhaseStatus = "complete" | "current" | "upcoming";

/**
 * One step in the GitHub workflow progress UI.
 */
export interface GithubWorkflowPhaseState {
  readonly phase: GithubWorkflowPhase;
  readonly status: GithubWorkflowPhaseStatus;
  readonly label: string;
  readonly detail: string | null;
}

/**
 * Input used to derive the current GitHub workflow phase for a task.
 */
export interface GithubWorkflowStatusInput {
  readonly taskStatus: string;
  readonly sessionStatus: string | null;
  readonly prStatus: string | null;
  readonly mergeStatus: string | null;
  readonly reviewStatus: string | null;
}

const PHASE_LABELS: Record<GithubWorkflowPhase, string> = {
  planned: "Planned",
  running: "Running",
  reviewed: "Reviewed",
  merged: "Merged",
};

/**
 * Returns the active GitHub workflow phase for a task based on stored state.
 *
 * @param input - Task, session, PR, and review metadata.
 * @returns The current workflow phase.
 *
 * @example
 * ```ts
 * deriveGithubWorkflowPhase({
 *   taskStatus: "in-review",
 *   sessionStatus: "completed",
 *   prStatus: "open",
 *   mergeStatus: "pending",
 *   reviewStatus: null,
 * }); // "running"
 * ```
 */
export function deriveGithubWorkflowPhase(
  input: GithubWorkflowStatusInput
): GithubWorkflowPhase {
  if (input.prStatus === "merged" || input.mergeStatus === "merged") {
    return "merged";
  }

  if (
    input.reviewStatus === "approved" ||
    input.taskStatus === "in-review" ||
    input.taskStatus === "done"
  ) {
    return "reviewed";
  }

  if (
    input.sessionStatus === "prepared" ||
    input.sessionStatus === "running" ||
    input.taskStatus === "in-progress" ||
    input.sessionStatus === "completed"
  ) {
    return "running";
  }

  return "planned";
}

/**
 * Builds detail text for the current workflow phase.
 *
 * @param phase - Active workflow phase.
 * @param input - Source metadata for detail strings.
 * @returns Human-readable detail or null when nothing extra applies.
 */
function buildPhaseDetail(
  phase: GithubWorkflowPhase,
  input: GithubWorkflowStatusInput
): string | null {
  switch (phase) {
    case "planned":
      return input.sessionStatus === "queued"
        ? "Execution session queued"
        : "Ready for implementation brief";
    case "running":
      if (input.sessionStatus === "prepared") return "Brief prepared — agent not started";
      if (input.sessionStatus === "running") return "Agent execution in progress";
      if (input.prStatus === "open" || input.prStatus === "draft") {
        return "PR open — awaiting review";
      }
      return "Implementation recorded — open PR to continue";
    case "reviewed":
      if (input.reviewStatus === "approved") return "Code review approved";
      if (input.taskStatus === "done") return "Task complete — PR not merged yet";
      return "In code review";
    case "merged":
      return "Pull request merged";
    default:
      return null;
  }
}

/**
 * Builds the four-phase GitHub workflow progress state for UI rendering.
 *
 * @param input - Task, session, PR, and review metadata.
 * @returns Ordered phase states with complete/current/upcoming markers.
 *
 * @example
 * ```ts
 * const steps = buildGithubWorkflowPhaseStates({
 *   taskStatus: "todo",
 *   sessionStatus: null,
 *   prStatus: null,
 *   mergeStatus: null,
 *   reviewStatus: null,
 * });
 * expect(steps[0]?.status).toBe("current");
 * ```
 */
export function buildGithubWorkflowPhaseStates(
  input: GithubWorkflowStatusInput
): readonly GithubWorkflowPhaseState[] {
  const current = deriveGithubWorkflowPhase(input);
  const currentIndex = GITHUB_WORKFLOW_PHASES.indexOf(current);

  return GITHUB_WORKFLOW_PHASES.map((phase, index) => {
    let status: GithubWorkflowPhaseStatus = "upcoming";
    if (index < currentIndex) status = "complete";
    else if (index === currentIndex) status = "current";

    return {
      phase,
      status,
      label: PHASE_LABELS[phase],
      detail: index === currentIndex ? buildPhaseDetail(phase, input) : null,
    };
  });
}
