"use client";

import { useEffect, useReducer } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

import type { TimelineItem } from "@/components/timeline-entry";
import { cn } from "@/lib/utils";

interface LiveStreamProps {
  readonly items: readonly TimelineItem[];
  readonly viewAllHref?: string;
  readonly className?: string;
}

/** Maps an event type to a dot colour, mirroring the timeline's language. */
function streamDot(type: string): string {
  if (type.startsWith("execution.") || type === "executing") return "bg-emerald-400";
  if (type.startsWith("review.") || type === "in_review") return "bg-amber-400";
  if (type.startsWith("qa.") || type === "in_qa") return "bg-neutral-400";
  if (type.startsWith("plan.") || type === "planning") return "bg-neutral-400";
  if (type.startsWith("release.") || type === "complete" || type.startsWith("outcome."))
    return "bg-emerald-500";
  if (type === "blocked") return "bg-red-400";
  if (type === "intake") return "bg-blue-400";
  return "bg-neutral-500";
}

function relativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}

/**
 * The "Live now" rail — a compact, newest-first stream of what the company is
 * doing right now (agent pushes, PRs opened, reviews, QA, plan events). Sits
 * beside the lifecycle board and refreshes with it.
 */
export function LiveStream({ items, viewAllHref, className }: LiveStreamProps) {
  // Pushes only arrive when the board changes, so during quiet periods nothing
  // would re-render and the "5m ago" labels would freeze. Tick every 30s to
  // keep relative times honest (mirrors the LiveStatusPill ticker).
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-neutral-800 bg-neutral-950",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
            Live Now
          </span>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-[11px] text-neutral-600 transition-colors hover:text-neutral-400"
          >
            View all
          </Link>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10 text-center">
            <p className="px-4 text-[11px] text-neutral-700">
              Nothing happening yet. Activity appears here as your company works.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const href = item.contextHref.startsWith("/")
              ? item.contextHref
              : `/inbox/requests/${item.contextHref}`;
            return (
              <Link
                key={item.id}
                href={href}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-neutral-900"
              >
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    streamDot(item.type)
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] leading-snug text-neutral-300">
                    {item.description}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-neutral-600">
                    <span className="truncate">{item.contextLabel}</span>
                    <span aria-hidden>·</span>
                    <time
                      dateTime={new Date(item.createdAt).toISOString()}
                      className="shrink-0 tabular-nums"
                      suppressHydrationWarning
                    >
                      {relativeTime(item.createdAt)}
                    </time>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
