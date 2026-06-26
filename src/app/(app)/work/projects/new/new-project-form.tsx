"use client";

import { useActionState } from "react";
import { createProject } from "@/app/actions/work";

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-xs font-medium text-neutral-400"
        >
          Project name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          placeholder="e.g., Authentication System"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-xs font-medium text-neutral-400"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What is this project delivering?"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors resize-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="status"
          className="text-xs font-medium text-neutral-400"
        >
          Initial status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="planning"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
        >
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {state?.message && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
