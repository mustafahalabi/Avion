"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { io, type Socket } from "socket.io-client";
import {
  BOARD_EVENTS,
  BOARD_NAMESPACE,
  type BoardClientToServerEvents,
  type BoardServerToClientEvents,
  type BoardSnapshot,
  type BoardTick,
} from "@avion/shared";

export type ConnectionState = "connecting" | "connected" | "disconnected";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type BoardSocket = Socket<BoardServerToClientEvents, BoardClientToServerEvents>;

/**
 * Subscribes to the @avion/api board namespace over Socket.IO. Receives a full
 * snapshot on connect and whenever the underlying data changes, plus a heartbeat
 * tick each poll interval. Falls back to a one-shot REST fetch so the board still
 * paints if the websocket is slow or blocked.
 *
 * Auth: the api requires a Clerk session token — sent as a bearer header on the
 * REST fallback and in the Socket.IO handshake `auth` payload (re-evaluated on
 * every reconnect attempt so a fresh token is used each time).
 */
export function useBoardLive() {
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [lastTick, setLastTick] = useState<BoardTick | null>(null);
  const socketRef = useRef<BoardSocket | null>(null);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  // Keep the latest getToken in a ref so the socket effect runs exactly once
  // per signed-in session instead of reconnecting on every render.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    // REST fallback: paint something even before the socket delivers.
    void getTokenRef
      .current()
      .then((token) =>
        token
          ? fetch(`${API_URL}/api/board/snapshot`, {
              credentials: "include",
              headers: { Authorization: `Bearer ${token}` },
            })
          : null
      )
      .then((res) => (res?.ok ? (res.json() as Promise<BoardSnapshot>) : null))
      .then((snap) => {
        if (!cancelled && snap) setSnapshot((prev) => prev ?? snap);
      })
      .catch(() => {
        /* socket is the primary path; ignore REST errors */
      });

    const socket: BoardSocket = io(`${API_URL}${BOARD_NAMESPACE}`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionDelay: 500,
      // Called on every (re)connection attempt → always a fresh Clerk token.
      auth: (cb) => {
        getTokenRef
          .current()
          .then((token) => cb({ token: token ?? "" }))
          .catch(() => cb({ token: "" }));
      },
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnection("connected"));
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.io.on("reconnect_attempt", () => setConnection("connecting"));
    socket.on(BOARD_EVENTS.snapshot, (snap) => setSnapshot(snap));
    socket.on(BOARD_EVENTS.tick, (tick) => setLastTick(tick));

    return () => {
      cancelled = true;
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isLoaded, isSignedIn]);

  const requestSnapshot = useCallback(() => {
    socketRef.current?.emit(BOARD_EVENTS.requestSnapshot);
  }, []);

  return { snapshot, connection, lastTick, requestSnapshot };
}
