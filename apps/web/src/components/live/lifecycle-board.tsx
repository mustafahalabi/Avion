import type { LifecycleBoard } from "@/lib/work-lifecycle";
import { cn } from "@/lib/utils";
import { STAGE_STYLE } from "./stage-style";
import { WorkItemCard } from "./work-item-card";

interface LifecycleBoardViewProps {
  readonly board: LifecycleBoard;
}

/**
 * The Live board — one column per lifecycle stage, cards ordered live-first.
 * Cards "move" rightward across columns on each auto-refresh as the company
 * advances the work.
 */
export function LifecycleBoardView({ board }: LifecycleBoardViewProps) {
  return (
    <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
      {board.columns.map((col) => {
        const style = STAGE_STYLE[col.stage];
        const Icon = style.icon;
        const hidden = col.total - col.items.length;

        return (
          <div
            key={col.stage}
            className="flex w-[260px] shrink-0 flex-col rounded-xl border border-neutral-800 bg-neutral-950"
          >
            <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2.5">
              <Icon className={cn("h-3.5 w-3.5 shrink-0", style.accent)} aria-hidden />
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  style.accent
                )}
              >
                {col.label}
              </span>
              <span
                className={cn(
                  "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  col.total > 0 ? style.chip : "bg-neutral-900 text-neutral-600"
                )}
              >
                {col.total}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {col.items.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-8">
                  <p className="text-[11px] text-neutral-700">{col.blurb}</p>
                </div>
              ) : (
                col.items.map((item) => <WorkItemCard key={item.id} item={item} />)
              )}
              {hidden > 0 && (
                <p className="px-1 py-1 text-center text-[11px] text-neutral-600">
                  +{hidden} more
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
