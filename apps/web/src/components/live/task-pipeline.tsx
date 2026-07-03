import { cn } from "@/lib/utils";
import type { WorkStage } from "@/lib/work-lifecycle";

/**
 * A compact horizontal stepper showing where a work item sits in the delivery
 * pipeline: Queue → Build → Review → QA → Done. Each segment reads its state
 * from the item's current {@link WorkStage} — completed stages fill forest,
 * the active stage pulses vermilion (or turns brick when blocked), later stages
 * stay muted. Pure/presentational so it renders on the server and in the SSE
 * board alike.
 */

const STEPS: { stage: WorkStage; label: string }[] = [
  { stage: "queued", label: "Queue" },
  { stage: "building", label: "Build" },
  { stage: "review", label: "Review" },
  { stage: "qa", label: "QA" },
  { stage: "done", label: "Done" },
];

type StepState = "done" | "active" | "pending" | "fail";

export function TaskPipeline({
  stage,
  isBlocked = false,
  className,
}: {
  stage: WorkStage;
  isBlocked?: boolean;
  className?: string;
}) {
  // planning items sit before the task pipeline → everything pending.
  const currentIdx = STEPS.findIndex((s) => s.stage === stage);

  return (
    <div
      className={cn(
        "flex border-t border-neutral-700 font-mono text-[9px] uppercase tracking-wider",
        className
      )}
      role="list"
      aria-label="Delivery pipeline"
    >
      {STEPS.map(({ stage: s, label }, idx) => {
        const state: StepState =
          currentIdx === -1 || idx > currentIdx
            ? "pending"
            : idx < currentIdx
            ? "done"
            : isBlocked
            ? "fail"
            : "active";

        return (
          <div
            key={s}
            role="listitem"
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-r border-neutral-800 px-1.5 py-1.5 last:border-r-0",
              state === "done" && "text-neutral-200",
              state === "active" && "bg-brand-500/10 text-brand-400",
              state === "fail" && "bg-danger-500/10 text-danger-400",
              state === "pending" && "text-neutral-500"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                state === "done" && "bg-success-500",
                state === "active" && "bg-brand-500 animate-pulse",
                state === "fail" && "bg-danger-500",
                state === "pending" && "bg-neutral-700"
              )}
              aria-hidden="true"
            />
            {label}
          </div>
        );
      })}
    </div>
  );
}
