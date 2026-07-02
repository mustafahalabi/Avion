"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RepositoryTab {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly content: ReactNode;
}

/**
 * Client tab shell for the repository detail page. The tab panels are
 * server-rendered nodes passed in as `content` (RSC "client shell, server
 * children" pattern), so server actions inside them keep working — this
 * component only owns which panel is visible.
 */
export function RepositoryTabs({ tabs }: { tabs: readonly RepositoryTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  if (!activeTab) return null;

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-neutral-800"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={cn(
                "relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                selected
                  ? "border-white text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{activeTab.content}</div>
    </div>
  );
}
