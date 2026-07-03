"use client";

import { useEffect, useState } from "react";

import {
  isTerminalSessionStatus,
  type AgentStreamEvent,
  type SessionStreamPayload,
} from "./types";

/**
 * Live view of one execution session's agent-output stream.
 *
 * `events` accumulate deduped by `seq` (ascending); `status` is the latest
 * reported session status; `done` flips true once the session is terminal (no
 * further events will arrive); `connected` tracks the EventSource link.
 */
export interface UseSessionStreamResult {
  readonly events: AgentStreamEvent[];
  readonly status: string;
  readonly done: boolean;
  readonly connected: boolean;
}

/** Manual-reconnect backoff bounds (used when the browser won't auto-retry). */
const BASE_RECONNECT_MS = 1500;
const MAX_RECONNECT_MS = 20_000;

/**
 * Subscribes to a running execution session's agent-output SSE stream.
 *
 * Opens an {@link EventSource} to `/api/work/sessions/{sessionId}/stream` when
 * `sessionId` is non-null and folds each pushed {@link SessionStreamPayload}
 * into an accumulator keyed by `seq` — so re-sent events (e.g. after a
 * reconnect that replays from the start) are idempotent. The source is closed on
 * `done`, on unmount, and whenever `sessionId` changes; a terminal close the
 * browser won't auto-retry is reconnected with exponential backoff. No
 * EventSource is opened while `sessionId` is null.
 *
 * @param sessionId - The execution session to stream, or null to stay idle.
 * @returns The accumulated events, latest status, terminal flag, and link state.
 */
export function useSessionStream(sessionId: string | null): UseSessionStreamResult {
  const [events, setEvents] = useState<AgentStreamEvent[]>([]);
  const [status, setStatus] = useState<string>("");
  const [done, setDone] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    // Reset to a clean idle state for the new (or absent) session.
    setEvents([]);
    setStatus("");
    setDone(false);
    setConnected(false);

    if (!sessionId) return;

    // Deduping accumulator — persists across reconnects within this effect run,
    // recreated when `sessionId` changes.
    const seen = new Map<number, AgentStreamEvent>();
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

    // Session reached a terminal state — stop listening for good.
    const finish = (): void => {
      stopped = true;
      clearReconnect();
      close();
      setConnected(false);
      setDone(true);
    };

    const scheduleReconnect = (): void => {
      if (stopped || reconnectTimer) return;
      close();
      const delay = retryDelay;
      retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, delay);
    };

    const open = (): void => {
      if (stopped || source) return;
      const es = new EventSource(`/api/work/sessions/${sessionId}/stream`);
      source = es;

      es.onopen = () => {
        if (stopped) return;
        retryDelay = BASE_RECONNECT_MS;
        setConnected(true);
      };

      es.onmessage = (event) => {
        if (stopped) return;
        let payload: SessionStreamPayload;
        try {
          payload = JSON.parse(event.data) as SessionStreamPayload;
        } catch {
          // Ignore a malformed frame; the next push recovers.
          return;
        }
        setConnected(true);

        if (Array.isArray(payload.events) && payload.events.length > 0) {
          let changed = false;
          for (const ev of payload.events) {
            if (!ev || typeof ev.seq !== "number") continue;
            if (!seen.has(ev.seq)) {
              seen.set(ev.seq, ev);
              changed = true;
            }
          }
          if (changed) {
            setEvents([...seen.values()].sort((a, b) => a.seq - b.seq));
          }
        }

        if (typeof payload.status === "string" && payload.status) {
          setStatus(payload.status);
        }
        if (payload.done || (payload.status && isTerminalSessionStatus(payload.status))) {
          finish();
        }
      };

      es.onerror = () => {
        if (stopped) return;
        setConnected(false);
        // CLOSED → the browser will NOT auto-retry; reconnect ourselves.
        // CONNECTING → the browser's own retry is already in flight; wait it out.
        if (es.readyState === EventSource.CLOSED) {
          scheduleReconnect();
        }
      };
    };

    open();

    return () => {
      stopped = true;
      clearReconnect();
      close();
    };
  }, [sessionId]);

  return { events, status, done, connected };
}
