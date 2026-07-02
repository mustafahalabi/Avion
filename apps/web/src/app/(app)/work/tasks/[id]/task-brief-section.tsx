"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, Loader2 } from "lucide-react";

import { generateTaskBrief } from "@/app/actions/execution";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  taskStatus: string;
  /** Pre-existing brief from the latest prepared session, if any. */
  existingBrief: string | null;
}

/**
 * Renders the Claude implementation brief section on the task detail page.
 *
 * Shows a "Generate Brief" button for tasks in todo status and displays the
 * resulting brief with a copy-to-clipboard action.
 */
export function TaskBriefSection({ taskId, taskStatus, existingBrief }: Props) {
  const [state, formAction, isPending] = useActionState(generateTaskBrief, undefined);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brief = state?.brief ?? existingBrief;
  const canGenerate = taskStatus === "todo" || taskStatus === "in-progress";

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the textarea if clipboard API is unavailable
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Claude Implementation Brief
        </h3>
        {brief && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              copied
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy Brief
              </>
            )}
          </button>
        )}
      </div>

      {/* Error message */}
      {state?.message && !state.brief && (
        <p className="mt-2 text-xs text-red-400">{state.message}</p>
      )}

      {/* Brief display */}
      {brief ? (
        <div className="mt-3 relative">
          <pre className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap overflow-auto max-h-128 font-mono">
            {brief}
          </pre>
        </div>
      ) : (
        <div className="mt-3">
          {canGenerate ? (
            <form action={formAction}>
              <input type="hidden" name="taskId" value={taskId} />
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-medium transition-colors",
                  isPending
                    ? "cursor-not-allowed text-neutral-500"
                    : "text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800 hover:text-neutral-100"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                    Generating brief…
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 text-neutral-400" />
                    Generate Claude Brief
                  </>
                )}
              </button>
            </form>
          ) : (
            <p className="text-xs text-neutral-600">
              Brief generation is available for tasks in{" "}
              <span className="text-neutral-500">Todo</span> or{" "}
              <span className="text-neutral-500">In Progress</span> status.
            </p>
          )}
        </div>
      )}

      {/* Branch name hint */}
      {state?.branchName && (
        <p className="mt-2 text-xs text-neutral-600">
          Branch:{" "}
          <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">
            {state.branchName}
          </code>
        </p>
      )}
    </section>
  );
}
