"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import {
  humanizeEvent,
  type HumanizedTone,
} from "@/lib/agent-stream/humanize";
import { useSessionStream } from "@/lib/agent-stream/use-session-stream";

/** How many humanized lines the default CEO-facing feed shows at once. */
const FEED_WINDOW = 8;

/** Humanized tone → brutalist text colour (mirrors the thread's palette). */
const TONE_COLOR: Record<HumanizedTone, string> = {
  status: "text-neutral-400",
  info: "text-neutral-300",
  action: "text-brand-400",
  result: "text-emerald-400",
  error: "text-danger-400",
};

/** A terminal-looking status reads as a failure, not a clean finish. */
function looksFailed(status: string): boolean {
  return /fail|cancel|error|block/i.test(status);
}

/**
 * The live "Avion is building…" feed for one execution session.
 *
 * Renders inside the chat thread as an agent bubble: a humanized activity feed
 * (the CEO-facing default) with the raw agent output tucked behind an opt-in
 * "Watch the agent" drawer. Stays invisible (returns null) until the session
 * actually emits something, so an idle/absent session adds no chrome.
 *
 * @param sessionId - The execution session to stream, or null to stay idle.
 */
export function SessionStream({ sessionId }: { sessionId: string | null }) {
  const { events, status, done, connected } = useSessionStream(sessionId);

  // Wall-clock anchor for the elapsed timer: the run's start ≈ now − first
  // event's atMs. Set once when the first event lands; reset whenever the stream
  // resets (new/absent session empties `events`). A ref keeps it stable across
  // re-renders without an extra effect pass.
  const anchorRef = useRef<number | null>(null);
  if (events.length === 0) {
    anchorRef.current = null;
  } else if (anchorRef.current == null) {
    anchorRef.current = Date.now() - events[0]!.atMs;
  }

  // Invisible until there's something to show.
  if (events.length === 0 && !connected) return null;

  const failed = done && looksFailed(status);
  const latestAtMs = events.length ? events[events.length - 1]!.atMs : 0;
  const feed = events.slice(-FEED_WINDOW);

  const headerDot = !done
    ? "bg-brand-500 animate-pulse"
    : failed
    ? "bg-danger-500"
    : "bg-emerald-500";
  const headerLabel = !done
    ? "Avion is building…"
    : failed
    ? "Stopped"
    : "Finished";

  return (
    <div className="av-fade-in-up flex flex-row gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-bold text-neutral-400">
        E
      </div>
      <div className="min-w-0 flex-1 border border-neutral-800 bg-neutral-950/60">
        {/* Live header — pulsing indicator + elapsed timer. */}
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", headerDot)} aria-hidden />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {headerLabel}
          </span>
          <span className="ml-auto shrink-0">
            {done ? (
              <ElapsedTime
                ms={latestAtMs}
                mode="clock"
                className="font-mono text-[11px] text-neutral-500"
              />
            ) : anchorRef.current != null ? (
              <ElapsedTime
                startedAt={new Date(anchorRef.current)}
                mode="clock"
                className={cn("font-mono text-[11px] font-semibold", failed ? "text-danger-400" : "text-brand-400")}
              />
            ) : null}
          </span>
        </div>

        {/* Default CEO-facing feed — humanized, newest last. */}
        <div className="flex flex-col gap-1 px-3 py-2">
          {feed.map((event) => {
            const h = humanizeEvent(event);
            return (
              <div
                key={event.seq}
                className="av-fade-in-up flex items-start gap-2 text-xs leading-relaxed"
              >
                <span className={cn("shrink-0 font-mono", TONE_COLOR[h.tone])} aria-hidden>
                  {h.icon}
                </span>
                <span className={cn("min-w-0 flex-1 break-words", TONE_COLOR[h.tone])}>
                  {h.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Opt-in raw output — collapsed by default (the developer view). */}
        <details className="group border-t border-neutral-800">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-500 transition-colors hover:text-neutral-300">
            <span className="text-neutral-600 transition-transform group-open:rotate-90">▸</span>
            Watch the agent
          </summary>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-t border-neutral-800/70 bg-neutral-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-400">
            {events.map((event) => event.detail ?? event.label).join("\n")}
          </pre>
        </details>
      </div>
    </div>
  );
}
