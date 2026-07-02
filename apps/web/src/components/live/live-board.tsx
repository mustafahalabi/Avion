"use client";

import Link from "next/link";
import { Radio, Sparkles } from "lucide-react";

import type { LivePipeline as LivePipelineData } from "@/lib/live-pipeline-data";
import { useLivePipeline } from "./use-live-pipeline";
import { LiveStatusPill } from "./live-status-pill";
import { LivePipeline } from "./live-pipeline";
import { LifecycleBoardView } from "./lifecycle-board";
import { LiveStream } from "./live-stream";

/** The SSE endpoint that streams pipeline changes. */
const STREAM_HREF = "/api/work/live/stream";

interface LiveBoardProps {
  /** Server-rendered snapshot used to seed the first paint. */
  readonly initial: LivePipelineData;
}

/**
 * The full `/work/live` region, driven by the SSE stream. Seeded from the
 * server snapshot so it paints instantly, then updates in place — counts,
 * columns, cards, and the activity rail all move together as the company works,
 * with no full-page refresh and no lost scroll position.
 */
export function LiveBoard({ initial }: LiveBoardProps) {
  const { pipeline, status, updatedAt } = useLivePipeline(STREAM_HREF, initial);
  const { board, stream } = pipeline;
  const isEmpty = board.totalCount === 0 && stream.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Radio className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <h1 className="text-sm font-semibold text-neutral-100">Live</h1>
          {!isEmpty && (
            <span className="truncate text-xs text-neutral-500">
              {board.activeCount} active
              {board.liveCount > 0 && (
                <span className="text-emerald-400"> · {board.liveCount} working now</span>
              )}
              {board.needsAttentionCount > 0 && (
                <span className="text-amber-400">
                  {" "}
                  · {board.needsAttentionCount} need you
                </span>
              )}
            </span>
          )}
        </div>
        <LiveStatusPill status={status} updatedAt={updatedAt} />
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
          <div className="shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2.5">
            <LivePipeline board={board} />
          </div>

          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <LifecycleBoardView board={board} />
            </div>
            <LiveStream
              items={stream}
              viewAllHref="/timeline"
              className="hidden w-[280px] shrink-0 lg:flex"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 ring-1 ring-neutral-800">
          <Radio className="h-5 w-5 text-neutral-600" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-300">
            No work in flight yet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            Request an outcome and watch your company plan it, build it, review
            it, and ship it — moving across this board in real time.
          </p>
        </div>
        <Link
          href="/work/outcomes/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3.5 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-white"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Request an outcome
        </Link>
      </div>
    </div>
  );
}
