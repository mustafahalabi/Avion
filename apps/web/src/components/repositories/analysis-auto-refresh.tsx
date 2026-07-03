"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Statuses that mean analysis is still in flight and results will change. */
const IN_FLIGHT = new Set(["pending", "queued", "analyzing"]);

/**
 * Refreshes the repository detail route on an interval while analysis is
 * running, so results appear automatically after a repo is connected — no
 * manual reload. Renders nothing; stops polling once analysis reaches a
 * terminal state (`complete`/`failed`).
 */
export function AnalysisAutoRefresh({
  status,
  intervalMs = 2500,
}: {
  status: string;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!IN_FLIGHT.has(status)) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [status, intervalMs, router]);

  return null;
}
