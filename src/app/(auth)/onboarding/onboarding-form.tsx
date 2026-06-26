"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveOnboardingSettings } from "./actions";

const AUTONOMY_OPTIONS = [
  {
    value: "manual",
    label: "Manual",
    description: "You approve every action before it happens.",
  },
  {
    value: "assist",
    label: "Assist",
    description: "Company implements; you approve before code merges.",
    recommended: true,
  },
  {
    value: "delegate",
    label: "Delegate",
    description: "Company completes features; you approve before deployment.",
  },
  {
    value: "autonomous",
    label: "Autonomous",
    description: "Company operates independently; you receive summaries.",
  },
] as const;

const CULTURE_OPTIONS = [
  {
    value: "startup",
    label: "Startup",
    description: "Move fast, accept calculated debt, optimise for speed.",
    recommended: true,
  },
  {
    value: "enterprise",
    label: "Enterprise",
    description: "Extensive reviews, security-first, documentation required.",
  },
  {
    value: "design-first",
    label: "Design First",
    description: "Premium UX, accessibility, motion, and typography.",
  },
  {
    value: "performance-first",
    label: "Performance First",
    description: "Minimal resources, fast loading, lean architecture.",
  },
] as const;

interface Props {
  companyId: string;
  defaultAutonomy: string;
  defaultCulture: string;
}

export function OnboardingForm({ companyId, defaultAutonomy, defaultCulture }: Props) {
  const [autonomy, setAutonomy] = useState(defaultAutonomy);
  const [culture, setCulture] = useState(defaultCulture);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await saveOnboardingSettings({ companyId, autonomyLevel: autonomy, cultureProfile: culture });
      router.push("/dashboard");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Autonomy Level
        </p>
        <div className="grid grid-cols-2 gap-2">
          {AUTONOMY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAutonomy(opt.value)}
              className={cn(
                "relative rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500",
                autonomy === opt.value
                  ? "border-neutral-500 bg-neutral-800"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
              )}
            >
              {"recommended" in opt && opt.recommended && (
                <span className="absolute right-2 top-2 rounded-full bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                  Default
                </span>
              )}
              <p className="text-sm font-medium text-neutral-100">{opt.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Culture Profile
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CULTURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCulture(opt.value)}
              className={cn(
                "relative rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500",
                culture === opt.value
                  ? "border-neutral-500 bg-neutral-800"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
              )}
            >
              {"recommended" in opt && opt.recommended && (
                <span className="absolute right-2 top-2 rounded-full bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                  Default
                </span>
              )}
              <p className="text-sm font-medium text-neutral-100">{opt.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={isPending}
        className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
      >
        Launch my company
      </Button>
    </form>
  );
}
