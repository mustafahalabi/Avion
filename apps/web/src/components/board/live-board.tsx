"use client";

import { useMemo } from "react";
import { RefreshCw, GitPullRequest, Bell, ListChecks, Activity } from "lucide-react";
import type { BoardMetrics, SessionSummary, StatusCount } from "@avion/shared";
import { cn } from "@/lib/utils";
import { useBoardLive, type ConnectionState } from "@/hooks/use-board-live";

const STATUS_STYLES: Record<string, { dot: string; bar: string; text: string }> = {
  running: { dot: "bg-sky-400", bar: "bg-sky-500/70", text: "text-sky-300" },
  queued: { dot: "bg-amber-400", bar: "bg-amber-500/70", text: "text-amber-300" },
  prepared: { dot: "bg-amber-300", bar: "bg-amber-400/70", text: "text-amber-200" },
  completed: { dot: "bg-emerald-400", bar: "bg-emerald-500/70", text: "text-emerald-300" },
  failed: { dot: "bg-rose-400", bar: "bg-rose-500/70", text: "text-rose-300" },
  canceled: { dot: "bg-neutral-500", bar: "bg-neutral-600/70", text: "text-neutral-400" },
  needs_clarification: { dot: "bg-violet-400", bar: "bg-violet-500/70", text: "text-violet-300" },
};

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? { dot: "bg-neutral-500", bar: "bg-neutral-600/70", text: "text-neutral-400" };
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

const CONNECTION_LABEL: Record<ConnectionState, { label: string; dot: string }> = {
  connected: { label: "Live", dot: "bg-emerald-400" },
  connecting: { label: "Connecting…", dot: "bg-amber-400" },
  disconnected: { label: "Offline", dot: "bg-rose-400" },
};

export function LiveBoard() {
  const { snapshot, connection, lastTick, requestSnapshot } = useBoardLive();
  const conn = CONNECTION_LABEL[connection];

  const maxStatus = useMemo(
    () => Math.max(1, ...(snapshot?.statusCounts.map((s) => s.count) ?? [1])),
    [snapshot],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-sky-400" aria-hidden />
          <div>
            <h1 className="text-sm font-semibold text-neutral-100">Live Board</h1>
            <p className="text-xs text-neutral-500">
              Realtime agent activity, streamed from the Avion backend
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300">
            <span className={cn("h-2 w-2 rounded-full", conn.dot, connection === "connected" && "animate-pulse")} />
            {conn.label}
            {lastTick && connection === "connected" && (
              <span className="text-neutral-600">· #{lastTick.seq}</span>
            )}
          </span>
          <button
            onClick={requestSnapshot}
            className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {!snapshot ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-500">
            {connection === "disconnected"
              ? "Can't reach the realtime backend. Is @avion/api running on port 4000?"
              : "Connecting to the live board…"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <MetricsRow metrics={snapshot.metrics} />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Status distribution */}
            <section className="lg:col-span-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Sessions by status
              </h2>
              {snapshot.statusCounts.length === 0 ? (
                <p className="text-sm text-neutral-600">No execution sessions yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {snapshot.statusCounts.map((s) => (
                    <StatusBar key={s.status} item={s} max={maxStatus} />
                  ))}
                </ul>
              )}
            </section>

            {/* Recent sessions feed */}
            <section className="lg:col-span-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Recent activity
                </h2>
                <span className="text-xs text-neutral-600">
                  updated {relativeTime(snapshot.generatedAt)}
                </span>
              </div>
              {snapshot.recentSessions.length === 0 ? (
                <p className="text-sm text-neutral-600">No recent sessions.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-800/70">
                  {snapshot.recentSessions.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsRow({ metrics }: { metrics: BoardMetrics }) {
  const cards: { label: string; value: number; icon?: React.ElementType; accent?: string }[] = [
    { label: "Active", value: metrics.activeSessions, icon: Activity, accent: "text-sky-300" },
    { label: "Completed", value: metrics.completedSessions, accent: "text-emerald-300" },
    { label: "Failed", value: metrics.failedSessions, accent: "text-rose-300" },
    { label: "Open PRs", value: metrics.openPullRequests, icon: GitPullRequest, accent: "text-violet-300" },
    { label: "Tasks in progress", value: metrics.tasksInProgress, icon: ListChecks },
    { label: "Unread", value: metrics.unreadNotifications, icon: Bell, accent: "text-amber-300" },
    { label: "Total sessions", value: metrics.totalSessions },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
              {c.label}
            </div>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums", c.accent ?? "text-neutral-100")}>
              {c.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBar({ item, max }: { item: StatusCount; max: number }) {
  const style = statusStyle(item.status);
  const pct = Math.round((item.count / max) * 100);
  return (
    <li className="flex items-center gap-3">
      <span className="flex w-36 shrink-0 items-center gap-2 text-xs">
        <span className={cn("h-2 w-2 rounded-full", style.dot)} />
        <span className={cn("truncate", style.text)}>{item.status}</span>
      </span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", style.bar)}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-neutral-400">
        {item.count}
      </span>
    </li>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const style = statusStyle(session.status);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", style.dot, session.status === "running" && "animate-pulse")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-200">
          {session.taskTitle ?? <span className="text-neutral-500">Untitled task</span>}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {session.companyName ?? "—"} · {session.agentType}
        </p>
      </div>
      {session.prUrl && (
        <a
          href={session.prUrl}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-100"
        >
          <GitPullRequest className="h-3 w-3" aria-hidden />
          {session.prNumber ? `#${session.prNumber}` : "PR"}
        </a>
      )}
      <span className={cn("w-20 shrink-0 text-right text-[11px] capitalize", style.text)}>
        {session.status.replace(/_/g, " ")}
      </span>
      <span className="w-16 shrink-0 text-right text-[11px] text-neutral-600">
        {relativeTime(session.updatedAt)}
      </span>
    </li>
  );
}
