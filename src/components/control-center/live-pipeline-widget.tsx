"use client";

import Link from "next/link";
import { ChevronRight, Radio } from "lucide-react";

import type { LivePipeline as LivePipelineData } from "@/lib/live-pipeline-data";
import type { LifecycleBoard, WorkItemView } from "@/lib/work-lifecycle";
import { useLivePipeline } from "@/components/live/use-live-pipeline";
import { LiveStatusPill } from "@/components/live/live-status-pill";
import { LivePipeline } from "@/components/live/live-pipeline";
import { WorkItemCard } from "@/components/live/work-item-card";

// Same SSE endpoint as the full board, but request the compact slice the widget
// seeds with (no stream rail, no done cards) so the seed and the pushes match.
const STREAM_HREF = "/api/work/live/stream?streamLimit=1&doneLimit=0";

interface LivePipelineWidgetProps {
  /** Server-rendered snapshot used to seed the first paint. */
  readonly initial: LivePipelineData;
}

/**
 * Picks the most relevant in-flight items to feature: anything live / blocked /
 * awaiting the CEO first, then other in-flight work, never the done column.
 */
function selectFeatured(board: LifecycleBoard, limit: number): WorkItemView[] {
  const all = board.columns
    .filter((c) => c.stage !== "done")
    .flatMap((c) => c.items);
  const urgent = all.filter((i) => i.isLive || i.isBlocked || i.awaitingApproval);
  const rest = all.filter((i) => !(i.isLive || i.isBlocked || i.awaitingApproval));
  return [...urgent, ...rest].slice(0, limit);
}

/**
 * Compact live pipeline for the Control Center home — the stage overview bar
 * plus the handful of items moving right now, streaming in place over SSE. Links
 * through to the full `/work/live` board.
 */
export function LivePipelineWidget({ initial }: LivePipelineWidgetProps) {
  const { pipeline, status, updatedAt } = useLivePipeline(STREAM_HREF, initial);
  const board = pipeline.board;
  const featured = selectFeatured(board, 4);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          <h3 className="text-sm font-medium text-neutral-200">Live Pipeline</h3>
          {board.activeCount > 0 && (
            <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              {board.activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LiveStatusPill status={status} updatedAt={updatedAt} />
          <Link
            href="/work/live"
            className="inline-flex items-center gap-0.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Open
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <LivePipeline board={board} />
        {featured.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {featured.map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-neutral-600">
            All clear — no work in flight right now.
          </p>
        )}
      </div>
    </section>
  );
}
