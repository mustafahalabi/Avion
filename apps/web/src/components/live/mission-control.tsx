"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import type { LivePipeline as LivePipelineData } from "@/lib/live-pipeline-data";
import type { WorkItemView } from "@/lib/work-lifecycle";
import { cn } from "@/lib/utils";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { useLivePipeline } from "./use-live-pipeline";
import { LiveStatusPill } from "./live-status-pill";
import { LiveStream } from "./live-stream";
import { LiveFlow } from "./live-flow";
import { AgentActivityCard } from "./agent-activity-card";
import { WorkItemCard } from "./work-item-card";

const STREAM_HREF = "/api/work/live/stream";

type Tab = "agents" | "graph" | "board" | "feed";

const TABS: { id: Tab; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "graph", label: "Graph" },
  { id: "board", label: "Board" },
  { id: "feed", label: "Feed" },
];

/**
 * Mission Control — the single canonical live surface. Answers the CEO's three
 * questions at a glance: which agents are running (adapter + role), where
 * (task / repo / branch / PR), and for how long (a live-ticking timer). Replaces
 * the three overlapping surfaces (`/work/live`, `/board`, `/work/board`) with one
 * data model and one vocabulary; Graph/Board/Feed are just lenses on it.
 */
export function MissionControl({ initial }: { initial: LivePipelineData }) {
  const { pipeline, status, updatedAt } = useLivePipeline(STREAM_HREF, initial);
  const { board, stream } = pipeline;
  const [tab, setTab] = useState<Tab>("agents");

  const inFlight: WorkItemView[] = board.columns.flatMap((c) => c.items);
  const liveAgents = inFlight.filter((i) => i.isLive);
  const needsYou = inFlight.filter(
    (i) => (i.isBlocked || i.awaitingApproval) && !i.isLive
  );
  const queued = inFlight.filter(
    (i) => i.stage === "queued" && !i.isLive && !i.isBlocked && !i.awaitingApproval
  );

  const oldestStart = liveAgents.reduce<Date | null>((min, i) => {
    if (!i.startedAt) return min;
    return !min || i.startedAt < min ? i.startedAt : min;
  }, null);

  const idle = board.liveCount === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              idle ? "bg-neutral-600" : "bg-brand-500 animate-pulse"
            )}
            aria-hidden
          />
          <h1 className="text-lg font-bold tracking-tight text-neutral-100">Mission Control</h1>
        </div>
        <LiveStatusPill status={status} updatedAt={updatedAt} />
      </header>

      {/* stat strip */}
      <div className="grid shrink-0 grid-cols-2 border-b border-neutral-800 md:grid-cols-4">
        <Stat label="Agents running" accent={!idle}>
          <span className="tabular-nums">{board.liveCount}</span>
        </Stat>
        <Stat label="Oldest running">
          {oldestStart ? <ElapsedTime startedAt={oldestStart} mode="clock" /> : "—"}
        </Stat>
        <Stat label="Needs you" warn={board.needsAttentionCount > 0}>
          <span className="tabular-nums">{board.needsAttentionCount}</span>
        </Stat>
        <Stat label="Delivered" last>
          <span className="tabular-nums">{board.stageCounts.done}</span>
        </Stat>
      </div>

      {/* tabs */}
      <div className="flex shrink-0 items-center gap-4 border-b border-neutral-800 px-6 py-2.5">
        <div className="inline-flex border border-neutral-700">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-l border-neutral-700 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider first:border-l-0 transition-colors",
                tab === t.id
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "agents" && (
          <AgentsView
            liveAgents={liveAgents}
            needsYou={needsYou}
            queued={queued}
            idle={idle}
          />
        )}
        {tab === "graph" && (
          <div className="h-full">
            {board.totalCount === 0 ? <Empty /> : <LiveFlow board={board} />}
          </div>
        )}
        {tab === "board" && <BoardView board={board} />}
        {tab === "feed" && (
          <LiveStream items={stream} viewAllHref="/timeline" className="flex h-full" />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  children,
  accent,
  warn,
  last,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn("border-neutral-800 px-5 py-4", !last && "border-r")}>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-[26px] font-bold leading-none",
          accent ? "text-brand-400" : warn ? "text-warning-400" : "text-neutral-100"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        <span className="h-px flex-1 bg-neutral-800" />
      </div>
      {children}
    </div>
  );
}

function AgentsView({
  liveAgents,
  needsYou,
  queued,
  idle,
}: {
  liveAgents: WorkItemView[];
  needsYou: WorkItemView[];
  queued: WorkItemView[];
  idle: boolean;
}) {
  if (idle && needsYou.length === 0 && queued.length === 0) return <Empty />;

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      {liveAgents.length > 0 && (
        <Section label={`Live agents · ${liveAgents.length}`}>
          <div className="grid gap-4">
            {liveAgents.map((i) => (
              <AgentActivityCard key={i.id} item={i} />
            ))}
          </div>
        </Section>
      )}

      {needsYou.length > 0 && (
        <Section label={`Needs you · ${needsYou.length}`}>
          <div className="grid gap-4">
            {needsYou.map((i) => (
              <AgentActivityCard key={i.id} item={i} />
            ))}
          </div>
        </Section>
      )}

      {queued.length > 0 && (
        <Section label={`Queued & upstream · ${queued.length}`}>
          <div className="grid gap-2.5 md:grid-cols-2">
            {queued.map((i) => (
              <WorkItemCard key={i.id} item={i} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function BoardView({ board }: { board: LivePipelineData["board"] }) {
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-5">
      <div className="flex h-full gap-3">
        {board.columns.map((col) => (
          <div
            key={col.stage}
            className="flex w-[248px] shrink-0 flex-col border border-neutral-800 bg-neutral-950/40"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-300">
                {col.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                {col.total}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
              {col.items.length === 0 ? (
                <p className="px-1 py-3 text-center font-mono text-[10px] text-neutral-700">
                  —
                </p>
              ) : (
                col.items.map((i) => <WorkItemCard key={i.id} item={i} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center border border-neutral-800 bg-neutral-900">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-200">Company idle — no agents running</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Ask your company to build something and watch it plan, build, review,
            and ship here in real time — each agent and its timer live.
          </p>
        </div>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 border border-neutral-100 bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-brand-500 hover:border-brand-500 hover:text-white"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Start something
        </Link>
      </div>
    </div>
  );
}
