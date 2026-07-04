import { Coins } from "lucide-react";

import { cn } from "@/lib/utils";

/** Formats a USD amount with adaptive precision (sub-cent shows 4 dp). */
function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Per-outcome spend meter (Goal 3): shows the REAL dollars this conversation's
 * work has spent, and — when a ceiling is configured — how close it is to the
 * cap. Turns amber near the ceiling and red once reached, so a runaway spend is
 * visible before it halts. Server-rendered; refreshes as work advances.
 */
export function OutcomeSpendChip({
  spentUsd,
  ceilingUsd,
  ratioBasisUsd,
}: {
  /** Total spend across this conversation's outcomes — the figure displayed. */
  spentUsd: number;
  /** The effective per-outcome ceiling, or null when none is configured. */
  ceilingUsd: number | null;
  /**
   * Spend to measure against the ceiling for the amber/red tone. The ceiling is
   * PER-OUTCOME, so this should be the max single-outcome spend, not the
   * cross-outcome total (else two cheap outcomes could falsely read as over
   * budget). Defaults to `spentUsd` for the single-outcome case.
   */
  ratioBasisUsd?: number;
}) {
  // Nothing spent and no ceiling → no chip (keeps a fresh chat header clean).
  if (spentUsd <= 0 && ceilingUsd == null) return null;

  const basis = ratioBasisUsd ?? spentUsd;
  const ratio = ceilingUsd != null && ceilingUsd > 0 ? basis / ceilingUsd : 0;
  const tone =
    ceilingUsd == null
      ? "text-neutral-400 border-neutral-800"
      : ratio >= 1
        ? "text-danger-400 border-danger-500/40"
        : ratio >= 0.8
          ? "text-warning-400 border-warning-500/40"
          : "text-neutral-400 border-neutral-800";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-neutral-950/60 px-2.5 py-1 font-mono text-[11px]",
        tone
      )}
      title="Real agent spend on this conversation's work (planning + execution)"
    >
      <Coins className="h-3 w-3 shrink-0" aria-hidden />
      <span>{formatUsd(spentUsd)}</span>
      {ceilingUsd != null && (
        <span className="text-neutral-600">/ {formatUsd(ceilingUsd)}</span>
      )}
    </span>
  );
}
