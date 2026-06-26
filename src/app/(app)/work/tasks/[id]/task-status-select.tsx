"use client";

import { useTransition } from "react";
import { updateTaskStatus } from "@/app/actions/work";
import { useRouter } from "next/navigation";

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "in-review", label: "In Review" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
  { value: "cancelled", label: "Cancelled" },
];

export function TaskStatusSelect({
  taskId,
  current,
}: {
  taskId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    startTransition(async () => {
      await updateTaskStatus(taskId, newStatus);
      router.refresh();
    });
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={pending}
      className="w-full rounded border border-neutral-700 bg-transparent py-0.5 text-sm font-medium text-neutral-200 outline-none focus:border-neutral-500 disabled:opacity-50 transition-colors"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value} className="bg-neutral-900">
          {s.label}
        </option>
      ))}
    </select>
  );
}
