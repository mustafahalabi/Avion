"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveCompanySettings } from "@/app/(auth)/onboarding/actions";

const AUTONOMY_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "assist", label: "Assist" },
  { value: "delegate", label: "Delegate" },
  { value: "autonomous", label: "Autonomous" },
] as const;

const CULTURE_OPTIONS = [
  { value: "startup", label: "Startup" },
  { value: "enterprise", label: "Enterprise" },
  { value: "design-first", label: "Design First" },
  { value: "performance-first", label: "Performance First" },
] as const;

interface Props {
  companyId: string;
  companyName: string;
  autonomyLevel: string;
  cultureProfile: string;
}

export function SettingsForm({ companyId, companyName, autonomyLevel: initialAutonomy, cultureProfile: initialCulture }: Props) {
  const [autonomy, setAutonomy] = useState(initialAutonomy);
  const [culture, setCulture] = useState(initialCulture);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await saveCompanySettings({ companyId, autonomyLevel: autonomy, cultureProfile: culture });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-800">
        <p className="text-xs text-neutral-500 mb-0.5">Company name</p>
        <p className="text-sm text-neutral-200">{companyName}</p>
      </div>

      <div className="px-5 py-4 border-b border-neutral-800">
        <p className="text-xs font-medium text-neutral-400 mb-3">Autonomy level</p>
        <div className="flex gap-2 flex-wrap">
          {AUTONOMY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAutonomy(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                autonomy === opt.value
                  ? "border-neutral-500 bg-neutral-700 text-neutral-100"
                  : "border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 border-b border-neutral-800">
        <p className="text-xs font-medium text-neutral-400 mb-3">Culture profile</p>
        <div className="flex gap-2 flex-wrap">
          {CULTURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCulture(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                culture === opt.value
                  ? "border-neutral-500 bg-neutral-700 text-neutral-100"
                  : "border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-3">
        {saved && (
          <p className="text-xs text-green-400">Saved</p>
        )}
        <Button type="submit" size="sm" loading={isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
