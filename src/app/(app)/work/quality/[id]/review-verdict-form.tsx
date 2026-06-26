"use client";

import { useState, useTransition } from "react";
import { submitReviewVerdict, type SubmitVerdict } from "@/app/actions/quality";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function ReviewVerdictForm({ reviewId }: { reviewId: string }) {
  const [verdict, setVerdict] = useState<SubmitVerdict>("approved");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verdict === "changes_requested" && !notes.trim()) {
      setError("Please describe the changes needed.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await submitReviewVerdict(reviewId, verdict, notes.trim());
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3">
      {/* Verdict toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setVerdict("approved")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            verdict === "approved"
              ? "border-emerald-700 bg-emerald-950/30 text-emerald-400"
              : "border-neutral-700 text-neutral-500 hover:bg-neutral-800"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setVerdict("changes_requested")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            verdict === "changes_requested"
              ? "border-amber-700 bg-amber-950/30 text-amber-400"
              : "border-neutral-700 text-neutral-500 hover:bg-neutral-800"
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Request Changes
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder={
          verdict === "approved"
            ? "Optional approval notes…"
            : "Describe the changes needed…"
        }
        required={verdict === "changes_requested"}
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
      >
        {pending
          ? "Submitting…"
          : verdict === "approved"
          ? "Approve"
          : "Request Changes"}
      </button>
    </form>
  );
}
