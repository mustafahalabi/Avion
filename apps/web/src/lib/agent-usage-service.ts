/**
 * Usage ledger service (Goal 3) — records REAL agent token/cost usage and
 * aggregates it per outcome / company. Server-only (imports Prisma).
 *
 * The worker writes an execution sample after each session; the planner writes a
 * planning sample after each AI completion. Per-outcome spend is then a SUM over
 * real samples — never estimated. Writes are best-effort: a ledger failure must
 * never break execution or planning.
 */

import { prisma } from "@/lib/prisma";
import type { AgentUsage } from "@/lib/adapters/agent-usage";

/** Which phase of the loop a usage sample came from. */
export type UsagePhase = "planning" | "execution";

/** Input for {@link recordAgentUsage}. */
export interface RecordAgentUsageInput {
  readonly companyId: string;
  readonly outcomeId?: string | null;
  readonly taskId?: string | null;
  readonly sessionId?: string | null;
  readonly phase: UsagePhase;
  /** "claude_code" | "claude-cli" | "codex". */
  readonly provider: string;
  readonly usage: AgentUsage;
}

/**
 * Records one real usage sample. Best-effort — swallows any error so a ledger
 * write can never fail the run that produced it.
 *
 * @param input - Company/links, phase, provider, and the real usage.
 */
export async function recordAgentUsage(input: RecordAgentUsageInput): Promise<void> {
  try {
    await prisma.usageRecord.create({
      data: {
        companyId: input.companyId,
        outcomeId: input.outcomeId ?? null,
        taskId: input.taskId ?? null,
        sessionId: input.sessionId ?? null,
        phase: input.phase,
        provider: input.provider,
        model: input.usage.model,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cachedInputTokens: input.usage.cachedInputTokens,
        costUsd: input.usage.costUsd,
      },
    });
  } catch {
    // Best-effort: observability must never break the loop.
  }
}

/** Aggregated spend for one outcome. */
export interface OutcomeUsageSummary {
  readonly outcomeId: string;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly planningCostUsd: number;
  readonly executionCostUsd: number;
  readonly sampleCount: number;
}

const EMPTY_SUMMARY = (outcomeId: string): OutcomeUsageSummary => ({
  outcomeId,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  planningCostUsd: 0,
  executionCostUsd: 0,
  sampleCount: 0,
});

/**
 * Sums the real spend on a single outcome from the usage ledger.
 *
 * @param companyId - Owning company (scoping guard).
 * @param outcomeId - The outcome to total.
 * @returns The aggregated summary (zeros when there are no samples).
 */
export async function summarizeOutcomeUsage(
  companyId: string,
  outcomeId: string
): Promise<OutcomeUsageSummary> {
  const rows = await prisma.usageRecord.findMany({
    where: { companyId, outcomeId },
    select: {
      phase: true,
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cachedInputTokens: true,
    },
  });
  return rows.reduce<OutcomeUsageSummary>((acc, r) => {
    return {
      outcomeId,
      costUsd: acc.costUsd + r.costUsd,
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      cachedInputTokens: acc.cachedInputTokens + r.cachedInputTokens,
      planningCostUsd: acc.planningCostUsd + (r.phase === "planning" ? r.costUsd : 0),
      executionCostUsd: acc.executionCostUsd + (r.phase === "execution" ? r.costUsd : 0),
      sampleCount: acc.sampleCount + 1,
    };
  }, EMPTY_SUMMARY(outcomeId));
}

/**
 * Sums real spend for many outcomes at once (one query), for the chat surface.
 *
 * @param companyId - Owning company.
 * @param outcomeIds - Outcomes to total.
 * @returns A map of outcomeId → summary (missing outcomes map to zeros).
 */
export async function summarizeOutcomeUsageMany(
  companyId: string,
  outcomeIds: readonly string[]
): Promise<Map<string, OutcomeUsageSummary>> {
  const map = new Map<string, OutcomeUsageSummary>();
  for (const id of outcomeIds) map.set(id, EMPTY_SUMMARY(id));
  if (outcomeIds.length === 0) return map;

  const rows = await prisma.usageRecord.findMany({
    where: { companyId, outcomeId: { in: [...outcomeIds] } },
    select: {
      outcomeId: true,
      phase: true,
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cachedInputTokens: true,
    },
  });
  for (const r of rows) {
    if (!r.outcomeId) continue;
    const prev = map.get(r.outcomeId) ?? EMPTY_SUMMARY(r.outcomeId);
    map.set(r.outcomeId, {
      outcomeId: r.outcomeId,
      costUsd: prev.costUsd + r.costUsd,
      inputTokens: prev.inputTokens + r.inputTokens,
      outputTokens: prev.outputTokens + r.outputTokens,
      cachedInputTokens: prev.cachedInputTokens + r.cachedInputTokens,
      planningCostUsd: prev.planningCostUsd + (r.phase === "planning" ? r.costUsd : 0),
      executionCostUsd: prev.executionCostUsd + (r.phase === "execution" ? r.costUsd : 0),
      sampleCount: prev.sampleCount + 1,
    });
  }
  return map;
}

/**
 * Resolves the outcome id a task belongs to — directly (`task.outcomeId`) or via
 * its originating planning draft. Used to attribute execution spend and to check
 * the spend ceiling.
 *
 * @param taskId - The task.
 * @returns The outcome id, or null when the task has no outcome.
 */
export async function resolveOutcomeIdForTask(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      outcome: { select: { id: true } },
      planningDraft: { select: { outcome: { select: { id: true } } } },
    },
  });
  return task?.outcome?.id ?? task?.planningDraft?.outcome?.id ?? null;
}
