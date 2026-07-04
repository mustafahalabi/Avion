/**
 * Per-outcome spend ceiling enforcement (Goal 3) — the control that halts a
 * runaway outcome before it spends more.
 *
 * The worker calls {@link enforceOutcomeSpendCeiling} BEFORE running an agent for
 * a task. When the task's outcome has already spent at/over its ceiling, the
 * task is blocked, the outcome is escalated to `blocked` (non-terminal — the CEO
 * can raise the ceiling and resume), and a deduplicated blocker notification is
 * raised. The agent then never runs, so the spend cannot grow past the ceiling.
 *
 * SCOPE (intentional coarseness): this is a pre-run gate on *recorded* spend, not
 * a hard real-time cap. A session's own cost is recorded only after it finishes,
 * so (a) a single in-flight session is not interrupted mid-run, and (b) with a
 * worker pool (WORKER_CONCURRENCY>1) two sessions of the same outcome can both
 * pass the check before either records its cost — so spend can overshoot by up to
 * one batch of in-flight sessions before the next check halts the outcome. That
 * bounded overshoot is acceptable for a budget guard; a hard per-session cap +
 * atomic reservation is future work. Also: providers that don't report usage
 * (currently the Codex adapter) record no execution cost, so the ceiling does not
 * bound their spend — track that with per-provider usage capture when Codex ships.
 */

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import {
  resolveOutcomeIdForTask,
  summarizeOutcomeUsage,
} from "@/lib/agent-usage-service";
import {
  evaluateSpendCeiling,
  resolveSpendCeilingUsd,
} from "@/lib/spend-ceiling";

/** Outcome of a spend-ceiling check for one session. */
export interface SpendCeilingGuardResult {
  /** True when the session must NOT run — the ceiling was reached. */
  readonly halted: boolean;
  /** Human-readable reason when halted, else null. */
  readonly reason: string | null;
  /** Real spend on the outcome so far. */
  readonly spentUsd: number;
  /** Effective ceiling, or null when none applies. */
  readonly ceilingUsd: number | null;
}

const NOT_HALTED = (
  spentUsd: number,
  ceilingUsd: number | null
): SpendCeilingGuardResult => ({ halted: false, reason: null, spentUsd, ceilingUsd });

/**
 * Checks (and, when breached, enforces) the spend ceiling for a task's outcome.
 *
 * @param input - Company, the task, the session being run, and the company's
 *   `spendCeilingUsd` setting (env default applies when null).
 * @returns Whether the session was halted, plus the spend/ceiling figures.
 */
export async function enforceOutcomeSpendCeiling(input: {
  companyId: string;
  taskId: string | null;
  sessionId: string;
  companyCeilingSetting: number | null | undefined;
}): Promise<SpendCeilingGuardResult> {
  const ceilingUsd = resolveSpendCeilingUsd(input.companyCeilingSetting);
  // No ceiling, or a planless/ad-hoc session with no outcome to attribute to.
  if (ceilingUsd == null || !input.taskId) return NOT_HALTED(0, ceilingUsd);

  const outcomeId = await resolveOutcomeIdForTask(input.taskId);
  if (!outcomeId) return NOT_HALTED(0, ceilingUsd);

  const summary = await summarizeOutcomeUsage(input.companyId, outcomeId);
  const decision = evaluateSpendCeiling(summary.costUsd, ceilingUsd);
  if (!decision.exceeded) return NOT_HALTED(decision.spentUsd, ceilingUsd);

  const reason =
    `Outcome spend ceiling reached: $${decision.spentUsd.toFixed(2)} of ` +
    `$${ceilingUsd.toFixed(2)} spent. Execution halted before spending more.`;
  await haltOutcomeForSpend({
    companyId: input.companyId,
    outcomeId,
    taskId: input.taskId,
    reason,
  });
  return { halted: true, reason, spentUsd: decision.spentUsd, ceilingUsd };
}

/**
 * Blocks the task + escalates the outcome + raises a deduplicated CEO blocker.
 * Best-effort per side effect so partial failure still halts the run.
 */
async function haltOutcomeForSpend(input: {
  companyId: string;
  outcomeId: string;
  taskId: string;
  reason: string;
}): Promise<void> {
  const { companyId, outcomeId, taskId, reason } = input;

  // Block the task so the driver won't re-select it, and escalate the outcome to
  // `blocked` (non-terminal) so the CEO sees the halt.
  await prisma.task
    .updateMany({
      where: { id: taskId, companyId },
      data: { status: "blocked", updatedAt: new Date() },
    })
    .catch(() => {});
  await prisma.outcome
    .updateMany({
      where: { id: outcomeId, companyId, status: { notIn: ["completed", "cancelled"] } },
      data: { status: "blocked", failureReason: reason },
    })
    .catch(() => {});
  await prisma.timelineEntry
    .create({
      data: {
        entityType: "outcome",
        entityId: outcomeId,
        eventType: "outcome_blocked",
        summary: reason,
        metadata: JSON.stringify({ companyId, reason: "spend_ceiling" }),
      },
    })
    .catch(() => {});

  // Deduplicated blocker: only alert while no unread spend blocker exists for
  // this outcome, so a driver that keeps hitting the ceiling doesn't spam.
  try {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { ownerId: true },
    });
    if (!company) return;
    const existing = await prisma.notification.findFirst({
      where: {
        companyId,
        userId: company.ownerId,
        type: "blocker",
        entityType: "outcome",
        entityId: outcomeId,
        read: false,
      },
      select: { id: true },
    });
    if (existing) return;
    await notify({
      userId: company.ownerId,
      companyId,
      title: "Outcome halted: spend ceiling reached",
      body: reason.slice(0, 500),
      type: "blocker",
      priority: "urgent",
      entityType: "outcome",
      entityId: outcomeId,
      actionUrl: `/work/outcomes/${outcomeId}`,
    });
  } catch {
    // Notifications are best-effort.
  }
}
