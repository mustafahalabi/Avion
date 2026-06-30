"use client";

import { useEffect, useState } from "react";

import type { LivePipeline } from "@/lib/live-pipeline-data";
import { parseLivePipeline } from "@/lib/live-pipeline-serialization";

/** Connection state surfaced to the status pill. */
export type LiveStatus = "connecting" | "live" | "reconnecting" | "paused";

export interface UseLivePipelineResult {
  /** The latest pipeline — seeded from the server snapshot, then live-updated. */
  readonly pipeline: LivePipeline;
  readonly status: LiveStatus;
  /** Epoch ms of the last applied push, or null before the first one. */
  readonly updatedAt: number | null;
}

/** Manual-reconnect backoff bounds (used when the browser won't auto-retry). */
const BASE_RECONNECT_MS = 1500;
const MAX_RECONNECT_MS = 30_000;

/**
 * Subscribes to the Live pipeline SSE stream and keeps a fresh pipeline in
 * state, seeded from the server-rendered snapshot so the first paint is instant
 * and never flashes empty.
 *
 * Pushes arrive only when the board actually changes, so re-renders are cheap.
 * The connection is closed while the tab is hidden (no wasted server polling in
 * the background) and reopened on return.
 *
 * Reconnection is handled defensively: the browser auto-retries transient drops
 * (readyState `CONNECTING`), and for terminal closes (readyState `CLOSED`, or a
 * server-sent `fatal` event when the board can't be loaded) we reconnect
 * ourselves with exponential backoff so the view recovers instead of sitting on
 * a dead "reconnecting" state forever.
 *
 * @param streamHref - The SSE endpoint to subscribe to.
 * @param initial - The server-rendered pipeline used as the seed.
 * @returns The live pipeline, connection status, and last-update timestamp.
 */
export function useLivePipeline(
  streamHref: string,
  initial: LivePipeline
): UseLivePipelineResult {
  const [pipeline, setPipeline] = useState<LivePipeline>(initial);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = BASE_RECONNECT_MS;

    const clearReconnect = (): void => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const close = (): void => {
      if (source) {
        source.close();
        source = null;
      }
    };

    const open = (): void => {
      if (stopped || source) return;
      clearReconnect();
      setStatus((prev) => (prev === "live" ? prev : "connecting"));
      const es = new EventSource(streamHref);
      source = es;

      es.onopen = () => {
        if (stopped) return;
        retryDelay = BASE_RECONNECT_MS;
        setStatus("live");
      };
      es.onmessage = (event) => {
        if (stopped) return;
        try {
          setPipeline(parseLivePipeline(event.data));
          retryDelay = BASE_RECONNECT_MS;
          setStatus("live");
          setUpdatedAt(Date.now());
        } catch {
          // Ignore a malformed frame; the next push will recover.
        }
      };
      es.onerror = () => {
        if (stopped) return;
        // CLOSED means the browser will NOT auto-retry — reconnect ourselves.
        if (es.readyState === EventSource.CLOSED) {
          scheduleReconnect();
        } else {
          // CONNECTING: the browser's own retry is already in flight.
          setStatus("reconnecting");
        }
      };
      // The server gives up after persistent load failures; recover on backoff.
      es.addEventListener("fatal", () => {
        if (stopped) return;
        scheduleReconnect();
      });
    };

    const scheduleReconnect = (): void => {
      if (stopped || reconnectTimer) return;
      close();
      setStatus("reconnecting");
      const delay = retryDelay;
      retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, delay);
    };

    // Single source of truth for "should we be connected right now?" — used
    // both on mount and on every visibility change, so the two never diverge.
    const sync = (): void => {
      if (document.hidden) {
        clearReconnect();
        close();
        setStatus("paused");
      } else {
        open();
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", sync);
      clearReconnect();
      close();
    };
  }, [streamHref]);

  return { pipeline, status, updatedAt };
}
