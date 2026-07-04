import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Activity, Coins, Zap } from "lucide-react";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { loadOpsSpendView } from "@/lib/ops-spend-view";
import { cn } from "@/lib/utils";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { AdapterBadge } from "@/components/ui/badge";
import { AutoRefresh } from "./auto-refresh";

// Cost + activity observability (Goal 3): the CEO's "what's running right now
// and what is it costing me" ops view. Numbers are REAL usage from the ledger.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spend & Activity" };

function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export default async function SpendPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const view = await loadOpsSpendView(company.id);

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <AutoRefresh intervalMs={5000} />

      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900">
          <Coins className="h-4.5 w-4.5 text-neutral-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Spend &amp; Activity</h1>
          <p className="text-xs text-neutral-500">
            Real agent spend and what&apos;s running right now.
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="font-mono text-lg font-semibold text-neutral-100">
            {formatUsd(view.totalCostUsd)}
          </p>
          <p className="text-[11px] text-neutral-600">total spend</p>
        </div>
      </header>

      {/* Running now */}
      <section className="mb-8">
        <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          <Activity className="h-3.5 w-3.5" /> Running now · {view.runningAgents.length}
        </h2>
        {view.runningAgents.length === 0 ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-center text-xs text-neutral-600">
            No agents are running right now.
          </p>
        ) : (
          <div className="divide-y divide-neutral-800/70 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60">
            {view.runningAgents.map((a) => (
              <div key={a.sessionId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-200">{a.taskTitle}</p>
                  {a.outcomeTitle && (
                    <p className="truncate text-[11px] text-neutral-600">{a.outcomeTitle}</p>
                  )}
                </div>
                <AdapterBadge agentType={a.agentType} />
                {a.startedAt && (
                  <ElapsedTime
                    startedAt={a.startedAt}
                    className="text-[11px] font-semibold text-brand-400"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Spend by outcome */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          <Zap className="h-3.5 w-3.5" /> Spend by outcome
        </h2>
        {view.outcomes.length === 0 ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-center text-xs text-neutral-600">
            No active outcomes.
          </p>
        ) : (
          <div className="divide-y divide-neutral-800/70 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60">
            {view.outcomes.map((o) => {
              const ratio =
                o.ceilingUsd != null && o.ceilingUsd > 0 ? o.costUsd / o.ceilingUsd : 0;
              return (
                <Link
                  key={o.outcomeId}
                  href={`/work/outcomes/${o.outcomeId}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-900/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-200">{o.outcomeTitle}</p>
                    <p className="truncate font-mono text-[10px] text-neutral-600">
                      {o.status} · plan {formatUsd(o.planningCostUsd)} · exec{" "}
                      {formatUsd(o.executionCostUsd)}
                    </p>
                  </div>
                  {o.ceilingUsd != null && (
                    <div className="hidden w-24 shrink-0 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            o.exceeded
                              ? "bg-danger-500"
                              : ratio >= 0.8
                                ? "bg-warning-500"
                                : "bg-brand-500"
                          )}
                          style={{ width: `${Math.min(100, ratio * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="w-24 shrink-0 text-right">
                    <span
                      className={cn(
                        "font-mono text-xs font-semibold",
                        o.exceeded ? "text-danger-400" : "text-neutral-200"
                      )}
                    >
                      {formatUsd(o.costUsd)}
                    </span>
                    {o.ceilingUsd != null && (
                      <span className="text-[10px] text-neutral-600">
                        {" "}
                        / {formatUsd(o.ceilingUsd)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
