"use client";

import { useActionState, useEffect } from "react";
import { createReleaseCandidate } from "@/app/actions/releases";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

interface EligibleTask {
  id: string;
  title: string;
}

interface Props {
  eligibleTasks: readonly EligibleTask[];
}

export function CreateReleaseCandidateForm({ eligibleTasks }: Props) {
  const [state, action, pending] = useActionState(createReleaseCandidate, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state && "success" in state) {
      router.push(`/work/releases/${state.id}`);
    }
  }, [state, router]);

  if (eligibleTasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-800 py-10 text-center">
        <p className="text-sm font-medium text-neutral-500">No eligible tasks</p>
        <p className="mt-1 text-xs text-neutral-700 max-w-sm mx-auto">
          Tasks must be done with an approved review and passed QA before they can be included in a release candidate.
        </p>
        <Link
          href="/work/releases"
          className="mt-4 inline-block text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Back to releases
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Version <span className="text-red-500">*</span>
        </label>
        <input
          name="version"
          type="text"
          required
          placeholder="v2.0.0-rc1"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 font-mono outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Title <span className="text-neutral-700">(optional)</span>
        </label>
        <input
          name="title"
          type="text"
          placeholder="Release candidate"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-neutral-400">
          Eligible Tasks <span className="text-red-500">*</span>
        </label>
        <p className="text-[11px] text-neutral-600">
          Only completed tasks with approved review and passed QA are shown.
        </p>
        <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 p-2">
          {eligibleTasks.map((task) => (
            <label
              key={task.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-neutral-800 transition-colors"
            >
              <input
                type="checkbox"
                name="taskIds"
                value={task.id}
                defaultChecked
                className="rounded border-neutral-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/30"
              />
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="flex-1 text-sm text-neutral-300 truncate">{task.title}</span>
            </label>
          ))}
        </div>
      </div>

      {state && "error" in state && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}

      {state && "success" in state && state.rejectedTasks.length > 0 && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-300">Some tasks were skipped:</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {state.rejectedTasks.map((r) => (
              <li key={r.taskId} className="text-[11px] text-amber-200/80">
                {r.taskId}: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Creating…" : "Create release candidate"}
        </button>
        <Link
          href="/work/releases"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
