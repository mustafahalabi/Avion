import Link from "next/link";
import { GitBranch, GitPullRequest } from "lucide-react";

import type { WorkItemView } from "@/lib/work-lifecycle";
import { cn } from "@/lib/utils";

interface WorkItemCardProps {
  readonly item: WorkItemView;
}

/**
 * One card on the Live board. The left accent + status dot encode state at a
 * glance — emerald (working now), amber (waiting on you), red (needs a re-loop)
 * — and the status line says exactly what is happening.
 */
export function WorkItemCard({ item }: WorkItemCardProps) {
  const accent = item.isBlocked
    ? "border-l-red-500/70"
    : item.awaitingApproval
    ? "border-l-amber-500/70"
    : item.isLive
    ? "border-l-emerald-500/70"
    : "border-l-neutral-800";

  const dot = item.isBlocked
    ? "bg-red-400"
    : item.awaitingApproval
    ? "bg-amber-400"
    : item.isLive
    ? "bg-emerald-400 animate-pulse"
    : "bg-neutral-600";

  const statusColor = item.isBlocked
    ? "text-red-400/90"
    : item.awaitingApproval
    ? "text-amber-400/90"
    : "text-neutral-500";

  return (
    <Link
      href={item.href}
      className={cn(
        "group block rounded-lg border border-l-2 border-neutral-800 bg-neutral-900 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800",
        accent
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.kind === "plan" && (
              <span className="rounded bg-neutral-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-neutral-300">
                Plan
              </span>
            )}
            <p className="truncate text-[13px] font-medium leading-snug text-neutral-200">
              {item.title}
            </p>
          </div>

          <p className={cn("mt-0.5 text-[11px] leading-snug", statusColor)}>
            {item.statusLine}
          </p>

          {(item.context || item.branchName || item.prNumber || item.assigneeName) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {item.context && (
                <span className="max-w-[140px] truncate text-[10px] text-neutral-600">
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
              {item.assigneeName && (
                <span
                  className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[9px] font-semibold text-neutral-300"
                  title={item.assigneeName}
                >
                  {item.assigneeName[0]?.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
