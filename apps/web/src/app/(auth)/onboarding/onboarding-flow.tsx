"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { saveOnboardingSettings } from "./actions";
import { OptionCard } from "./option-card";
import { OAuthConnectButton } from "@/components/integrations/oauth-connect-button";
import { GitHubRepositoryPicker } from "@/components/integrations/github-repository-picker";
import type {
  OnboardingProgress,
  OnboardingStepId,
} from "@/lib/onboarding-progress";

/** Per-provider connection state for the connect step. */
export interface OnboardingProviderCard {
  id: string;
  name: string;
  /** OAuth env credentials present so the Connect button works. */
  configured: boolean;
  /** This provider specifically is connected. */
  connected: boolean;
  accountName: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STEP_ORDER: readonly OnboardingStepId[] = [
  "company",
  "provider",
  "repository",
  "outcome",
];

const STEP_LABELS: Record<OnboardingStepId, string> = {
  company: "Company",
  provider: "Connect",
  repository: "Repository",
  outcome: "Outcome",
};

const STEP_HEADING: Record<OnboardingStepId, { title: string; subtitle: string }> = {
  company: {
    title: "Configure your company",
    subtitle: "Name it and choose how it operates.",
  },
  provider: {
    title: "Connect your tools",
    subtitle:
      "Link GitHub so your company can reach your code. Linear is optional.",
  },
  repository: {
    title: "Add a repository",
    subtitle: "Point your company at the codebase it will work in.",
  },
  outcome: {
    title: "You're ready",
    subtitle: "Tell your company what to build — from chat or a new outcome.",
  },
};

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

function isStepId(value: string | null): value is OnboardingStepId {
  return (
    value === "company" ||
    value === "provider" ||
    value === "repository" ||
    value === "outcome"
  );
}

// ─── Stepper rail ─────────────────────────────────────────────────────────────

function StepCircle({
  index,
  complete,
  active,
}: {
  index: number;
  complete: boolean;
  active: boolean;
}) {
  if (complete && !active) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Check className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
        active
          ? "bg-white text-neutral-900 ring-2 ring-white/30"
          : "bg-neutral-800 text-neutral-500"
      )}
    >
      {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
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
  providerCards: OnboardingProviderCard[];
  githubConnected: boolean;
}

export function OnboardingFlow({
  companyId,
  companyName,
  defaultAutonomy,
  defaultCulture,
  progress,
  providerCards,
  githubConnected,
}: OnboardingFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The active step is URL-driven so it survives the OAuth full-page round-trip
  // (connect buttons return to `/onboarding?step=<id>`). Falls back to the first
  // incomplete step, then the last step when everything is done.
  const stepParam = searchParams.get("step");
  const activeStep: OnboardingStepId = isStepId(stepParam)
    ? stepParam
    : progress.currentStep ?? "outcome";
  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const isLast = activeIndex === STEP_ORDER.length - 1;

  const [name, setName] = useState(companyName);
  const [autonomy, setAutonomy] = useState(defaultAutonomy);
  const [culture, setCulture] = useState(defaultCulture);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const githubConfigured =
    providerCards.find((p) => p.id === "github")?.configured ?? false;

  function goToStep(id: OnboardingStepId) {
    router.push(`/onboarding?step=${id}`, { scroll: false });
  }
  function goNext() {
    if (!isLast) goToStep(STEP_ORDER[activeIndex + 1]);
  }
  function goBack() {
    if (activeIndex > 0) goToStep(STEP_ORDER[activeIndex - 1]);
  }

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
        goToStep("provider");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      }
    });
  }

  const heading = STEP_HEADING[activeStep];

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
            <BrandMark className="h-4 w-4 text-neutral-900" />
          </div>
          <span className="text-base font-semibold text-neutral-100">Avion</span>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
          {/* Stepper rail — the steps, in order */}
          <div className="flex items-center">
            {progress.steps.map((step, i) => (
              <div
                key={step.id}
                className={cn("flex items-center", i < progress.steps.length - 1 && "flex-1")}
              >
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <StepCircle
                    index={i}
                    complete={step.status === "complete"}
                    active={step.id === activeStep}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      step.id === activeStep ? "text-neutral-200" : "text-neutral-600"
                    )}
                  >
                    {STEP_LABELS[step.id]}
                  </span>
                </button>
                {i < progress.steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 mb-4 h-px flex-1",
                      step.status === "complete" ? "bg-emerald-500/40" : "bg-neutral-800"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Heading */}
          <div className="mt-7">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">
              Step {activeIndex + 1} of {STEP_ORDER.length}
            </p>
            <h1 className="mt-1 text-lg font-semibold text-neutral-100">
              {heading.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{heading.subtitle}</p>
          </div>

          {/* Panel */}
          <div className="mt-6">
            {activeStep === "company" && (
              <form
                id="onboarding-company-form"
                onSubmit={saveCompany}
                className="flex flex-col gap-5"
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
                        recommended={"recommended" in opt ? opt.recommended : undefined}
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
                        recommended={"recommended" in opt ? opt.recommended : undefined}
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
              </form>
            )}

            {/* Connect step — each provider renders on its OWN status, so
                connecting GitHub never hides the Linear option. */}
            {activeStep === "provider" && (
              <div className="flex flex-col gap-2">
                {providerCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-200">
                        {card.name}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {card.connected
                          ? card.accountName
                            ? `Connected · ${card.accountName}`
                            : "Connected"
                          : card.id === "github"
                            ? "Reach your code and open pull requests"
                            : "Sync issues, projects, and cycles"}
                      </p>
                    </div>
                    {card.connected ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        Connected
                      </span>
                    ) : (
                      <OAuthConnectButton
                        provider={card.id}
                        configured={card.configured}
                        returnTo="/onboarding?step=provider"
                        label="Connect"
                      />
                    )}
                  </div>
                ))}
                <Link
                  href="/integrations"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600 transition-colors hover:text-neutral-400"
                >
                  Or connect with a manual token
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeStep === "repository" && (
              <div>
                {githubConnected ? (
                  <GitHubRepositoryPicker returnTo="/onboarding?step=repository" />
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3.5 py-4">
                    <p className="text-xs text-neutral-500">
                      Connect GitHub to pick a repository, or add one manually.
                    </p>
                    <div className="flex items-center gap-2">
                      <OAuthConnectButton
                        provider="github"
                        configured={githubConfigured}
                        returnTo="/onboarding?step=repository"
                        label="Connect"
                      />
                      <Link
                        href="/work/repositories/new"
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-600 transition-colors hover:text-neutral-400"
                      >
                        Add manually
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeStep === "outcome" && (
              <div className="flex flex-col gap-3">
                {progress.isComplete ? (
                  <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-4">
                    <p className="text-sm font-medium text-neutral-100">
                      Your company is ready.
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Head to chat and tell it what to build, or open your control
                      center.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-neutral-400">
                      Tell your company what you want built. Start from chat, or
                      create a structured outcome.
                    </p>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/chat"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
                      >
                        Open chat
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href="/work/outcomes/new"
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-600 transition-colors hover:text-neutral-400"
                      >
                        New outcome
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {activeIndex > 0 ? (
              <Button type="button" variant="ghost" size="lg" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <span />
            )}

            {activeStep === "company" ? (
              <Button
                type="submit"
                form="onboarding-company-form"
                size="lg"
                loading={isPending}
                className="bg-white text-neutral-900 hover:bg-neutral-100"
              >
                Save &amp; continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : isLast ? (
              <Link
                href="/control-center"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
              >
                Enter your company
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                className="bg-white text-neutral-900 hover:bg-neutral-100"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-600">
          You can return to setup any time.
        </p>
      </div>
    </div>
  );
}
