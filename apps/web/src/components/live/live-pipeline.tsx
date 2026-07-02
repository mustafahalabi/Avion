import { Fragment } from "react";
import { ChevronRight } from "lucide-react";

import type { LifecycleBoard } from "@/lib/work-lifecycle";
import { cn } from "@/lib/utils";
import { STAGE_STYLE } from "./stage-style";

interface LivePipelineProps {
  readonly board: LifecycleBoard;
  readonly className?: string;
}

/**
 * Horizontal overview of the whole pipeline — one chip per lifecycle stage with
 * its live count, joined by flow chevrons. The "see the entire thing at a
 * glance" header for the Live board and the Control Center widget.
 */
export function LivePipeline({ board, className }: LivePipelineProps) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {board.columns.map((col, index) => {
        const style = STAGE_STYLE[col.stage];
        const Icon = style.icon;
        const active = col.total > 0;
        const hasLive = col.items.some((item) => item.isLive);
        const isLast = index === board.columns.length - 1;

        return (
          <Fragment key={col.stage}>
            <div
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors",
                active
                  ? "border-neutral-800 bg-neutral-900"
                  : "border-transparent bg-transparent"
              )}
              title={col.blurb}
            >
              <span className="relative flex">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    active ? style.accent : "text-neutral-700"
                  )}
                  aria-hidden
                />
                {hasLive && (
                  <span className="absolute -right-1 -top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-neutral-200" : "text-neutral-600"
                )}
              >
                {col.label}
              </span>
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                  active ? style.chip : "bg-neutral-900 text-neutral-700"
                )}
              >
                {col.total}
              </span>
            </div>
            {!isLast && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-neutral-700"
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
