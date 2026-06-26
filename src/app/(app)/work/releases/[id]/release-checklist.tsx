"use client";

import { useState, useTransition } from "react";
import { updateReleaseChecklist } from "@/app/actions/releases";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";

type ChecklistItem = { id: string; label: string; checked: boolean };

export function ReleaseChecklist({
  releaseId,
  initialChecklist,
}: {
  releaseId: string;
  initialChecklist: ChecklistItem[];
}) {
  const [checklist, setChecklist] = useState(initialChecklist);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleItem(itemId: string) {
    const next = checklist.map((c) =>
      c.id === itemId ? { ...c, checked: !c.checked } : c
    );
    setChecklist(next);
    startTransition(async () => {
      await updateReleaseChecklist(releaseId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {checklist.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={pending}
          onClick={() => toggleItem(item.id)}
          className="group flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800 disabled:opacity-60"
        >
          {item.checked ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="h-3.5 w-3.5 shrink-0 text-neutral-600 group-hover:text-neutral-500 transition-colors" />
          )}
          <span
            className={
              item.checked
                ? "text-sm text-neutral-500 line-through"
                : "text-sm text-neutral-300"
            }
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
