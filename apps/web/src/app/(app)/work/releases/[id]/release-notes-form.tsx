"use client";

import { useState, useTransition } from "react";
import { updateReleaseNotes } from "@/app/actions/releases";
import { useRouter } from "next/navigation";

export function ReleaseNotesForm({
  releaseId,
  initialNotes,
  initialRollback,
}: {
  releaseId: string;
  initialNotes: string;
  initialRollback: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [rollback, setRollback] = useState(initialRollback);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      await updateReleaseNotes(releaseId, notes, rollback);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="What changed in this release? List features, fixes, and improvements…"
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-500">
          Rollback Plan
        </label>
        <textarea
          value={rollback}
          onChange={(e) => setRollback(e.target.value)}
          rows={2}
          placeholder="How to roll back if this release causes issues…"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="self-start rounded-lg border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : saved ? "Saved" : "Save notes"}
      </button>
    </div>
  );
}
