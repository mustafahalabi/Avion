import Link from "next/link";
import { GitBranch, GitPullRequest, FileCode2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { STAGE_META, type WorkItemView } from "@/lib/work-lifecycle";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { AdapterBadge } from "@/components/ui/badge";
import { TaskPipeline } from "@/components/live/task-pipeline";

/**
 * The signature unit of Mission Control: one running (or in-flight) agent shown
 * in full — WHO (real adapter + assigned role), WHERE (task, project, repo/branch,
 * PR), and HOW LONG (a live-ticking timer counting from the session start), plus
 * a pipeline stepper for how far it has moved. Brutalist: hard border, offset
 * block shadow, vermilion reserved for the live now-state.
 */
export function AgentActivityCard({ item }: { item: WorkItemView }) {
  const tone = item.isBlocked
    ? "danger"
    : item.awaitingApproval || item.isStale
    ? "warning"
    : item.isLive
    ? "brand"
    : "neutral";

  const shadow =
    tone === "danger"
      ? "shadow-[6px_6px_0_rgba(179,32,14,0.22)]"
      : tone === "warning"
      ? "shadow-[6px_6px_0_rgba(178,106,0,0.20)]"
      : "shadow-[6px_6px_0_rgba(0,0,0,0.45)]";

  const clockColor =
    tone === "brand"
      ? "text-brand-400"
      : tone === "warning"
      ? "text-warning-400"
      : tone === "danger"
      ? "text-danger-400"
      : "text-neutral-300";

  const caption = item.isBlocked
    ? "Blocked"
    : item.isStale
    ? "Running long"
    : STAGE_META[item.stage].label;

  const initials = (item.assigneeName ?? "AI")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={item.href}
      className={cn(
        "block border border-neutral-800 bg-neutral-900 transition-transform hover:-translate-y-0.5",
        shadow
      )}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        {/* avatar with a live corner tick */}
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-700 bg-neutral-950 text-[12px] font-bold text-neutral-200">
          {initials}
          {item.isLive && !item.isStale && (
            <span
              className="absolute -bottom-1 -right-1 h-2.5 w-2.5 border border-neutral-900 bg-brand-500"
              aria-hidden
            />
          )}
        </span>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-neutral-100">
            {item.title}
          </p>
          <p className="truncate font-mono text-[11px] text-neutral-500">
            {[item.assigneeName, item.context].filter(Boolean).join(" · ") || "Unassigned"}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {item.agentType && <AdapterBadge agentType={item.agentType} />}
          <div className="text-right">
            <div className={cn("font-mono text-[20px] font-bold leading-none", clockColor)}>
              {item.isLive && item.startedAt ? (
                <ElapsedTime startedAt={item.startedAt} mode="clock" />
              ) : item.totalActiveMs ? (
                <ElapsedTime ms={item.totalActiveMs} mode="clock" />
              ) : (
                "—"
              )}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              {caption}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-3">
        {item.isLive && !item.isStale && (
          <span className="inline-flex items-center gap-1.5 border border-brand-500 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 animate-pulse" />
            {item.statusLine}
          </span>
        )}
        {(!item.isLive || item.isStale) && (
          <span
            className={cn(
              "font-mono text-[11px]",
              item.isBlocked ? "text-danger-400" : item.isStale ? "text-warning-400" : "text-neutral-500"
            )}
          >
            {item.statusLine}
          </span>
        )}
        {item.branchName && (
          <span className="inline-flex max-w-[180px] items-center gap-1 truncate font-mono text-[11px] text-neutral-500">
            <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{item.branchName}</span>
          </span>
        )}
        {typeof item.prNumber === "number" && (
          <a
            href={item.prUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-500 hover:text-brand-400"
          >
            <GitPullRequest className="h-3 w-3 shrink-0" aria-hidden />
            #{item.prNumber}
          </a>
        )}
        {item.totalActiveMs != null && item.totalActiveMs > 0 && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-500">
            <FileCode2 className="h-3 w-3 shrink-0" aria-hidden />
            <ElapsedTime ms={item.totalActiveMs} /> on task
          </span>
        )}
      </div>

      {item.kind === "task" && (
        <TaskPipeline stage={item.stage} isBlocked={item.isBlocked} />
      )}
    </Link>
  );
}
