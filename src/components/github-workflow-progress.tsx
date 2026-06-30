import { Check, Circle, GitMerge } from "lucide-react";

import type { GithubWorkflowPhaseState } from "@/lib/github-workflow-status";
import { cn } from "@/lib/utils";

interface GithubWorkflowProgressProps {
  readonly phases: readonly GithubWorkflowPhaseState[];
}

/**
 * Horizontal stepper showing planned → running → reviewed → merged workflow.
 *
 * @param props - Ordered phase states from `buildGithubWorkflowPhaseStates`.
 * @returns GitHub workflow progress UI.
 *
 * @example
 * ```tsx
 * <GithubWorkflowProgress phases={buildGithubWorkflowPhaseStates(input)} />
 * ```
 */
export function GithubWorkflowProgress({ phases }: GithubWorkflowProgressProps) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex items-start gap-0">
        {phases.map((phase, index) => {
          const isLast = index === phases.length - 1;
          return (
            <li key={phase.phase} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <PhaseIcon phase={phase} />
                <p
                  className={cn(
                    "mt-2 text-center text-[11px] font-medium",
                    phase.status === "current"
                      ? "text-neutral-100"
                      : phase.status === "complete"
                      ? "text-neutral-400"
                      : "text-neutral-600"
                  )}
                >
                  {phase.label}
                </p>
                {phase.detail && phase.status === "current" && (
                  <p className="mt-0.5 max-w-[120px] text-center text-[10px] leading-snug text-neutral-500">
                    {phase.detail}
                  </p>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mt-3.5 h-px flex-1",
                    phase.status === "complete" ? "bg-emerald-600/60" : "bg-neutral-800"
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PhaseIcon({ phase }: { phase: GithubWorkflowPhaseState }) {
  if (phase.status === "complete") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40">
        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
      </div>
    );
  }

  if (phase.phase === "merged" && phase.status === "current") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-500/15 ring-1 ring-neutral-500/40">
        <GitMerge className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full ring-1",
        phase.status === "current"
          ? "bg-blue-500/15 ring-blue-500/40"
          : "bg-neutral-900 ring-neutral-800"
      )}
    >
      <Circle
        className={cn(
          "h-2 w-2 fill-current",
          phase.status === "current" ? "text-blue-400" : "text-neutral-700"
        )}
        aria-hidden
      />
    </div>
  );
}
