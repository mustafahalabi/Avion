import type { Metadata } from "next";
import { LiveBoard } from "@/components/board/live-board";

export const metadata: Metadata = {
  title: "Live Board · Avion",
};

// The board is fully client-driven (Socket.IO → @avion/api), so render the
// client component directly inside the app shell.
export default function BoardPage() {
  return <LiveBoard />;
}
