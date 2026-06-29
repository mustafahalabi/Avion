"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, AlertCircle, HelpCircle } from "lucide-react";

import { ingestExecutionResult } from "@/app/actions/execution";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  taskId: string;
}

const STATUS_OPTIONS = [
  {
    value: "completed",
    label: "Completed",
    description: "Implementation succeeded. Task will move to In Review.",
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
  },
  {
    value: "failed",
    label: "Failed",
    description: "Implementation failed. Task stays actionable.",
    icon: AlertCircle,
    iconClass: "text-red-400",
  },
  {
    value: "needs_clarification",
    label: "Needs Clarification",
    description: "Ambiguities must be resolved before implementation can continue.",
    icon: HelpCircle,
    iconClass: "text-amber-400",
  },
] as const;

/**
 * Form component for recording the result of an external agent execution run.
 *
 * Shows a submission form when a prepared or running session exists for the task.
 * On success it renders a result summary; the page data is revalidated via the
 * server action so the component can be a simple controlled form.
 */
export function ExecutionResultForm({ sessionId, taskId }: Props) {
  const [state, formAction, isPending] = useActionState(ingestExecutionResult, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state?.success]);

  if (state?.success) {
    return (
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">Execution result recorded</p>
        </div>
        {state.taskStatusChanged && state.newTaskStatus && (
          <p className="mt-1 text-xs text-emerald-600">
            Task status updated to{" "}
            <span className="font-medium capitalize text-emerald-500">
              {state.newTaskStatus.replace(/-/g, " ")}
            </span>
            .
          </p>
        )}
        {!state.taskStatusChanged && (
          <p className="mt-1 text-xs text-emerald-600">Task status was not changed.</p>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="taskId" value={taskId} />

      {/* Status */}
      <div>
        <label className="text-xs font-medium text-neutral-400">
          Execution Status <span className="text-red-400">*</span>
        </label>
        <div className="mt-2 flex flex-col gap-2">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                  "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
                )}
              >
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  className="mt-0.5 accent-neutral-400"
                  defaultChecked={option.value === "completed"}
                  required
                />
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", option.iconClass)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200">{option.label}</p>
                  <p className="text-xs text-neutral-500">{option.description}</p>
                </div>
              </label>
            );
          })}
        </div>
        {state?.errors?.status && (
          <p className="mt-1 text-xs text-red-400">{state.errors.status[0]}</p>
        )}
      </div>

      {/* Result summary */}
      <div>
        <label
          htmlFor="resultSummary"
          className="block text-xs font-medium text-neutral-400"
        >
          Result Summary
        </label>
        <textarea
          id="resultSummary"
          name="resultSummary"
          rows={4}
          placeholder="Describe what the agent did, what changed, and how you verified it."
          className="mt-1.5 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      {/* Files changed */}
      <div>
        <label
          htmlFor="filesChanged"
          className="block text-xs font-medium text-neutral-400"
        >
          Files Changed{" "}
          <span className="font-normal text-neutral-600">(one per line)</span>
        </label>
        <textarea
          id="filesChanged"
          name="filesChanged"
          rows={4}
          placeholder={"src/lib/foo.ts\nsrc/lib/foo.test.ts"}
          className="mt-1.5 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      {/* Validation output */}
      <div>
        <label
          htmlFor="validationOutput"
          className="block text-xs font-medium text-neutral-400"
        >
          Validation Output
        </label>
        <textarea
          id="validationOutput"
          name="validationOutput"
          rows={4}
          placeholder={"✅ tsc --noEmit: OK\n✅ lint: OK\n✅ test: 42/42 passed"}
          className="mt-1.5 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      {/* Error message (for failed/needs_clarification) */}
      <div>
        <label
          htmlFor="errorMessage"
          className="block text-xs font-medium text-neutral-400"
        >
          Error or Blocker{" "}
          <span className="font-normal text-neutral-600">(if failed or needs clarification)</span>
        </label>
        <textarea
          id="errorMessage"
          name="errorMessage"
          rows={2}
          placeholder="Describe the error or what clarification is needed."
          className="mt-1.5 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-3">
        <p className="text-xs font-medium text-neutral-400">Git / Pull Request (optional)</p>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor="commitSha" className="block text-xs text-neutral-500">
              Commit SHA
            </label>
            <input
              id="commitSha"
              name="commitSha"
              type="text"
              placeholder="abc1234"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label htmlFor="prUrl" className="block text-xs text-neutral-500">
              Pull Request URL
            </label>
            <input
              id="prUrl"
              name="prUrl"
              type="url"
              placeholder="https://github.com/org/repo/pull/42"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prNumber" className="block text-xs text-neutral-500">
                PR Number
              </label>
              <input
                id="prNumber"
                name="prNumber"
                type="number"
                min={1}
                placeholder="42"
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label htmlFor="prStatus" className="block text-xs text-neutral-500">
                PR Status
              </label>
              <select
                id="prStatus"
                name="prStatus"
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-neutral-500"
              >
                <option value="">Not set</option>
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="merged">Merged</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Server error */}
      {state?.message && (
        <p className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          isPending
            ? "cursor-not-allowed bg-neutral-800 text-neutral-500"
            : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Recording result…
          </>
        ) : (
          "Record Execution Result"
        )}
      </button>
    </form>
  );
}
