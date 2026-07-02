import os from "node:os";

import { describe, expect, it } from "vitest";

import { runGit } from "./repo-manager";

// Real-subprocess coverage for the hardened git runner (MUS-293): the timeout
// must actually fire (a hung op can't freeze the worker), and the
// non-interactive env must reach the child (so git can't block on a prompt).
// These use the REAL execSync — no child_process mock in this file.

describe("runGit (real subprocess)", () => {
  it("kills and throws when a command exceeds its timeout bound", () => {
    // `sleep 2` would run for two seconds; the 200ms bound must abort it.
    const start = Date.now();
    expect(() => runGit("sleep 2", { cwd: os.tmpdir(), timeoutMs: 200 })).toThrow();
    // It returned promptly (killed), not after the full sleep.
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it("runs a non-interactive env with GIT_TERMINAL_PROMPT disabled", () => {
    const value = runGit("printenv GIT_TERMINAL_PROMPT", {
      cwd: os.tmpdir(),
      timeoutMs: 5000,
    });
    expect(value.trim()).toBe("0");
  });

  it("captures stdout without an inherited TTY", () => {
    const out = runGit("echo hardened", { cwd: os.tmpdir(), timeoutMs: 5000 });
    expect(out.trim()).toBe("hardened");
  });
});
