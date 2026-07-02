import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createHeartbeat,
  resolveHeartbeatFilePath,
  writeHeartbeat,
} from "./heartbeat";
import { WORKER_CONFIG } from "./worker-config";
import { workerLogger } from "./worker-logger";

let tmpDir: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "avion-heartbeat-"));
  warnSpy = vi.spyOn(workerLogger, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Builds a path guaranteed to be unwritable: its parent "directory" is a
 * regular file, so mkdir/write must fail on every platform.
 */
function unwritablePath(): string {
  const blocker = path.join(tmpDir, "blocker");
  writeFileSync(blocker, "not a directory", "utf8");
  return path.join(blocker, "nested", "beat.heartbeat");
}

describe("resolveHeartbeatFilePath", () => {
  it("defaults to <WORKER_REPO_BASE_DIR>/<processName>.heartbeat", () => {
    expect(resolveHeartbeatFilePath("worker")).toBe(
      path.join(WORKER_CONFIG.WORKER_REPO_BASE_DIR, "worker.heartbeat")
    );
  });

  it("uses the env override when provided", () => {
    const override = path.join(tmpDir, "custom.heartbeat");

    expect(resolveHeartbeatFilePath("driver", override)).toBe(override);
  });

  it("ignores blank and whitespace-only env overrides", () => {
    expect(resolveHeartbeatFilePath("driver", "")).toBe(
      path.join(WORKER_CONFIG.WORKER_REPO_BASE_DIR, "driver.heartbeat")
    );
    expect(resolveHeartbeatFilePath("driver", "   ")).toBe(
      path.join(WORKER_CONFIG.WORKER_REPO_BASE_DIR, "driver.heartbeat")
    );
  });

  it("ignores a null env override", () => {
    expect(resolveHeartbeatFilePath("worker", null)).toBe(
      path.join(WORKER_CONFIG.WORKER_REPO_BASE_DIR, "worker.heartbeat")
    );
  });
});

describe("writeHeartbeat", () => {
  it("writes the provided timestamp as an ISO string with a trailing newline", () => {
    const file = path.join(tmpDir, "beat.heartbeat");
    const now = new Date("2026-07-02T10:20:30.000Z");

    expect(writeHeartbeat(file, now)).toBe(true);
    expect(readFileSync(file, "utf8")).toBe("2026-07-02T10:20:30.000Z\n");
  });

  it("creates missing parent directories", () => {
    const file = path.join(tmpDir, "deeply", "nested", "beat.heartbeat");

    expect(writeHeartbeat(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\n$/
    );
  });

  it("overwrites the previous timestamp on subsequent writes", () => {
    const file = path.join(tmpDir, "beat.heartbeat");

    writeHeartbeat(file, new Date("2026-07-02T00:00:00.000Z"));
    writeHeartbeat(file, new Date("2026-07-02T00:00:05.000Z"));

    expect(readFileSync(file, "utf8")).toBe("2026-07-02T00:00:05.000Z\n");
  });

  it("returns false instead of throwing when the path is unwritable", () => {
    expect(() => writeHeartbeat(unwritablePath())).not.toThrow();
    expect(writeHeartbeat(unwritablePath())).toBe(false);
  });
});

describe("createHeartbeat", () => {
  it("exposes the resolved file path", () => {
    const override = path.join(tmpDir, "worker.heartbeat");

    expect(createHeartbeat("worker", override).filePath).toBe(override);
  });

  it("writes the heartbeat file on beat()", () => {
    const file = path.join(tmpDir, "worker.heartbeat");
    const heartbeat = createHeartbeat("worker", file);

    expect(heartbeat.beat()).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\n$/
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("advances the recorded timestamp across beats", () => {
    const file = path.join(tmpDir, "worker.heartbeat");
    const heartbeat = createHeartbeat("worker", file);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-02T00:00:00.000Z"));
      heartbeat.beat();
      const first = readFileSync(file, "utf8");

      vi.setSystemTime(new Date("2026-07-02T00:01:00.000Z"));
      heartbeat.beat();
      const second = readFileSync(file, "utf8");

      expect(first).toBe("2026-07-02T00:00:00.000Z\n");
      expect(second).toBe("2026-07-02T00:01:00.000Z\n");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never throws when the write fails", () => {
    const heartbeat = createHeartbeat("worker", unwritablePath());

    expect(() => heartbeat.beat()).not.toThrow();
    expect(heartbeat.beat()).toBe(false);
  });

  it("warns exactly once across repeated write failures", () => {
    const heartbeat = createHeartbeat("driver", unwritablePath());

    heartbeat.beat();
    heartbeat.beat();
    heartbeat.beat();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("driver");
  });

  it("keeps working after a failure once the path is unchanged (still false, no crash)", () => {
    const heartbeat = createHeartbeat("worker", unwritablePath());

    expect(heartbeat.beat()).toBe(false);
    expect(heartbeat.beat()).toBe(false);
  });
});
