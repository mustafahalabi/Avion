"use client";

import { useTransition, useState } from "react";
import { addTaskToRelease, removeTaskFromRelease } from "@/app/actions/releases";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface Props {
  releaseId: string;
  releasedTasks: Task[];
  availableTasks: Task[];
}

const STATUS_COLORS: Record<string, string> = {
  done: "text-emerald-400",
  "in-review": "text-amber-400",
  "in-progress": "text-blue-400",
  todo: "text-neutral-500",
};

export function ReleaseTasksSection({ releaseId, releasedTasks, availableTasks }: Props) {
  const [pending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const router = useRouter();

  function handleAdd(taskId: string) {
    startTransition(async () => {
      await addTaskToRelease(releaseId, taskId);
      router.refresh();
      setShowPicker(false);
    });
  }

  function handleRemove(taskId: string) {
    startTransition(async () => {
      await removeTaskFromRelease(releaseId, taskId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Tasks in this Release ({releasedTasks.length})
        </h3>
        {availableTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add task
          </button>
        )}
      </div>

      {releasedTasks.length === 0 && !showPicker && (
        <p className="text-xs text-neutral-700 py-2">
          No tasks linked yet. Add completed or in-review tasks to group them into this release.
        </p>
      )}

      {releasedTasks.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {releasedTasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="flex-1 text-sm text-neutral-300 truncate">{task.title}</span>
              <span className={cn("text-[11px] font-medium capitalize shrink-0", STATUS_COLORS[task.status] ?? "text-neutral-500")}>
                {task.status.replace("-", " ")}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(task.id)}
                className="shrink-0 text-neutral-700 hover:text-red-400 disabled:opacity-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2">
          <p className="px-2 py-1 text-[11px] text-neutral-600 font-medium uppercase tracking-wider">
            Done or in-review tasks
          </p>
          {availableTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              disabled={pending}
              onClick={() => handleAdd(task.id)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3 w-3 shrink-0 text-neutral-600" />
              <span className="flex-1 text-sm text-neutral-300 truncate">{task.title}</span>
              <span className={cn("text-[11px] font-medium capitalize shrink-0", STATUS_COLORS[task.status] ?? "text-neutral-500")}>
                {task.status.replace("-", " ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
