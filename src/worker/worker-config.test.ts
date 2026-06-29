import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * worker-config.ts reads process.env at MODULE LOAD time, so each test that
 * cares about parsing sets env first, then re-imports the module through
 * vi.resetModules() + dynamic import to force a fresh evaluation.
 */

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  // Start every test from a clean clone of the original environment.
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.resetModules();
});

/** Re-imports the config module against the current process.env. */
async function loadConfig() {
  return import("./worker-config");
}

describe("WORKER_CONFIG defaults", () => {
  beforeEach(() => {
    // Remove every key the module reads so defaults are exercised.
    delete process.env.WORKER_POLL_INTERVAL_MS;
    delete process.env.WORKER_REPO_BASE_DIR;
    delete process.env.WORKER_SESSION_TIMEOUT_SECONDS;
    delete process.env.WORKER_PERMISSION_MODE;
    delete process.env.WORKER_MAX_RETRIES;
    delete process.env.DRIVER_TICK_INTERVAL_MS;
  });

  it("uses the documented default values when env is unset", async () => {
    const { WORKER_CONFIG } = await loadConfig();

    expect(WORKER_CONFIG.WORKER_POLL_INTERVAL_MS).toBe(5000);
    expect(WORKER_CONFIG.WORKER_REPO_BASE_DIR).toBe("/tmp/eos-worker");
    expect(WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS).toBe(1800);
    expect(WORKER_CONFIG.WORKER_MAX_RETRIES).toBe(1);
    expect(WORKER_CONFIG.DRIVER_TICK_INTERVAL_MS).toBe(15000);
  });

  it("defaults the permission mode override to null (not the empty string)", async () => {
    const { WORKER_CONFIG } = await loadConfig();

    expect(WORKER_CONFIG.WORKER_PERMISSION_MODE_OVERRIDE).toBeNull();
  });
});

describe("WORKER_CONFIG overrides", () => {
  it("parses numeric env vars into numbers", async () => {
    process.env.WORKER_POLL_INTERVAL_MS = "2500";
    process.env.WORKER_SESSION_TIMEOUT_SECONDS = "60";
    process.env.WORKER_MAX_RETRIES = "3";

    const { WORKER_CONFIG } = await loadConfig();

    expect(WORKER_CONFIG.WORKER_POLL_INTERVAL_MS).toBe(2500);
    expect(typeof WORKER_CONFIG.WORKER_POLL_INTERVAL_MS).toBe("number");
    expect(WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS).toBe(60);
    expect(WORKER_CONFIG.WORKER_MAX_RETRIES).toBe(3);
  });

  it("reads WORKER_REPO_BASE_DIR as a string override", async () => {
    process.env.WORKER_REPO_BASE_DIR = "/var/data/eos";

    const { WORKER_CONFIG } = await loadConfig();

    expect(WORKER_CONFIG.WORKER_REPO_BASE_DIR).toBe("/var/data/eos");
  });

  it("parses DRIVER_TICK_INTERVAL_MS override", async () => {
    process.env.DRIVER_TICK_INTERVAL_MS = "30000";

    const { WORKER_CONFIG } = await loadConfig();

    expect(WORKER_CONFIG.DRIVER_TICK_INTERVAL_MS).toBe(30000);
  });

  it("maps WORKER_PERMISSION_MODE env to the OVERRIDE field when set", async () => {
    process.env.WORKER_PERMISSION_MODE = "acceptEdits";

    const { WORKER_CONFIG } = await loadConfig();

    expect(WORKER_CONFIG.WORKER_PERMISSION_MODE_OVERRIDE).toBe("acceptEdits");
  });

  it("yields NaN for a non-numeric numeric env (Number coercion)", async () => {
    process.env.WORKER_MAX_RETRIES = "not-a-number";

    const { WORKER_CONFIG } = await loadConfig();

    expect(Number.isNaN(WORKER_CONFIG.WORKER_MAX_RETRIES)).toBe(true);
  });
});

describe("validateConfig", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.ENGINEERING_OS_DATABASE_PATH;
  });

  it("throws when neither DATABASE_URL nor ENGINEERING_OS_DATABASE_PATH is set", async () => {
    const { validateConfig } = await loadConfig();

    expect(() => validateConfig()).toThrow(
      /DATABASE_URL or ENGINEERING_OS_DATABASE_PATH must be set/
    );
  });

  it("passes when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgres://localhost/eos";

    const { validateConfig } = await loadConfig();

    expect(() => validateConfig()).not.toThrow();
  });

  it("passes when only ENGINEERING_OS_DATABASE_PATH is set", async () => {
    process.env.ENGINEERING_OS_DATABASE_PATH = "/tmp/eos.db";

    const { validateConfig } = await loadConfig();

    expect(() => validateConfig()).not.toThrow();
  });

  it("returns undefined (void) on success", async () => {
    process.env.DATABASE_URL = "postgres://localhost/eos";

    const { validateConfig } = await loadConfig();

    expect(validateConfig()).toBeUndefined();
  });
});
