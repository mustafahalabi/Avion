/**
 * Concurrent execution pool for the worker (Goal 5a — parallel execution).
 *
 * The worker used to process one session at a time (a serial `await` in the poll
 * loop). A real engineering company runs a team in parallel — this orchestrator
 * keeps up to `concurrency` sessions in flight at once. Claiming is already an
 * atomic compare-and-swap (`session-claimer.ts`), so concurrent claims are safe;
 * each session still gets its own checkout, sandbox container, and live feed.
 *
 * The loop logic is factored out here (dependency-injected) so it is unit-
 * testable without a database or real agents. `runWorkerPool` fills free slots
 * from `claim()`, waits for a slot when full, idles when there is no work, and
 * drains all in-flight work on shutdown.
 */

/** A claimable unit of work. */
export interface ClaimedSession {
  readonly id: string;
}

/** Injected dependencies for the pool loop. */
export interface WorkerPoolDeps {
  /** Max sessions in flight at once (>= 1). */
  readonly concurrency: number;
  /** Atomically claim the next session, or null when none is available. */
  claim: () => Promise<ClaimedSession | null>;
  /** Process one claimed session end-to-end. Must not throw (own its errors). */
  process: (sessionId: string) => Promise<void>;
  /** True once the loop should stop claiming new work and drain. */
  shouldStop: () => boolean;
  /** Called once per outer cycle before claiming (heartbeat + reap). Best-effort. */
  beforeCycle?: () => Promise<void>;
  /** Called when no work is available and slots are free (idle sleep). */
  onIdle: () => Promise<void>;
}

/**
 * Runs the concurrent claim→process pool until {@link WorkerPoolDeps.shouldStop}.
 *
 * Invariant: at most `concurrency` `process()` calls are ever in flight. On stop
 * it drains — it stops claiming and awaits every in-flight session so shutdown
 * never abandons a running agent mid-run.
 *
 * @param deps - Injected claim/process/lifecycle callbacks.
 */
export async function runWorkerPool(deps: WorkerPoolDeps): Promise<void> {
  const concurrency = Math.max(1, deps.concurrency);
  const active = new Map<string, Promise<void>>();

  const launch = (session: ClaimedSession): void => {
    const p = deps
      .process(session.id)
      .catch(() => {})
      .finally(() => {
        active.delete(session.id);
      });
    active.set(session.id, p);
  };

  while (!deps.shouldStop()) {
    if (deps.beforeCycle) await deps.beforeCycle();

    // Fill every free slot with newly-claimed work.
    let claimedThisCycle = 0;
    while (active.size < concurrency && !deps.shouldStop()) {
      // A transient error while CLAIMING (e.g. a DB blip) must not crash the
      // worker — contain it and fall through to the idle wait so the next cycle
      // retries. Unlike process(), claim() is not required to own its errors.
      let session: ClaimedSession | null;
      try {
        session = await deps.claim();
      } catch {
        break;
      }
      if (!session) break;
      launch(session);
      claimedThisCycle += 1;
    }

    if (deps.shouldStop()) break;

    if (active.size >= concurrency) {
      // Pool is full — wait for at least one slot to free before claiming more.
      await Promise.race(active.values());
    } else if (claimedThisCycle === 0) {
      // Slots free but no work available — idle before polling again.
      await deps.onIdle();
    }
    // else: we claimed some and slots remain — loop immediately to fill them.
  }

  // Drain: never abandon in-flight sessions on shutdown.
  await Promise.allSettled(active.values());
}
