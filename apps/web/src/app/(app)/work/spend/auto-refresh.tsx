"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-fetches the server component tree so the ops spend view stays
 * live (running agents + spend) without a manual reload. The usage ledger isn't
 * on the SSE board stream, so a light `router.refresh()` poll is the right tool.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
