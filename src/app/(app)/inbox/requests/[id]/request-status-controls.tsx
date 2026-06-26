"use client";

import { useTransition } from "react";
import { advanceRequestStatus } from "@/app/actions/runtime";
import { useRouter } from "next/navigation";

const STATUS_TRANSITIONS: Record<
  string,
  { next: string; label: string; description: string }[]
> = {
  intake: [
    {
      next: "planning",
      label: "Start planning",
      description: "Product Manager has received the request and is drafting a plan.",
    },
    {
      next: "cancelled",
      label: "Cancel",
      description: "Request cancelled by CEO.",
    },
  ],
  planning: [
    {
      next: "awaiting_approval",
      label: "Request approval",
      description: "Feature brief is ready. Waiting for CEO approval.",
    },
    {
      next: "blocked",
      label: "Mark blocked",
      description: "Planning is blocked. Clarification needed.",
    },
  ],
  awaiting_approval: [
    {
      next: "executing",
      label: "Approve",
      description: "CEO approved. Engineering has started implementation.",
    },
    {
      next: "planning",
      label: "Request changes",
      description: "CEO requested changes. Returning to planning.",
    },
    {
      next: "cancelled",
      label: "Cancel",
      description: "Request cancelled by CEO.",
    },
  ],
  executing: [
    {
      next: "in_review",
      label: "Move to review",
      description: "Implementation complete. Reviewer is examining the code.",
    },
    {
      next: "blocked",
      label: "Mark blocked",
      description: "Execution blocked. Escalating to CEO.",
    },
  ],
  in_review: [
    {
      next: "in_qa",
      label: "Approve review",
      description: "Code review passed. Moving to QA validation.",
    },
    {
      next: "executing",
      label: "Return to engineering",
      description: "Review found issues. Returning to engineering.",
    },
  ],
  in_qa: [
    {
      next: "complete",
      label: "Mark complete",
      description: "QA passed. Request is complete.",
    },
    {
      next: "executing",
      label: "Return to engineering",
      description: "QA found defects. Returning to engineering.",
    },
  ],
  blocked: [
    {
      next: "intake",
      label: "Unblock",
      description: "Blocker resolved. Returning to intake.",
    },
    {
      next: "cancelled",
      label: "Cancel",
      description: "Request cancelled due to unresolvable blocker.",
    },
  ],
};

export function RequestStatusControls({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];
  if (transitions.length === 0) return null;

  function handleTransition(next: string, description: string) {
    startTransition(async () => {
      await advanceRequestStatus(requestId, next, description);
      router.refresh();
    });
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        Actions
      </h3>
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button
            key={t.next}
            type="button"
            disabled={pending}
            onClick={() => handleTransition(t.next, t.description)}
            className={
              t.next === "cancelled"
                ? "rounded-lg border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
                : t.next === "complete" || t.next === "executing" || t.next === "in_review"
                  ? "rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                  : "rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
