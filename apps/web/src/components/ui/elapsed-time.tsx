"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Duration display — the primitive behind every "time spent" readout in the app.
 *
 * Two modes:
 *  - `compact` (default): "1h 12m", "12m 04s", "8s"
 *  - `clock`:             "01:12:04", "12:04"
 *
 * Three inputs, in priority order:
 *  - `ms` — a fixed duration in milliseconds (e.g. a per-task aggregate). Static.
 *  - `startedAt` + `completedAt` — a finished span. Static.
 *  - `startedAt` only — a LIVE span that ticks once a second from now.
 *
 * The live value is client-ticked, so the timer is wrapped with
 * `suppressHydrationWarning` (server and first-client frames differ by design).
 */

type Mode = "compact" | "clock";

function toMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Formats a millisecond duration. Pure — exported for reuse and unit tests.
 *
 * @param durationMs - Non-negative duration in ms (negatives clamp to 0).
 * @param mode - `compact` ("1h 12m") or `clock` ("01:12:04").
 * @returns The formatted duration string.
 */
export function formatDuration(durationMs: number, mode: Mode = "compact"): string {
  const total = Math.max(0, Math.floor(durationMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (mode === "clock") {
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

interface ElapsedTimeProps {
  /** A fixed duration in ms — wins over start/complete when provided. */
  ms?: number | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  mode?: Mode;
  className?: string;
  /** Placeholder when there is nothing to time yet. */
  placeholder?: string;
}

export function ElapsedTime({
  ms,
  startedAt,
  completedAt,
  mode = "compact",
  className,
  placeholder = "—",
}: ElapsedTimeProps) {
  const startMs = toMs(startedAt);
  const endMs = toMs(completedAt);
  const fixedMs = ms ?? null;

  // A span is "live" only when it has a start, no fixed value, and no end.
  const isLive = fixedMs == null && startMs != null && endMs == null;

  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  let value: string;
  if (fixedMs != null) {
    value = formatDuration(fixedMs, mode);
  } else if (startMs != null) {
    value = formatDuration((endMs ?? now) - startMs, mode);
  } else {
    value = placeholder;
  }

  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      suppressHydrationWarning
    >
      {value}
    </span>
  );
}
