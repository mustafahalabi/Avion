"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { LiveStatus } from "./use-live-pipeline";

interface LiveStatusPillProps {
  readonly status: LiveStatus;
  /** Epoch ms of the last applied push, or null before the first one. */
  readonly updatedAt: number | null;
  readonly className?: string;
}

/**
 * Connection indicator for the SSE-driven Live views. Unlike a manual refresh
 * control, this reflects a *push* connection: an emerald pulse while live (with
 * an "Ns ago" ticker since the last update), amber while connecting/reconnecting,
 * and a dim dot when paused (tab hidden).
 */
export function LiveStatusPill({
  status,
  updatedAt,
  className,
}: LiveStatusPillProps) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Tick the "Ns ago" label once the first push has landed.
  useEffect(() => {
    if (updatedAt == null) return;
    const recompute = () =>
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)));
    recompute();
    const id = setInterval(recompute, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  const live = status === "live";
  const busy = status === "connecting" || status === "reconnecting";

  const dot = live
    ? "bg-emerald-400 animate-pulse"
    : busy
    ? "bg-amber-400 animate-pulse"
    : "bg-neutral-600";

  const text =
    status === "paused"
      ? "Paused"
      : status === "connecting"
      ? "Connecting…"
      : status === "reconnecting"
      ? "Reconnecting…"
      : updatedAt == null
      ? "Live"
      : `Live · ${secondsAgo}s ago`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1",
        className
      )}
      title={live ? "Streaming live updates" : text}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="text-[11px] font-medium tabular-nums text-neutral-400 min-w-[72px]">
        {text}
      </span>
    </div>
  );
}
