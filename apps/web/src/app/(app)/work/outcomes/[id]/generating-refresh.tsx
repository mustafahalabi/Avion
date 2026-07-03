"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the outcome route on an interval while plan generation is in flight
 * (the planner runs after the response, so the draft lands out-of-band). Renders
 * nothing; stops as soon as `active` is false.
 */
export function GeneratingRefresh({
  active,
  intervalMs = 2500,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
