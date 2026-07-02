"use client";

import React, { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveCompanySettings } from "@/app/(auth)/onboarding/actions";
import { useRunModeSettings } from "@/hooks/use-run-mode-settings";
import type { RunMode, ExecutionAdapter } from "@/lib/run-mode";

// ─── Company settings ─────────────────────────────────────────────────────────

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

const AGENT_TYPE_OPTIONS = [
  { value: "claude_code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
] as const;

interface Props {
  companyId: string;
  companyName: string;
  autonomyLevel: string;
  cultureProfile: string;
  defaultAgentType: string;
}

export function SettingsForm({ companyId, companyName, autonomyLevel: initialAutonomy, cultureProfile: initialCulture, defaultAgentType: initialAgentType }: Props) {
  const [autonomy, setAutonomy] = useState(initialAutonomy);
  const [culture, setCulture] = useState(initialCulture);
  const [agentType, setAgentType] = useState(initialAgentType);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await saveCompanySettings({ companyId, autonomyLevel: autonomy, cultureProfile: culture, defaultAgentType: agentType });
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

      <div className="px-5 py-4 border-b border-neutral-800">
        <p className="text-xs font-medium text-neutral-400 mb-3">Default coding agent</p>
        <div className="flex gap-2 flex-wrap">
          {AGENT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAgentType(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                agentType === opt.value
                  ? "border-neutral-500 bg-neutral-700 text-neutral-100"
                  : "border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Agent used for new execution sessions unless a session picks one explicitly.
        </p>
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

// ─── Execution settings ───────────────────────────────────────────────────────

const RUN_MODE_OPTIONS: { value: RunMode; label: string; description: string }[] = [
  {
    value: "interactive",
    label: "Interactive",
    description: "Watch tasks execute in real time",
  },
  {
    value: "supervised",
    label: "Supervised",
    description: "Background with review checkpoints",
  },
  {
    value: "background",
    label: "Background",
    description: "Silent execution, no interruptions",
  },
];

const ADAPTER_OPTIONS: { value: ExecutionAdapter; label: string }[] = [
  { value: "claude_code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "human", label: "Human" },
];

/** Inline toggle that mirrors the chip-style button pattern used elsewhere. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 group"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-neutral-500 bg-neutral-600"
            : "border-neutral-700 bg-neutral-800"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-neutral-300 shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      <span
        className={cn(
          "text-xs font-medium transition-colors",
          checked ? "text-neutral-200" : "text-neutral-500 group-hover:text-neutral-400"
        )}
      >
        {label}
      </span>
    </button>
  );
}

interface ExecutionSettingsFormProps {
  /** Company autonomy level — used to seed sensible defaults on first visit. */
  autonomyLevel?: string;
}

/**
 * Execution Settings panel.
 *
 * Settings are auto-persisted to localStorage on every change — no explicit
 * save round-trip required. `autonomyLevel` seeds the defaults for first-time
 * users so the initial config matches the company's autonomy setting.
 *
 * Renders a loading skeleton until client-side hydration to avoid mismatches.
 */
export function ExecutionSettingsForm({ autonomyLevel }: ExecutionSettingsFormProps) {
  const { config, updateConfig, loaded } = useRunModeSettings(autonomyLevel);
  const [flashSaved, setFlashSaved] = useState(false);
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending flash timer on unmount
  React.useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  function triggerFlash() {
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    setFlashSaved(true);
    flashTimerRef.current = setTimeout(() => {
      setFlashSaved(false);
      flashTimerRef.current = null;
    }, 2000);
  }

  function handleUpdate(updates: Partial<typeof config>) {
    updateConfig(updates);
    triggerFlash();
  }

  if (!loaded) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
        <p className="text-xs text-neutral-600">Loading execution settings…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Run mode */}
      <div className="px-5 py-4 border-b border-neutral-800">
        <p className="text-xs font-medium text-neutral-400 mb-3">Run mode</p>
        <div className="flex flex-col gap-2">
          {RUN_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleUpdate({ mode: opt.value })}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                config.mode === opt.value
                  ? "border-neutral-500 bg-neutral-700"
                  : "border-neutral-700 hover:border-neutral-600"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                  config.mode === opt.value
                    ? "border-neutral-300 bg-neutral-300"
                    : "border-neutral-600 bg-transparent"
                )}
              />
              <span className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    "text-xs font-medium transition-colors",
                    config.mode === opt.value ? "text-neutral-100" : "text-neutral-400"
                  )}
                >
                  {opt.label}
                </span>
                <span className="text-xs text-neutral-500">{opt.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Execution adapter */}
      <div className="px-5 py-4 border-b border-neutral-800">
        <p className="text-xs font-medium text-neutral-400 mb-3">Execution adapter</p>
        <div className="flex gap-2 flex-wrap">
          {ADAPTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleUpdate({ adapter: opt.value })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                config.adapter === opt.value
                  ? "border-neutral-500 bg-neutral-700 text-neutral-100"
                  : "border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Concurrency */}
      <div className="px-5 py-4 border-b border-neutral-800">
        <label className="text-xs font-medium text-neutral-400 mb-3 block">
          Max concurrent sessions
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={5}
            value={config.maxConcurrentSessions}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) handleUpdate({ maxConcurrentSessions: Math.max(1, Math.min(5, val)) });
            }}
            className="w-16 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
          />
          <span className="text-xs text-neutral-500">sessions (1–5)</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="px-5 py-4 border-b border-neutral-800 flex flex-col gap-4">
        <Toggle
          checked={config.autoStartOnApproval}
          onChange={(val) => handleUpdate({ autoStartOnApproval: val })}
          label="Auto-start on approval"
        />
        <Toggle
          checked={config.requireConfirmationBeforeRun}
          onChange={(val) => handleUpdate({ requireConfirmationBeforeRun: val })}
          label="Require confirmation before run"
        />
      </div>

      {/* Session timeout */}
      <div className="px-5 py-4 border-b border-neutral-800">
        <label className="text-xs font-medium text-neutral-400 mb-3 block">
          Session timeout
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={5}
            max={480}
            step={5}
            value={config.sessionTimeoutMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) handleUpdate({ sessionTimeoutMinutes: Math.max(5, Math.min(480, val)) });
            }}
            className="w-20 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
          />
          <span className="text-xs text-neutral-500">minutes (5–480)</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-3 h-10">
        {flashSaved ? (
          <p className="text-xs text-green-400">Saved</p>
        ) : (
          <p className="text-xs text-neutral-600">Changes save automatically</p>
        )}
      </div>
    </div>
  );
}
