/**
 * Pure task-selection logic for mid-flight chat steering (Goal 5b).
 *
 * Kept dependency-free (no Prisma) so it is unit-testable in isolation and can be
 * imported without pulling the DB layer into the client/test graph. The DB action
 * lives in `mid-flight-steering.ts`, which re-exports these.
 */

/**
 * Task statuses a steer can redirect, best-first. `done`/`cancelled`/`blocked`
 * are intentionally absent — steering never resurrects shipped or dead work
 * (respects the done-resurrection guard, MUS-287).
 */
export const STEERABLE_TASK_STATUSES = [
  "in-progress",
  "in-review",
  "in-qa",
  "todo",
] as const;

const STEER_RANK: Record<string, number> = {
  "in-progress": 0,
  "in-review": 1,
  "in-qa": 2,
  todo: 3,
};

/** A minimal task shape for steer selection. */
export interface SteerableTaskInput {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly updatedAt: Date;
}

/**
 * Picks the single best task to steer: the most "in-flight" one (in-progress >
 * in-review > in-qa > todo), tie-broken by most recently updated. Returns null
 * when no task is steerable (all done/cancelled/blocked, or none exist).
 *
 * @param tasks - Candidate tasks under the outcome.
 * @returns The task to steer, or null.
 */
export function selectSteerableTask(
  tasks: readonly SteerableTaskInput[]
): SteerableTaskInput | null {
  const steerable = tasks.filter((t) =>
    (STEERABLE_TASK_STATUSES as readonly string[]).includes(t.status)
  );
  if (steerable.length === 0) return null;
  return [...steerable].sort((a, b) => {
    const rank = (STEER_RANK[a.status] ?? 9) - (STEER_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
}
