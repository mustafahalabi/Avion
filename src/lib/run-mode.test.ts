import { describe, expect, it } from "vitest";
import {
  getRunModeConfig,
  describeRunMode,
  isAutoRunEnabled,
  DEFAULT_RUN_MODE_CONFIG,
  type RunModeConfig,
} from "./run-mode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<RunModeConfig> = {}): RunModeConfig {
  return { ...DEFAULT_RUN_MODE_CONFIG, ...overrides };
}

// ─── getRunModeConfig ─────────────────────────────────────────────────────────

describe("getRunModeConfig", () => {
  describe("manual", () => {
    it("returns interactive mode", () => {
      expect(getRunModeConfig("manual").mode).toBe("interactive");
    });

    it("uses human adapter", () => {
      expect(getRunModeConfig("manual").adapter).toBe("human");
    });

    it("requires confirmation before run", () => {
      expect(getRunModeConfig("manual").requireConfirmationBeforeRun).toBe(true);
    });

    it("does not auto-start on approval", () => {
      expect(getRunModeConfig("manual").autoStartOnApproval).toBe(false);
    });

    it("allows only 1 concurrent session", () => {
      expect(getRunModeConfig("manual").maxConcurrentSessions).toBe(1);
    });
  });

  describe("assist", () => {
    it("returns interactive mode", () => {
      expect(getRunModeConfig("assist").mode).toBe("interactive");
    });

    it("uses claude_code adapter", () => {
      expect(getRunModeConfig("assist").adapter).toBe("claude_code");
    });

    it("requires confirmation before run", () => {
      expect(getRunModeConfig("assist").requireConfirmationBeforeRun).toBe(true);
    });

    it("does not auto-start on approval", () => {
      expect(getRunModeConfig("assist").autoStartOnApproval).toBe(false);
    });
  });

  describe("delegate", () => {
    it("returns supervised mode", () => {
      expect(getRunModeConfig("delegate").mode).toBe("supervised");
    });

    it("auto-starts on approval", () => {
      expect(getRunModeConfig("delegate").autoStartOnApproval).toBe(true);
    });

    it("does not require confirmation before run", () => {
      expect(getRunModeConfig("delegate").requireConfirmationBeforeRun).toBe(false);
    });

    it("allows at least 2 concurrent sessions", () => {
      expect(getRunModeConfig("delegate").maxConcurrentSessions).toBeGreaterThanOrEqual(2);
    });
  });

  describe("autonomous", () => {
    it("returns background mode", () => {
      expect(getRunModeConfig("autonomous").mode).toBe("background");
    });

    it("auto-starts on approval", () => {
      expect(getRunModeConfig("autonomous").autoStartOnApproval).toBe(true);
    });

    it("does not require confirmation before run", () => {
      expect(getRunModeConfig("autonomous").requireConfirmationBeforeRun).toBe(false);
    });

    it("allows at least 2 concurrent sessions", () => {
      expect(getRunModeConfig("autonomous").maxConcurrentSessions).toBeGreaterThanOrEqual(2);
    });
  });

  describe("unknown autonomy level", () => {
    it("returns the default config", () => {
      expect(getRunModeConfig("unknown")).toEqual(DEFAULT_RUN_MODE_CONFIG);
    });

    it("returns the default config for empty string", () => {
      expect(getRunModeConfig("")).toEqual(DEFAULT_RUN_MODE_CONFIG);
    });
  });
});

// ─── describeRunMode ──────────────────────────────────────────────────────────

describe("describeRunMode", () => {
  it("includes 'Claude Code' for claude_code adapter", () => {
    expect(describeRunMode(makeConfig({ adapter: "claude_code" }))).toContain("Claude Code");
  });

  it("includes 'Codex' for codex adapter", () => {
    expect(describeRunMode(makeConfig({ adapter: "codex" }))).toContain("Codex");
  });

  it("includes 'Human' for human adapter", () => {
    expect(describeRunMode(makeConfig({ adapter: "human" }))).toContain("Human");
  });

  it("mentions 'foreground' for interactive mode", () => {
    expect(describeRunMode(makeConfig({ mode: "interactive" }))).toContain("foreground");
  });

  it("mentions 'background' for background mode", () => {
    expect(describeRunMode(makeConfig({ mode: "background" }))).toContain("background");
  });

  it("mentions 'checkpoints' for supervised mode", () => {
    expect(describeRunMode(makeConfig({ mode: "supervised" }))).toContain("checkpoints");
  });

  it("includes concurrent session count", () => {
    expect(describeRunMode(makeConfig({ maxConcurrentSessions: 3 }))).toContain("3");
  });

  it("uses singular 'session' when count is 1", () => {
    const desc = describeRunMode(makeConfig({ maxConcurrentSessions: 1 }));
    expect(desc).toContain("1 concurrent session");
    expect(desc).not.toContain("sessions");
  });

  it("uses plural 'sessions' when count is more than 1", () => {
    expect(describeRunMode(makeConfig({ maxConcurrentSessions: 2 }))).toContain("sessions");
  });

  it("includes timeout in minutes", () => {
    expect(describeRunMode(makeConfig({ sessionTimeoutMinutes: 45 }))).toContain("45min");
  });

  it("mentions auto-start when enabled", () => {
    expect(describeRunMode(makeConfig({ autoStartOnApproval: true }))).toContain("auto-starts on approval");
  });

  it("does not mention auto-start when disabled", () => {
    expect(describeRunMode(makeConfig({ autoStartOnApproval: false }))).not.toContain("auto-starts");
  });

  it("mentions confirmation requirement when enabled", () => {
    expect(describeRunMode(makeConfig({ requireConfirmationBeforeRun: true }))).toContain(
      "requires confirmation before running"
    );
  });

  it("does not mention confirmation when not required", () => {
    expect(describeRunMode(makeConfig({ requireConfirmationBeforeRun: false }))).not.toContain(
      "requires confirmation"
    );
  });
});

// ─── isAutoRunEnabled ─────────────────────────────────────────────────────────

describe("isAutoRunEnabled", () => {
  it("returns true when auto-start is on and confirmation is not required", () => {
    expect(
      isAutoRunEnabled(makeConfig({ autoStartOnApproval: true, requireConfirmationBeforeRun: false }))
    ).toBe(true);
  });

  it("returns false when auto-start is off", () => {
    expect(
      isAutoRunEnabled(makeConfig({ autoStartOnApproval: false, requireConfirmationBeforeRun: false }))
    ).toBe(false);
  });

  it("returns false when confirmation is required even if auto-start is on", () => {
    expect(
      isAutoRunEnabled(makeConfig({ autoStartOnApproval: true, requireConfirmationBeforeRun: true }))
    ).toBe(false);
  });

  it("returns false for the default config", () => {
    expect(isAutoRunEnabled(DEFAULT_RUN_MODE_CONFIG)).toBe(false);
  });
});
