"use client";

import { useActionState } from "react";
import {
  generatePlanningDraftForOutcome,
  type GeneratePlanningDraftState,
} from "@/app/actions/planning";
import { Zap } from "lucide-react";

interface GeneratePlanButtonProps {
  outcomeId: string;
}

export function GeneratePlanButton({ outcomeId }: GeneratePlanButtonProps) {
  const [state, action, pending] = useActionState<
    GeneratePlanningDraftState,
    FormData
  >(generatePlanningDraftForOutcome, undefined);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="outcomeId" value={outcomeId} />
      {state?.message && (
        <p
          className={
            state.planningDraftId
              ? "text-xs text-emerald-400"
              : "text-xs text-red-400"
          }
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Zap className="h-3 w-3" />
        {pending ? "Generating…" : "Generate plan"}
      </button>
    </form>
  );
}
