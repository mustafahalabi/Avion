import type { Metadata } from "next";
import { LiveBoard } from "@/components/board/live-board";

export const metadata: Metadata = {
  title: "Live Board · Avion",
};

// `/board` is the realtime **kanban board** — tasks in status columns — streamed
// from the standalone `@avion/api` service over Socket.IO. This is intentionally
// distinct from `/work/live` (the per-outcome **pipeline graph** over in-app SSE);
// see the MUS-260 decision in AGENTS.md. Fully client-driven, so render the client
// component directly inside the app shell.
export default function BoardPage() {
  return <LiveBoard />;
}
