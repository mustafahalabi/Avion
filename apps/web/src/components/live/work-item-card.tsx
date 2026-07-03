import Link from "next/link";
import { GitBranch, GitPullRequest } from "lucide-react";

import type { WorkItemView } from "@/lib/work-lifecycle";
import { cn } from "@/lib/utils";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { AdapterBadge } from "@/components/ui/badge";
import { TaskPipeline } from "@/components/live/task-pipeline";

interface WorkItemCardProps {
  readonly item: WorkItemView;
}

/**
 * One card on the Live board. The left accent + status dot encode state at a
 * glance — vermilion (working now), amber (waiting on you / stale), brick (needs
 * a re-loop) — and the top row now names the real agent and ticks its elapsed
 * time so the CEO sees WHO is working WHERE and for HOW LONG. A pipeline stepper
 * shows how far the work has moved.
 */
export function WorkItemCard({ item }: WorkItemCardProps) {
  const accent = item.isBlocked
    ? "border-l-danger-500"
    : item.awaitingApproval || item.isStale
    ? "border-l-warning-500"
    : item.isLive
    ? "border-l-brand-500"
    : "border-l-neutral-700";

  const dot = item.isBlocked
    ? "bg-danger-500"
    : item.awaitingApproval || item.isStale
    ? "bg-warning-500"
    : item.isLive
    ? "bg-brand-500 animate-pulse"
    : "bg-neutral-600";

  const statusColor = item.isBlocked
    ? "text-danger-400"
    : item.awaitingApproval || item.isStale
    ? "text-warning-400"
    : "text-neutral-500";

  return (
    <Link
      href={item.href}
      className={cn(
        "group block border border-l-2 border-neutral-800 bg-neutral-900 transition-colors hover:bg-neutral-800",
        accent
      )}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {item.kind === "plan" && (
                <span className="border border-neutral-700 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wide text-neutral-300">
                  Plan
                </span>
              )}
              <p className="truncate text-[13px] font-medium leading-snug text-neutral-100">
                {item.title}
              </p>
              {/* WHO + HOW LONG — the two signals that were missing everywhere. */}
              {item.isLive && item.startedAt && (
                <ElapsedTime
                  startedAt={item.startedAt}
                  className={cn(
                    "ml-auto shrink-0 text-[11px] font-semibold",
                    item.isStale ? "text-warning-400" : "text-brand-400"
                  )}
                />
              )}
            </div>

            <p className={cn("mt-0.5 text-[11px] leading-snug", statusColor)}>
              {item.isStale ? "Running long — may be stuck · " : ""}
              {item.statusLine}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {item.agentType && <AdapterBadge agentType={item.agentType} />}
              {item.context && (
                <span className="max-w-[140px] truncate text-[10px] text-neutral-500">
                  {item.context}
                </span>
              )}
              {item.branchName && (
                <span className="inline-flex max-w-[130px] items-center gap-0.5 truncate font-mono text-[10px] text-neutral-500">
                  <GitBranch className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  <span className="truncate">{item.branchName}</span>
                </span>
              )}
              {typeof item.prNumber === "number" && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-500">
                  <GitPullRequest className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  #{item.prNumber}
                </span>
              )}
              {item.totalActiveMs != null && item.totalActiveMs > 0 && !item.isLive && (
                <span className="font-mono text-[10px] text-neutral-500">
                  <ElapsedTime ms={item.totalActiveMs} /> total
                </span>
              )}
              {item.assigneeName && (
                <span
                  className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[9px] font-semibold text-neutral-200"
                  title={item.assigneeName}
                >
                  {item.assigneeName[0]?.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {item.kind === "task" && (
        <TaskPipeline stage={item.stage} isBlocked={item.isBlocked} />
      )}
    </Link>
  );
}
