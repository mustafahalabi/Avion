"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveOnboardingSettings } from "./actions";
import { OptionCard } from "./option-card";
import type {
  OnboardingProgress,
  OnboardingStepId,
} from "@/lib/onboarding-progress";

// ─── Constants ──────────────────────────────────────────────────────────────

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

const STEP_LINKS: Record<
  Exclude<OnboardingStepId, "company">,
  { href: string; cta: string }
> = {
  provider: { href: "/integrations", cta: "Connect a provider" },
  repository: { href: "/work/repositories/new", cta: "Add a repository" },
  outcome: { href: "/work/outcomes/new", cta: "Submit an outcome" },
};

// ─── Step circle ──────────────────────────────────────────────────────────────

function StepCircle({
  index,
  complete,
  current,
}: {
  index: number;
  complete: boolean;
  current: boolean;
}) {
  if (complete) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Check className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        current ? "bg-white text-neutral-900" : "bg-neutral-800 text-neutral-500"
      )}
    >
      {index + 1}
    </div>
  );
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  companyId: string;
  companyName: string;
  defaultAutonomy: string;
  defaultCulture: string;
  progress: OnboardingProgress;
}

export function OnboardingFlow({
  companyId,
  companyName,
  defaultAutonomy,
  defaultCulture,
  progress,
}: OnboardingFlowProps) {
  const [name, setName] = useState(companyName);
  const [autonomy, setAutonomy] = useState(defaultAutonomy);
  const [culture, setCulture] = useState(defaultCulture);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveOnboardingSettings({
          companyId,
          name,
          autonomyLevel: autonomy,
          cultureProfile: culture,
        });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
            <span className="text-sm font-bold text-neutral-900">E</span>
          </div>
          <span className="text-base font-semibold text-neutral-100">
            Engineering OS
          </span>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
          <h1 className="text-lg font-semibold text-neutral-100">
            Set up your company
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            A few steps to get your company ready. You can return here any time.
          </p>

          {/* Progress bar */}
          <div className="mt-6 mb-8">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                {progress.completedCount} of {progress.steps.length} complete
              </span>
              <span className="text-xs text-neutral-500">
                {progress.percentComplete}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-3">
            {progress.steps.map((step, index) => {
              const complete = step.status === "complete";
              const current = step.status === "current";
              return (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    current
                      ? "border-neutral-700 bg-neutral-800/40"
                      : "border-neutral-800 bg-neutral-900/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <StepCircle
                      index={index}
                      complete={complete}
                      current={current}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            complete || current
                              ? "text-neutral-100"
                              : "text-neutral-400"
                          )}
                        >
                          {step.title}
                        </p>
                        {complete && (
                          <span className="text-[11px] font-medium text-emerald-400">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {step.description}
                      </p>

                      {/* Company step: inline configuration form */}
                      {step.id === "company" && !complete && (
                        <form
                          onSubmit={saveCompany}
                          className="mt-4 flex flex-col gap-5"
                        >
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                              Company Name
                            </p>
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                              placeholder="Acme Corp"
                              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-600 focus:ring-0"
                            />
                          </div>

                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                              Autonomy Level
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {AUTONOMY_OPTIONS.map((opt) => (
                                <OptionCard
                                  key={opt.value}
                                  value={opt.value}
                                  label={opt.label}
                                  description={opt.description}
                                  recommended={
                                    "recommended" in opt
                                      ? opt.recommended
                                      : undefined
                                  }
                                  selected={autonomy === opt.value}
                                  onSelect={setAutonomy}
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                              Culture Profile
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {CULTURE_OPTIONS.map((opt) => (
                                <OptionCard
                                  key={opt.value}
                                  value={opt.value}
                                  label={opt.label}
                                  description={opt.description}
                                  recommended={
                                    "recommended" in opt
                                      ? opt.recommended
                                      : undefined
                                  }
                                  selected={culture === opt.value}
                                  onSelect={setCulture}
                                />
                              ))}
                            </div>
                          </div>

                          {error && (
                            <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                              {error}
                            </p>
                          )}

                          <Button
                            type="submit"
                            size="lg"
                            loading={isPending}
                            className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
                          >
                            Save company
                          </Button>
                        </form>
                      )}

                      {/* Other steps: link out to the relevant page */}
                      {step.id !== "company" && !complete && (
                        <Link
                          href={STEP_LINKS[step.id].href}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
                        >
                          {STEP_LINKS[step.id].cta}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Completion CTA */}
          {progress.isComplete && (
            <Link
              href="/control-center"
              className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              Enter your company
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
