"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveCompanySettings } from "@/app/(auth)/onboarding/actions";

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

const TOTAL_STEPS = 4;

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current
              ? "w-6 bg-white"
              : i < current
              ? "w-1.5 bg-neutral-500"
              : "w-1.5 bg-neutral-700"
          )}
        />
      ))}
    </div>
  );
}

// ─── Option card ─────────────────────────────────────────────────────────────

function OptionCard({
  value,
  label,
  description,
  recommended,
  selected,
  onSelect,
}: {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "relative rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500",
        selected
          ? "border-neutral-500 bg-neutral-800"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
      )}
    >
      {recommended && (
        <span className="absolute right-2 top-2 rounded-full bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
          Default
        </span>
      )}
      <p className="text-sm font-medium text-neutral-100">{label}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
    </button>
  );
}

// ─── Step 0: Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">
          Welcome to Engineering OS.
        </h1>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
          You&apos;re the CEO. Your company is standing by.
        </p>
        <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
          Let&apos;s configure your company in 3 quick steps so it behaves
          exactly the way you want from day one.
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        {[
          {
            num: "1",
            label: "Company style",
            desc: "Autonomy level and culture profile",
          },
          {
            num: "2",
            label: "Connect a repository",
            desc: "Link your codebase to Engineering OS",
          },
          {
            num: "3",
            label: "You're done",
            desc: "Meet your team and submit your first request",
          },
        ].map((item) => (
          <div key={item.num} className="flex items-center gap-3 py-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-neutral-400">
              {item.num}
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-300">
                {item.label}
              </p>
              <p className="text-[11px] text-neutral-600">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Button
        size="lg"
        className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
        onClick={onNext}
      >
        Get started
      </Button>
    </div>
  );
}

// ─── Step 1: Company style ───────────────────────────────────────────────────

function StepCompanyStyle({
  autonomy,
  culture,
  onAutonomyChange,
  onCultureChange,
  onNext,
  onBack,
}: {
  autonomy: string;
  culture: string;
  onAutonomyChange: (v: string) => void;
  onCultureChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">
          Company style
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          How should your company operate? These settings shape every decision
          your team makes.
        </p>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
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
              onSelect={onAutonomyChange}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
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
              onSelect={onCultureChange}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          className="flex-[2] bg-white text-neutral-900 hover:bg-neutral-100"
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Connect repository ──────────────────────────────────────────────

function StepRepository({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">
          Connect a repository
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Link a GitHub repository so your company can analyse, plan, and
          implement changes directly in your codebase.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
            {/* GitHub icon */}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-neutral-300"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-200">
              GitHub repository
            </p>
            <p className="text-xs text-neutral-600">
              Connect via the repository configuration page
            </p>
          </div>
        </div>

        <Link
          href="/work/repositories/new?return=/dashboard"
          className="flex items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          Connect repository
        </Link>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="flex-[2] text-neutral-500 hover:text-neutral-300"
          onClick={onNext}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Done ────────────────────────────────────────────────────────────

function StepDone({
  isPending,
  onFinish,
}: {
  isPending: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
          <svg
            className="h-6 w-6 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">
            Your company is ready.
          </h2>
          <p className="mt-2 text-sm text-neutral-500 leading-relaxed max-w-xs">
            Your team is standing by. Meet your employees, then submit your
            first request to put the company in motion.
          </p>
        </div>
      </div>

      <Button
        size="lg"
        loading={isPending}
        className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
        onClick={onFinish}
      >
        Meet your team
      </Button>
    </div>
  );
}

// ─── Root wizard component ───────────────────────────────────────────────────

interface SetupWizardProps {
  companyId: string;
  defaultAutonomy: string;
  defaultCulture: string;
}

export function SetupWizard({
  companyId,
  defaultAutonomy,
  defaultCulture,
}: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [autonomy, setAutonomy] = useState(defaultAutonomy);
  const [culture, setCulture] = useState(defaultCulture);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  function finish() {
    startTransition(async () => {
      await saveCompanySettings({
        companyId,
        autonomyLevel: autonomy,
        cultureProfile: culture,
      });
      router.push("/company");
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
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
          <StepDots current={step} />

          {step === 0 && <StepWelcome onNext={next} />}
          {step === 1 && (
            <StepCompanyStyle
              autonomy={autonomy}
              culture={culture}
              onAutonomyChange={setAutonomy}
              onCultureChange={setCulture}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 2 && <StepRepository onNext={next} onBack={back} />}
          {step === 3 && <StepDone isPending={isPending} onFinish={finish} />}
        </div>
      </div>
    </div>
  );
}
