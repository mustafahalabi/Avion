/**
 * Ops "what's running + what it's costing" view (Goal 3). Server-only.
 *
 * Assembles two things a CEO wants when the loop runs unattended: every agent
 * running RIGHT NOW (with its real adapter + elapsed), and REAL spend per active
 * outcome against its ceiling. All numbers come from the usage ledger — never
 * estimated.
 */

import { prisma } from "@/lib/prisma";
import { summarizeOutcomeUsageMany } from "@/lib/agent-usage-service";
import { resolveSpendCeilingUsd } from "@/lib/spend-ceiling";

/** One agent session executing right now. */
export interface RunningAgent {
  readonly sessionId: string;
  readonly taskTitle: string;
  readonly outcomeId: string | null;
  readonly outcomeTitle: string | null;
  readonly agentType: string;
  readonly startedAt: Date | null;
}

/** Real spend for one active outcome. */
export interface OutcomeSpendRow {
  readonly outcomeId: string;
  readonly outcomeTitle: string;
  readonly status: string;
  readonly costUsd: number;
  readonly planningCostUsd: number;
  readonly executionCostUsd: number;
  readonly ceilingUsd: number | null;
  readonly exceeded: boolean;
}

/** The full ops view payload. */
export interface OpsSpendView {
  readonly runningAgents: readonly RunningAgent[];
  readonly outcomes: readonly OutcomeSpendRow[];
  /** Total real spend across the whole company (all time). */
  readonly totalCostUsd: number;
  readonly ceilingUsd: number | null;
}

/** Outcome statuses considered "active" for the spend table. */
const ACTIVE_OUTCOME_STATUSES = [
  "planning",
  "planned",
  "in_delivery",
  "blocked",
] as const;

/**
 * Loads the ops spend + activity view for a company.
 *
 * @param companyId - The company to load.
 * @returns Running agents, per-outcome spend, and the company total.
 */
export async function loadOpsSpendView(companyId: string): Promise<OpsSpendView> {
  const [runningSessions, outcomes, settings, totalAgg] = await Promise.all([
    prisma.executionSession.findMany({
      where: { companyId, status: "running" },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        agentType: true,
        startedAt: true,
        task: {
          select: {
            title: true,
            outcome: { select: { id: true, title: true } },
            planningDraft: { select: { outcome: { select: { id: true, title: true } } } },
          },
        },
      },
    }),
    prisma.outcome.findMany({
      where: { companyId, status: { in: [...ACTIVE_OUTCOME_STATUSES] } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, status: true },
    }),
    prisma.companySettings.findUnique({
      where: { companyId },
      select: { spendCeilingUsd: true },
    }),
    prisma.usageRecord.aggregate({
      where: { companyId },
      _sum: { costUsd: true },
    }),
  ]);

  const ceilingUsd = resolveSpendCeilingUsd(settings?.spendCeilingUsd ?? null);
  const usageMap = await summarizeOutcomeUsageMany(
    companyId,
    outcomes.map((o) => o.id)
  );

  const runningAgents: RunningAgent[] = runningSessions.map((s) => {
    const outcome = s.task?.outcome ?? s.task?.planningDraft?.outcome ?? null;
    return {
      sessionId: s.id,
      taskTitle: s.task?.title ?? "Ad-hoc task",
      outcomeId: outcome?.id ?? null,
      outcomeTitle: outcome?.title ?? null,
      agentType: s.agentType,
      startedAt: s.startedAt,
    };
  });

  const outcomeRows: OutcomeSpendRow[] = outcomes
    .map((o) => {
      const u = usageMap.get(o.id);
      const costUsd = u?.costUsd ?? 0;
      return {
        outcomeId: o.id,
        outcomeTitle: o.title,
        status: o.status,
        costUsd,
        planningCostUsd: u?.planningCostUsd ?? 0,
        executionCostUsd: u?.executionCostUsd ?? 0,
        ceilingUsd,
        exceeded: ceilingUsd != null && costUsd >= ceilingUsd,
      };
    })
    // Most expensive first — the runaway candidates surface at the top.
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    runningAgents,
    outcomes: outcomeRows,
    totalCostUsd: totalAgg._sum.costUsd ?? 0,
    ceilingUsd,
  };
}
