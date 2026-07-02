"use client";

import { useState, useTransition } from "react";
import { submitQaVerdict, type SubmitQaVerdict } from "@/app/actions/quality";
import type { QaFinding } from "@/lib/qa-service";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, XCircle, HelpCircle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  qaResultId: string;
  allChecksPassed: boolean;
}

const VERDICT_OPTIONS: {
  value: SubmitQaVerdict;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}[] = [
  {
    value: "passed",
    label: "Pass",
    icon: CheckCircle2,
    activeClass: "border-emerald-700 bg-emerald-950/30 text-emerald-400",
  },
  {
    value: "failed",
    label: "Fail",
    icon: AlertCircle,
    activeClass: "border-red-700 bg-red-950/30 text-red-400",
  },
  {
    value: "blocked",
    label: "Blocked",
    icon: XCircle,
    activeClass: "border-amber-700 bg-amber-950/30 text-amber-400",
  },
  {
    value: "needs_clarification",
    label: "Needs Clarification",
    icon: HelpCircle,
    activeClass: "border-blue-700 bg-blue-950/30 text-blue-400",
  },
];

export function QaVerdictForm({ qaResultId, allChecksPassed }: Props) {
  const [verdict, setVerdict] = useState<SubmitQaVerdict>("passed");
  const [notes, setNotes] = useState("");
  const [findings, setFindings] = useState<QaFinding[]>([]);
  const [newFinding, setNewFinding] = useState("");
  const [newFindingSeverity, setNewFindingSeverity] = useState<"blocker" | "non_blocker">("blocker");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function addFinding() {
    const desc = newFinding.trim();
    if (!desc) return;
    setFindings((prev) => [
      ...prev,
      {
        severity: newFindingSeverity,
        description: desc,
        actionable: newFindingSeverity === "blocker",
      },
    ]);
    setNewFinding("");
  }

  function removeFinding(index: number) {
    setFindings((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verdict === "passed" && !allChecksPassed) {
      setError("All required checks must pass before marking QA as passed.");
      return;
    }
    if (verdict === "failed" && !notes.trim() && findings.length === 0) {
      setError("Describe the failure or add at least one finding.");
      return;
    }
    if (verdict === "blocked" && !notes.trim()) {
      setError("Describe why QA is blocked.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitQaVerdict(qaResultId, verdict, notes.trim(), findings);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const showFindings =
    verdict === "failed" || verdict === "blocked" || verdict === "needs_clarification";

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {VERDICT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = verdict === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVerdict(opt.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                active ? opt.activeClass : "border-neutral-700 text-neutral-500 hover:bg-neutral-800"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {verdict === "passed" && !allChecksPassed && (
        <p className="text-xs text-amber-400">
          One or more checklist items have not passed. Mark them as passed or choose Fail.
        </p>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder={
          verdict === "passed"
            ? "Optional QA notes…"
            : verdict === "failed"
            ? "Describe what failed (or use findings below)…"
            : verdict === "blocked"
            ? "Describe why QA is blocked…"
            : "What needs clarification?"
        }
        required={verdict === "blocked"}
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
      />

      {showFindings && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Findings
          </p>

          {findings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {findings.map((f, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2",
                    f.severity === "blocker"
                      ? "border-red-900/40 bg-red-950/10"
                      : "border-neutral-800 bg-neutral-900"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      f.severity === "blocker"
                        ? "bg-red-900/40 text-red-400"
                        : "bg-neutral-800 text-neutral-500"
                    )}
                  >
                    {f.severity === "blocker" ? "Blocker" : "Non-blocker"}
                  </span>
                  <p className="flex-1 text-xs text-neutral-300">{f.description}</p>
                  <button
                    type="button"
                    onClick={() => removeFinding(i)}
                    className="mt-0.5 shrink-0 text-neutral-600 hover:text-neutral-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={newFindingSeverity}
              onChange={(e) =>
                setNewFindingSeverity(e.target.value as "blocker" | "non_blocker")
              }
              className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500 transition-colors"
            >
              <option value="blocker">Blocker</option>
              <option value="non_blocker">Non-blocker</option>
            </select>
            <input
              type="text"
              value={newFinding}
              onChange={(e) => setNewFinding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFinding();
                }
              }}
              placeholder="Describe finding…"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
            />
            <button
              type="button"
              onClick={addFinding}
              className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
      >
        {pending ? "Submitting…" : "Submit QA Result"}
      </button>
    </form>
  );
}
