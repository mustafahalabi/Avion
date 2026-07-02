"use client";

import { cn } from "@/lib/utils";

interface OptionCardProps {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
  selected: boolean;
  onSelect: (value: string) => void;
}

/**
 * A small selectable card used for autonomy / culture choices during onboarding.
 * Mirrors the option styling used by the setup wizard.
 */
export function OptionCard({
  value,
  label,
  description,
  recommended,
  selected,
  onSelect,
}: OptionCardProps) {
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
