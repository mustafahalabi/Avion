import { describe, expect, it, vi } from "vitest";

import { runWorkerPool, type ClaimedSession } from "./worker-pool";

/** A deferred promise handle for controlling process() completion in tests. */
interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}
function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = () => r();
  });
  return { promise, resolve };
}

describe("runWorkerPool", () => {
  it("processes every claimed session then stops when work + drain are done", async () => {
    const ids = ["a", "b", "c"];
    let i = 0;
    const processed: string[] = [];
    let stop = false;

    await runWorkerPool({
      concurrency: 2,
      claim: async (): Promise<ClaimedSession | null> =>
        i < ids.length ? { id: ids[i++] } : null,
      process: async (id) => {
        processed.push(id);
      },
      shouldStop: () => stop,
      onIdle: async () => {
        // No more work → let the loop stop.
        stop = true;
      },
    });

    expect(processed.sort()).toEqual(["a", "b", "c"]);
  });

  it("never exceeds the concurrency limit", async () => {
    const gates = new Map<string, Deferred>();
    let inFlight = 0;
    let maxInFlight = 0;
    let claimed = 0;
    const total = 6;
    let stop = false;

    const loop = runWorkerPool({
      concurrency: 3,
      claim: async () => (claimed < total ? { id: `s${claimed++}` } : null),
      process: async (id) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const d = deferred();
        gates.set(id, d);
        await d.promise;
        inFlight -= 1;
      },
      shouldStop: () => stop,
      onIdle: async () => {
        stop = true;
      },
    });

    // Let the pool fill up, then release sessions one at a time.
    const releaseAll = async () => {
      for (let n = 0; n < total + 2; n++) {
        await new Promise((r) => setTimeout(r, 5));
        const next = [...gates.entries()].find(([, d]) => d);
        if (next) {
          gates.delete(next[0]);
          next[1].resolve();
        }
      }
    };
    await Promise.all([loop, releaseAll()]);

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // genuinely parallel
  });

  it("drains in-flight sessions on stop (does not abandon them)", async () => {
    let stop = false;
    const finished: string[] = [];
    const d = deferred();
    let claimed = 0;

    const loop = runWorkerPool({
      concurrency: 2,
      claim: async () => (claimed++ === 0 ? { id: "long" } : null),
      process: async (id) => {
        await d.promise;
        finished.push(id);
      },
      shouldStop: () => stop,
      onIdle: async () => {
        // First idle → request stop while "long" is still running.
        stop = true;
      },
    });

    // Give the loop a tick to launch + hit onIdle → stop, then finish the work.
    await new Promise((r) => setTimeout(r, 10));
    d.resolve();
    await loop;

    expect(finished).toEqual(["long"]); // drained, not abandoned
  });

  it("swallows a throwing process() so one bad session can't kill the pool", async () => {
    let claimed = 0;
    let stop = false;
    const processed: string[] = [];

    await runWorkerPool({
      concurrency: 1,
      claim: async () => {
        if (claimed === 0) {
          claimed++;
          return { id: "boom" };
        }
        if (claimed === 1) {
          claimed++;
          return { id: "ok" };
        }
        return null;
      },
      process: async (id) => {
        if (id === "boom") throw new Error("kaboom");
        processed.push(id);
      },
      shouldStop: () => stop,
      onIdle: async () => {
        stop = true;
      },
    });

    expect(processed).toEqual(["ok"]);
  });

  it("contains a throwing claim() instead of crashing the pool", async () => {
    let calls = 0;
    let stop = false;
    let idled = false;

    // First claim throws (transient DB blip); the pool must not propagate it.
    const loop = runWorkerPool({
      concurrency: 2,
      claim: async () => {
        calls += 1;
        if (calls === 1) throw new Error("db blip");
        return null;
      },
      process: async () => {},
      shouldStop: () => stop,
      onIdle: async () => {
        idled = true;
        stop = true;
      },
    });

    // Must resolve (not reject) — a claim error is contained, not fatal.
    await expect(loop).resolves.toBeUndefined();
    expect(idled).toBe(true);
  });

  it("calls beforeCycle each cycle", async () => {
    const beforeCycle = vi.fn(async () => {});
    let stop = false;
    await runWorkerPool({
      concurrency: 1,
      claim: async () => null,
      process: async () => {},
      shouldStop: () => stop,
      beforeCycle,
      onIdle: async () => {
        stop = true;
      },
    });
    expect(beforeCycle).toHaveBeenCalled();
  });
});
