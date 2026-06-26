"use client";

import { useActionState, useState } from "react";
import { addMemoryRecord } from "@/app/actions/memory";
import { Plus, X } from "lucide-react";

export function AddRecordForm({ memoryId }: { memoryId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = addMemoryRecord.bind(null, memoryId);
  const [state, action, pending] = useActionState(boundAction, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add record
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setOpen(false);
      }}
      className="flex flex-col gap-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">New record</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        name="content"
        rows={4}
        required
        autoFocus
        placeholder="What should the company remember?"
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
      />

      <div className="flex gap-2">
        <input
          name="source"
          type="text"
          placeholder="Source (optional)"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
        <select
          name="confidence"
          defaultValue="1"
          className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500 transition-colors"
        >
          <option value="1">High confidence</option>
          <option value="0.8">Good confidence</option>
          <option value="0.5">Medium confidence</option>
          <option value="0.3">Low confidence</option>
        </select>
      </div>

      {state?.errors?.content && (
        <p className="text-xs text-red-400">{state.errors.content[0]}</p>
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
          {pending ? "Saving…" : "Save record"}
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
