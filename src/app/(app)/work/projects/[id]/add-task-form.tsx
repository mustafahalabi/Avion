"use client";

import { useActionState, useState } from "react";
import { createTask } from "@/app/actions/work";
import { Plus, X } from "lucide-react";

interface Props {
  projectId: string;
  employees: { id: string; name: string }[];
}

export function AddTaskForm({ projectId, employees }: Props) {
  const [open, setOpen] = useState(false);
  const boundAction = createTask.bind(null, projectId);
  const [state, action, pending] = useActionState(boundAction, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">New task</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        name="title"
        type="text"
        required
        autoFocus
        placeholder="Task title"
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
      />

      <textarea
        name="description"
        rows={2}
        placeholder="Description (optional)"
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
      />

      <div className="flex gap-2">
        <select
          name="priority"
          defaultValue="medium"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500 transition-colors"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <select
          name="status"
          defaultValue="todo"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500 transition-colors"
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
        </select>

        {employees.length > 0 && (
          <select
            name="assigneeId"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500 transition-colors"
          >
            <option value="">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {state?.errors?.title && (
        <p className="text-xs text-red-400">{state.errors.title[0]}</p>
      )}
      {state?.message && (
        <p className="text-xs text-red-400">{state.message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
