"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ElapsedTime } from "@/components/ui/elapsed-time";
import { AdapterBadge } from "@/components/ui/badge";

/**
 * A slim, always-visible band across the top of the app that keeps live agent
 * activity in view from every page — the "you can always see what's happening"
 * presence. Seeded from the server (running sessions at page load) and ticks the
 * oldest agent's timer client-side; the count refreshes on navigation. When no
 * agent is running it steps aside to a quiet "needs you" nudge, or nothing.
 */
export interface LiveActivitySummary {
  readonly count: number;
  readonly oldestStartedAt: string | null;
  readonly title: string | null;
  readonly agentType: string | null;
  readonly pendingApprovals: number;
}

export function LiveActivityBar({ summary }: { summary: LiveActivitySummary }) {
  if (summary.count > 0) {
    return (
      <Link
        href="/work/live"
        className="group flex items-center gap-3 border-b border-neutral-800 bg-brand-500/10 px-6 py-2 text-[12px] transition-colors hover:bg-brand-500/15"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500 animate-pulse" aria-hidden />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-400">
          {summary.count} agent{summary.count === 1 ? "" : "s"} running
        </span>
        {summary.agentType && (
          <AdapterBadge agentType={summary.agentType} className="hidden sm:inline-flex" />
        )}
        {summary.title && (
          <span className="hidden min-w-0 truncate text-neutral-300 md:inline">
            {summary.title}
          </span>
        )}
        {summary.oldestStartedAt && (
          <span className="ml-auto flex items-center gap-1.5 text-neutral-500">
            <span className="hidden font-mono text-[10px] uppercase tracking-wider sm:inline">
              oldest
            </span>
            <ElapsedTime
              startedAt={summary.oldestStartedAt}
              mode="clock"
              className="text-[12px] font-semibold text-brand-400"
            />
          </span>
        )}
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    );
  }

  if (summary.pendingApprovals > 0) {
    return (
      <Link
        href="/inbox"
        className="group flex items-center gap-3 border-b border-neutral-800 bg-warning-500/10 px-6 py-2 text-[12px] transition-colors hover:bg-warning-500/15"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-warning-500" aria-hidden />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-warning-400">
          {summary.pendingApprovals} need{summary.pendingApprovals === 1 ? "s" : ""} your input
        </span>
        <ArrowRight
          className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    );
  }

  return null;
}
