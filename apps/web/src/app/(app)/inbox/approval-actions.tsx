"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import {
  approveQaCheckpointAction,
  approveReviewCheckpointAction,
  rejectReviewCheckpointAction,
  type ApprovalActionResult,
} from "@/app/actions/approvals";
import { cn } from "@/lib/utils";

/** Approve / Reject buttons for a single pending approval checkpoint. */
export function ApprovalActions({
  kind,
  id,
}: {
  kind: "review" | "qa";
  id: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ApprovalActionResult>): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-40 truncate text-[11px] text-danger-400" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() =>
            kind === "review"
              ? approveReviewCheckpointAction(id)
              : approveQaCheckpointAction(id)
          )
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          "border-success-800 bg-success-950 text-success-400 hover:bg-success-900",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Approve
      </button>
      {kind === "review" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => rejectReviewCheckpointAction(id))}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            "border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <X className="h-3 w-3" />
          Reject
        </button>
      )}
    </div>
  );
}
