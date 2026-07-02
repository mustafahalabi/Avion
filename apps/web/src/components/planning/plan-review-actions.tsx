"use client";

import { useActionState } from "react";
import { CheckCircle2, PlayCircle, XCircle } from "lucide-react";

import {
  approvePlan,
  applyPlan,
  rejectPlan,
  type ApprovePlanState,
  type ApplyPlanState,
  type RejectPlanState,
} from "@/app/actions/planning";
import { Button } from "@/components/ui/button";
import type { PlanningReviewView } from "@/lib/planning-review-view";

interface PlanReviewActionsProps {
  readonly plan: PlanningReviewView;
}

/**
 * CEO actions for reviewing, approving, rejecting, and applying a planning draft.
 *
 * @param props - Planning draft review context.
 * @returns Action forms for the plan review page.
 */
export function PlanReviewActions({ plan }: PlanReviewActionsProps) {
  const [approveState, approveAction, approvePending] = useActionState<
    ApprovePlanState,
    FormData
  >(approvePlan, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState<
    RejectPlanState,
    FormData
  >(rejectPlan, undefined);
  const [applyState, applyAction, applyPending] = useActionState<
    ApplyPlanState,
    FormData
  >(applyPlan, undefined);

  if (!plan.canApprove && !plan.canReject && !plan.canApply) {
    return null;
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Review Actions
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">
        This plan is a proposal only. Approving records your decision; applying creates
        projects, features, and tasks. No agent or GitHub execution starts automatically.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {plan.canApprove && (
          <form action={approveAction} className="flex flex-col gap-2">
            <input type="hidden" name="planningDraftId" value={plan.id} />
            <label className="text-xs text-neutral-500" htmlFor={`approve-notes-${plan.id}`}>
              Approval notes (optional)
            </label>
            <textarea
              id={`approve-notes-${plan.id}`}
              name="notes"
              rows={2}
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
              placeholder="Optional context for the approval record"
            />
            {approveState && "error" in approveState && (
              <p className="text-xs text-red-400">{approveState.error}</p>
            )}
            {approveState && "success" in approveState && (
              <p className="text-xs text-emerald-400">Plan approved.</p>
            )}
            <Button type="submit" loading={approvePending} className="self-start">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve plan
            </Button>
          </form>
        )}

        {plan.canReject && (
          <form action={rejectAction} className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
            <input type="hidden" name="planningDraftId" value={plan.id} />
            <label className="text-xs text-neutral-500" htmlFor={`reject-reason-${plan.id}`}>
              Rejection reason
            </label>
            <textarea
              id={`reject-reason-${plan.id}`}
              name="reason"
              rows={2}
              required
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
              placeholder="Explain why this plan should not proceed"
            />
            {rejectState && "error" in rejectState && (
              <p className="text-xs text-red-400">{rejectState.error}</p>
            )}
            {rejectState && "success" in rejectState && (
              <p className="text-xs text-amber-400">Plan rejected. No work records were created.</p>
            )}
            <Button
              type="submit"
              variant="destructive"
              loading={rejectPending}
              className="self-start"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject plan
            </Button>
          </form>
        )}

        {plan.canApply && (
          <form action={applyAction} className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
            <input type="hidden" name="planningDraftId" value={plan.id} />
            <p className="text-xs text-neutral-500">
              Apply this approved plan to create work records in Avion.
            </p>
            {applyState && "error" in applyState && (
              <p className="text-xs text-red-400">{applyState.error}</p>
            )}
            {applyState && "success" in applyState && (
              <p className="text-xs text-emerald-400">
                Work created: {applyState.projectsCreated} project(s),{" "}
                {applyState.featuresCreated} feature(s), {applyState.tasksCreated} task(s).
              </p>
            )}
            <Button type="submit" loading={applyPending} className="self-start">
              <PlayCircle className="h-3.5 w-3.5" />
              Apply plan and create work
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
