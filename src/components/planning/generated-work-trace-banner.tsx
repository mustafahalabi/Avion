import Link from "next/link";
import { GitBranch } from "lucide-react";

interface GeneratedWorkTraceBannerProps {
  readonly outcomeId: string | null;
  readonly outcomeTitle: string | null;
  readonly planningDraftId: string | null;
}

/**
 * Shows traceability from generated work back to the originating outcome and plan.
 *
 * @param props - Outcome and planning draft identifiers.
 * @returns Trace banner when generated work links exist.
 */
export function GeneratedWorkTraceBanner({
  outcomeId,
  outcomeTitle,
  planningDraftId,
}: GeneratedWorkTraceBannerProps) {
  if (!outcomeId) {
    return null;
  }

  return (
    <section className="rounded-lg border border-blue-900/40 bg-blue-950/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-200">Generated from approved plan</p>
          <p className="mt-1 text-xs text-neutral-400">
            This work traces back to outcome{" "}
            <Link
              href={`/work/outcomes/${outcomeId}`}
              className="text-neutral-200 underline-offset-2 hover:underline"
            >
              {outcomeTitle ?? outcomeId}
            </Link>
            {planningDraftId ? (
              <>
                {" "}
                · plan <span className="font-mono text-[11px]">{planningDraftId.slice(0, 8)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  );
}
