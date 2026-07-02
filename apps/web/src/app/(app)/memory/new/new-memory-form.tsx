"use client";

import { useActionState } from "react";
import { createMemory } from "@/app/actions/memory";

const CATEGORIES = [
  { value: "company", label: "Company" },
  { value: "architecture", label: "Architecture" },
  { value: "product", label: "Product" },
  { value: "security", label: "Security" },
  { value: "operations", label: "Operations" },
  { value: "employee", label: "Employee" },
  { value: "feature", label: "Feature" },
  { value: "decision", label: "Decision" },
];

export function NewMemoryForm() {
  const [state, action, pending] = useActionState(createMemory, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-xs font-medium text-neutral-400">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          autoFocus
          placeholder="e.g., Architecture Decisions"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
        {state?.errors?.title && (
          <p className="text-xs text-red-400">{state.errors.title[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="category"
          className="text-xs font-medium text-neutral-400"
        >
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue="company"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 transition-colors"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="summary"
          className="text-xs font-medium text-neutral-400"
        >
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          placeholder="What does this memory bank contain?"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
        />
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
          {pending ? "Creating…" : "Create memory"}
        </button>
      </div>
    </form>
  );
}
