import { afterEach, describe, expect, it } from "vitest";

import {
  acquireSingleInstanceLock,
  lockKeyFor,
  singleInstanceEnabled,
  type InstanceLock,
} from "./single-instance-lock";

// Advisory locks are database-global, so each test uses a UNIQUE role to avoid
// colliding with a real worker/driver (or another parallel suite).
function uniqueRole(): string {
  return `test-lock-${process.pid}-${Date.now()}-${counter++}`;
}
let counter = 0;

const held: InstanceLock[] = [];
function track(lock: InstanceLock): InstanceLock {
  held.push(lock);
  return lock;
}

afterEach(async () => {
  while (held.length) {
    await held.pop()!.release();
  }
});

describe("lockKeyFor", () => {
  it("is deterministic and distinct per role, in the positive int31 range", () => {
    expect(lockKeyFor("worker")).toBe(lockKeyFor("worker"));
    expect(lockKeyFor("worker")).not.toBe(lockKeyFor("driver"));
    for (const role of ["worker", "driver", "x"]) {
      const key = lockKeyFor(role);
      expect(key).toBeGreaterThanOrEqual(0);
      expect(key).toBeLessThan(0x7fffffff);
      expect(Number.isInteger(key)).toBe(true);
    }
  });
});

describe("singleInstanceEnabled", () => {
  it("defaults on, and is disabled only by explicit falsy values", () => {
    expect(singleInstanceEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(singleInstanceEnabled({ WORKER_SINGLE_INSTANCE: "1" } as never)).toBe(true);
    for (const v of ["0", "false", "no", "off", "OFF"]) {
      expect(singleInstanceEnabled({ WORKER_SINGLE_INSTANCE: v } as never)).toBe(false);
    }
  });
});

describe("acquireSingleInstanceLock", () => {
  it("acquires when enabled=false without touching the DB", async () => {
    const lock = await acquireSingleInstanceLock("anything", { enabled: false });
    expect(lock.acquired).toBe(true);
    await lock.release();
  });

  it("refuses a second holder of the same role, and re-acquires after release", async () => {
    const role = uniqueRole();
    const first = track(await acquireSingleInstanceLock(role));
    expect(first.acquired).toBe(true);

    const second = track(await acquireSingleInstanceLock(role));
    expect(second.acquired).toBe(false);

    // Releasing the first frees the lock for a new acquirer.
    await first.release();
    const third = track(await acquireSingleInstanceLock(role));
    expect(third.acquired).toBe(true);
  });

  it("lets two DIFFERENT roles hold their locks simultaneously", async () => {
    const a = track(await acquireSingleInstanceLock(uniqueRole()));
    const b = track(await acquireSingleInstanceLock(uniqueRole()));
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(true);
  });

  it("release is idempotent and never throws", async () => {
    const lock = track(await acquireSingleInstanceLock(uniqueRole()));
    await lock.release();
    await expect(lock.release()).resolves.toBeUndefined();
  });
});
