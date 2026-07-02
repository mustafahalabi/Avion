import { describe, expect, it } from "vitest";
import {
  WorkerAuditLog,
  buildSessionAuditView,
  createWorkerAuditLog,
  extractAuditEventsFromSession,
  isSafetyBlockEventType,
  parseAuditLogFromSession,
} from "./worker-audit-log";
import type { AuditEventType, AuditSeverity } from "./worker-audit-log";

// ─── WorkerAuditLog constructor ───────────────────────────────────────────────

describe("WorkerAuditLog constructor", () => {
  it("stores the session ID", () => {
    const log = new WorkerAuditLog("ses_001");
    expect(log.sessionId).toBe("ses_001");
  });

  it("starts with no events", () => {
    const log = new WorkerAuditLog("ses_001");
    expect(log.getEvents()).toHaveLength(0);
  });

  it("throws when sessionId is empty string", () => {
    expect(() => new WorkerAuditLog("")).toThrow(
      "sessionId must be a non-empty string"
    );
  });

  it("throws when sessionId is whitespace only", () => {
    expect(() => new WorkerAuditLog("   ")).toThrow(
      "sessionId must be a non-empty string"
    );
  });
});

// ─── log() ───────────────────────────────────────────────────────────────────

describe("WorkerAuditLog.log()", () => {
  it("returns a well-formed AuditEvent", () => {
    const log = new WorkerAuditLog("ses_002");
    const event = log.log("file_read", { path: "src/lib/foo.ts" });

    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(event.sessionId).toBe("ses_002");
    expect(event.type).toBe("file_read");
    expect(event.actor).toBe("claude_code");
    expect(event.severity).toBe("info");
    expect(event.details).toEqual({ path: "src/lib/foo.ts" });
    expect(typeof event.timestamp).toBe("string");
    // Valid ISO 8601
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
  });

  it("defaults severity to 'info'", () => {
    const log = new WorkerAuditLog("ses_003");
    const event = log.log("session_started", {});
    expect(event.severity).toBe("info");
  });

  it("accepts explicit severity values", () => {
    const log = new WorkerAuditLog("ses_004");
    const warn = log.log("permission_check", {}, "warn");
    const error = log.log("command_blocked", {}, "error");
    expect(warn.severity).toBe("warn");
    expect(error.severity).toBe("error");
  });

  it("accepts explicit actor", () => {
    const log = new WorkerAuditLog("ses_005");
    const event = log.log("validation_run", {}, "info", "system");
    expect(event.actor).toBe("system");
  });

  it("assigns unique IDs to each event", () => {
    const log = new WorkerAuditLog("ses_006");
    const e1 = log.log("file_read", {});
    const e2 = log.log("file_read", {});
    expect(e1.id).not.toBe(e2.id);
  });

  it("accumulates events in insertion order", () => {
    const log = new WorkerAuditLog("ses_007");
    const types: AuditEventType[] = [
      "session_started",
      "file_read",
      "file_written",
      "session_completed",
    ];
    for (const t of types) log.log(t, {});
    expect(log.getEvents().map((e) => e.type)).toEqual(types);
  });

  it("covers every AuditEventType without error", () => {
    const log = new WorkerAuditLog("ses_all");
    const allTypes: AuditEventType[] = [
      "session_started",
      "session_completed",
      "session_failed",
      "file_read",
      "file_written",
      "file_deleted",
      "command_executed",
      "command_blocked",
      "permission_check",
      "guardrail_triggered",
      "branch_created",
      "pr_opened",
      "validation_run",
    ];
    for (const type of allTypes) {
      expect(() => log.log(type, { type })).not.toThrow();
    }
    expect(log.getEvents()).toHaveLength(allTypes.length);
  });
});

// ─── getEvents() ──────────────────────────────────────────────────────────────

describe("WorkerAuditLog.getEvents()", () => {
  it("returns a copy — mutating the returned array does not affect the log", () => {
    const log = new WorkerAuditLog("ses_008");
    log.log("file_read", {});
    const events = log.getEvents();
    events.pop();
    expect(log.getEvents()).toHaveLength(1);
  });
});

// ─── getEventsByType() ────────────────────────────────────────────────────────

describe("WorkerAuditLog.getEventsByType()", () => {
  it("returns only events of the requested type", () => {
    const log = new WorkerAuditLog("ses_009");
    log.log("file_read", { path: "a.ts" });
    log.log("file_written", { path: "b.ts" });
    log.log("file_read", { path: "c.ts" });

    const reads = log.getEventsByType("file_read");
    expect(reads).toHaveLength(2);
    expect(reads.every((e) => e.type === "file_read")).toBe(true);
  });

  it("returns empty array when no events of that type exist", () => {
    const log = new WorkerAuditLog("ses_010");
    log.log("session_started", {});
    expect(log.getEventsByType("guardrail_triggered")).toHaveLength(0);
  });
});

// ─── getEventsBySeverity() ────────────────────────────────────────────────────

describe("WorkerAuditLog.getEventsBySeverity()", () => {
  it("returns only info events when minSeverity is 'info'", () => {
    const log = new WorkerAuditLog("ses_011");
    log.log("file_read", {}, "info");
    log.log("permission_check", {}, "warn");
    log.log("command_blocked", {}, "error");

    const all = log.getEventsBySeverity("info");
    expect(all).toHaveLength(3);
  });

  it("excludes info events when minSeverity is 'warn'", () => {
    const log = new WorkerAuditLog("ses_012");
    log.log("file_read", {}, "info");
    log.log("permission_check", {}, "warn");
    log.log("command_blocked", {}, "error");

    const warnAndAbove = log.getEventsBySeverity("warn");
    expect(warnAndAbove).toHaveLength(2);
    expect(warnAndAbove.every((e) => e.severity !== "info")).toBe(true);
  });

  it("returns only error events when minSeverity is 'error'", () => {
    const log = new WorkerAuditLog("ses_013");
    log.log("file_read", {}, "info");
    log.log("permission_check", {}, "warn");
    log.log("guardrail_triggered", {}, "error");

    const errors = log.getEventsBySeverity("error");
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
  });

  it("treats an unknown severity value as 'info' (included at minSeverity 'info')", () => {
    const log = new WorkerAuditLog("ses_unknown_sev");
    // Force an unknown severity via type cast to simulate deserialized corrupt data
    log.log("file_read", {}, "info" as AuditSeverity);
    const events = log.getEvents();
    // Patch the severity to an unknown value directly on the event object
    (events[0] as { severity: string }).severity = "debug";

    // Reconstruct via serialize/deserialize to get the patched event into a new log
    const envelope = {
      version: 1,
      sessionId: "ses_unknown_sev",
      events: [{ ...events[0], severity: "debug" }],
    };
    const restored = WorkerAuditLog.deserialize(JSON.stringify(envelope));

    // "debug" is unknown — treated as info (level 0), so included at minSeverity "info"
    expect(restored.getEventsBySeverity("info")).toHaveLength(1);
    // But excluded at minSeverity "warn" (level 1), since unknown defaults to 0
    expect(restored.getEventsBySeverity("warn")).toHaveLength(0);
  });
});

// ─── serialize() / deserialize() ─────────────────────────────────────────────

describe("WorkerAuditLog serialize / deserialize round-trip", () => {
  it("round-trips an empty log", () => {
    const original = new WorkerAuditLog("ses_014");
    const restored = WorkerAuditLog.deserialize(original.serialize());

    expect(restored.sessionId).toBe("ses_014");
    expect(restored.getEvents()).toHaveLength(0);
  });

  it("round-trips events with all fields intact", () => {
    const original = new WorkerAuditLog("ses_015");
    original.log("session_started", { agentType: "claude_code" });
    original.log("file_written", { path: "src/lib/foo.ts", bytes: 512 }, "info", "claude_code");
    original.log("command_blocked", { command: "rm -rf /" }, "error", "system");

    const restored = WorkerAuditLog.deserialize(original.serialize());

    const originalEvents = original.getEvents();
    const restoredEvents = restored.getEvents();

    expect(restoredEvents).toHaveLength(originalEvents.length);
    for (let i = 0; i < originalEvents.length; i++) {
      expect(restoredEvents[i]).toEqual(originalEvents[i]);
    }
  });

  it("preserves original event IDs after deserialization", () => {
    const original = new WorkerAuditLog("ses_016");
    const e1 = original.log("file_read", {});
    const e2 = original.log("file_written", {});

    const restored = WorkerAuditLog.deserialize(original.serialize());
    const events = restored.getEvents();

    expect(events[0].id).toBe(e1.id);
    expect(events[1].id).toBe(e2.id);
  });

  it("preserves event insertion order after deserialization", () => {
    const original = new WorkerAuditLog("ses_017");
    const types: AuditEventType[] = [
      "session_started",
      "branch_created",
      "file_written",
      "validation_run",
      "pr_opened",
      "session_completed",
    ];
    for (const t of types) original.log(t, {});

    const restored = WorkerAuditLog.deserialize(original.serialize());
    expect(restored.getEvents().map((e) => e.type)).toEqual(types);
  });

  it("serialize produces valid JSON", () => {
    const log = new WorkerAuditLog("ses_018");
    log.log("session_started", { meta: { nested: true } });
    const json = log.serialize();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("deserialize throws on invalid JSON", () => {
    expect(() => WorkerAuditLog.deserialize("not-json")).toThrow(
      "invalid JSON"
    );
  });

  it("deserialize throws on wrong version", () => {
    const envelope = JSON.stringify({ version: 2, sessionId: "x", events: [] });
    expect(() => WorkerAuditLog.deserialize(envelope)).toThrow(
      "unrecognized envelope"
    );
  });

  it("deserialize throws on missing sessionId", () => {
    const envelope = JSON.stringify({ version: 1, events: [] });
    expect(() => WorkerAuditLog.deserialize(envelope)).toThrow(
      "missing or invalid sessionId"
    );
  });

  it("deserialize throws when events is not an array", () => {
    const envelope = JSON.stringify({ version: 1, sessionId: "ses_x", events: null });
    expect(() => WorkerAuditLog.deserialize(envelope)).toThrow(
      "events must be an array"
    );
  });

  it("deserialize throws on null input parsed as null", () => {
    expect(() => WorkerAuditLog.deserialize("null")).toThrow(
      "unrecognized envelope"
    );
  });

  it("deserialize skips null entries inside events array without throwing", () => {
    const envelope = JSON.stringify({
      version: 1,
      sessionId: "ses_null_entry",
      events: [null, null],
    });
    const restored = WorkerAuditLog.deserialize(envelope);
    expect(restored.getEvents()).toHaveLength(0);
  });

  it("deserialize skips primitive entries inside events array without throwing", () => {
    const envelope = JSON.stringify({
      version: 1,
      sessionId: "ses_prim_entry",
      events: [42, "bad", true, null],
    });
    const restored = WorkerAuditLog.deserialize(envelope);
    expect(restored.getEvents()).toHaveLength(0);
  });

  it("deserialize overwrites event sessionId with the envelope sessionId", () => {
    const original = new WorkerAuditLog("ses_correct");
    original.log("file_read", {});

    // Tamper with the serialized JSON to inject a mismatched sessionId
    const tampered = JSON.parse(original.serialize()) as {
      version: number;
      sessionId: string;
      events: Array<{ sessionId: string }>;
    };
    tampered.events[0].sessionId = "ses_wrong";
    const restored = WorkerAuditLog.deserialize(JSON.stringify(tampered));

    expect(restored.getEvents()[0].sessionId).toBe("ses_correct");
  });
});

// ─── getSummary() ─────────────────────────────────────────────────────────────

describe("WorkerAuditLog.getSummary()", () => {
  it("returns a zero-events summary when log is empty", () => {
    const log = new WorkerAuditLog("ses_019");
    expect(log.getSummary()).toBe("[ses_019] 0 events");
  });

  it("includes the session ID in the summary", () => {
    const log = new WorkerAuditLog("ses-special-id");
    log.log("session_started", {});
    expect(log.getSummary()).toContain("ses-special-id");
  });

  it("counts total events correctly", () => {
    const log = new WorkerAuditLog("ses_020");
    log.log("file_read", {});
    log.log("file_read", {});
    log.log("file_written", {});
    const summary = log.getSummary();
    expect(summary).toContain("3 events");
  });

  it("tallies each event type", () => {
    const log = new WorkerAuditLog("ses_021");
    log.log("file_read", {});
    log.log("file_read", {});
    log.log("session_completed", {});
    const summary = log.getSummary();
    expect(summary).toContain("2× file_read");
    expect(summary).toContain("1× session_completed");
  });

  it("reports zero warnings and zero errors when log has only info events", () => {
    const log = new WorkerAuditLog("ses_022");
    log.log("session_started", {}, "info");
    log.log("session_completed", {}, "info");
    expect(log.getSummary()).toContain("0 warnings, 0 errors");
  });

  it("counts warnings correctly", () => {
    const log = new WorkerAuditLog("ses_023");
    log.log("permission_check", {}, "warn");
    log.log("permission_check", {}, "warn");
    const summary = log.getSummary();
    expect(summary).toContain("2 warnings");
  });

  it("counts errors correctly", () => {
    const log = new WorkerAuditLog("ses_024");
    log.log("guardrail_triggered", {}, "error");
    const summary = log.getSummary();
    expect(summary).toContain("1 error");
  });

  it("uses singular 'event' when count is 1", () => {
    const log = new WorkerAuditLog("ses_025");
    log.log("session_started", {});
    expect(log.getSummary()).toContain("1 event:");
  });
});

// ─── createWorkerAuditLog() factory ──────────────────────────────────────────

describe("createWorkerAuditLog()", () => {
  it("returns a WorkerAuditLog instance", () => {
    const log = createWorkerAuditLog("ses_026");
    expect(log).toBeInstanceOf(WorkerAuditLog);
  });

  it("binds the session ID", () => {
    const log = createWorkerAuditLog("ses_027");
    expect(log.sessionId).toBe("ses_027");
  });
});

// ─── parseAuditLogFromSession() ───────────────────────────────────────────────

describe("parseAuditLogFromSession()", () => {
  it("returns empty array when resultSummary is null", () => {
    expect(parseAuditLogFromSession({ resultSummary: null })).toEqual([]);
  });

  it("returns empty array when resultSummary is undefined", () => {
    expect(parseAuditLogFromSession({})).toEqual([]);
  });

  it("returns empty array when resultSummary is empty string", () => {
    expect(parseAuditLogFromSession({ resultSummary: "" })).toEqual([]);
  });

  it("returns empty array when resultSummary is plain text (not JSON)", () => {
    expect(
      parseAuditLogFromSession({ resultSummary: "Implementation completed." })
    ).toEqual([]);
  });

  it("returns empty array when resultSummary is arbitrary JSON (no envelope)", () => {
    const json = JSON.stringify({ foo: "bar" });
    expect(parseAuditLogFromSession({ resultSummary: json })).toEqual([]);
  });

  it("extracts events from a serialized WorkerAuditLog", () => {
    const log = createWorkerAuditLog("ses_028");
    log.log("session_started", { agentType: "claude_code" });
    log.log("file_written", { path: "src/lib/foo.ts" });
    log.log("session_completed", {});

    const extracted = parseAuditLogFromSession({ resultSummary: log.serialize() });
    expect(extracted).toHaveLength(3);
    expect(extracted[0].type).toBe("session_started");
    expect(extracted[1].type).toBe("file_written");
    expect(extracted[2].type).toBe("session_completed");
  });

  it("extracted events have all original fields", () => {
    const log = createWorkerAuditLog("ses_029");
    const recorded = log.log("command_blocked", { command: "curl evil.com" }, "error", "system");
    const [extracted] = parseAuditLogFromSession({ resultSummary: log.serialize() });

    expect(extracted.id).toBe(recorded.id);
    expect(extracted.sessionId).toBe("ses_029");
    expect(extracted.actor).toBe("system");
    expect(extracted.severity).toBe("error");
    expect(extracted.details).toEqual({ command: "curl evil.com" });
  });

  it("returns empty array when resultSummary is malformed JSON", () => {
    expect(
      parseAuditLogFromSession({ resultSummary: "{invalid" })
    ).toEqual([]);
  });
});

// ─── Integration: full session lifecycle ─────────────────────────────────────

describe("full session lifecycle integration", () => {
  it("models a complete execution session end-to-end", () => {
    const sessionId = "ses_lifecycle_001";
    const log = createWorkerAuditLog(sessionId);

    // Session starts
    log.log("session_started", { agentType: "claude_code", baseBranch: "master" });

    // Agent creates a branch
    log.log("branch_created", { branchName: "feature/mus-999-my-feature" });

    // Agent reads files
    log.log("file_read", { path: "src/lib/foo.ts" });
    log.log("file_read", { path: "src/lib/bar.ts" });

    // Permission check (e.g. guardrail evaluated)
    log.log("permission_check", { resource: "prisma/schema.prisma", granted: true }, "warn");

    // Agent writes files
    log.log("file_written", { path: "src/lib/new-feature.ts", bytes: 2048 });
    log.log("file_written", { path: "src/lib/new-feature.test.ts", bytes: 1024 });

    // Validation
    log.log("validation_run", { commands: ["tsc --noEmit", "vitest run"], exitCode: 0 });

    // PR opened
    log.log("pr_opened", { prNumber: 42, prUrl: "https://github.com/org/repo/pull/42" });

    // Session completes
    log.log("session_completed", { filesChanged: 2 });

    // Verify totals
    expect(log.getEvents()).toHaveLength(10);
    expect(log.getEventsByType("file_read")).toHaveLength(2);
    expect(log.getEventsByType("file_written")).toHaveLength(2);
    expect(log.getEventsBySeverity("warn")).toHaveLength(1);

    // Serialize and restore
    const serialized = log.serialize();
    const restored = WorkerAuditLog.deserialize(serialized);
    expect(restored.getEvents()).toHaveLength(10);

    // Extract via session helper
    const extracted = parseAuditLogFromSession({ resultSummary: serialized });
    expect(extracted).toHaveLength(10);

    // Summary is readable
    const summary = log.getSummary();
    expect(summary).toContain(sessionId);
    expect(summary).toContain("10 events");
    expect(summary).toContain("1 warning");
    expect(summary).toContain("0 errors");
  });

  it("models a failed session with guardrail blocks", () => {
    const log = createWorkerAuditLog("ses_failed_001");
    log.log("session_started", {});
    log.log("file_read", { path: "prisma/schema.prisma" });
    log.log("guardrail_triggered", { rule: "no-schema-mutations", blocked: true }, "error");
    log.log("command_blocked", { command: "npx prisma migrate dev" }, "error");
    log.log("session_failed", { reason: "guardrail: no-schema-mutations" });

    const errors = log.getEventsBySeverity("error");
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.type)).toContain("guardrail_triggered");
    expect(errors.map((e) => e.type)).toContain("command_blocked");

    const summary = log.getSummary();
    expect(summary).toContain("2 errors");
  });
});

// ─── CEO audit view (MUS-215) ─────────────────────────────────────────────────

describe("isSafetyBlockEventType()", () => {
  it("flags command_blocked and guardrail_triggered as safety blocks", () => {
    expect(isSafetyBlockEventType("command_blocked")).toBe(true);
    expect(isSafetyBlockEventType("guardrail_triggered")).toBe(true);
  });

  it("does not flag normal events", () => {
    expect(isSafetyBlockEventType("file_written")).toBe(false);
    expect(isSafetyBlockEventType("session_completed")).toBe(false);
  });
});

describe("extractAuditEventsFromSession()", () => {
  it("reads a serialized log from validationOutput", () => {
    const log = createWorkerAuditLog("ses_v1");
    log.log("guardrail_triggered", { path: ".env" }, "error", "system");
    const events = extractAuditEventsFromSession({
      validationOutput: log.serialize(),
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("guardrail_triggered");
  });

  it("falls back to resultSummary when validationOutput is plain text", () => {
    const log = createWorkerAuditLog("ses_v2");
    log.log("session_completed", {});
    const events = extractAuditEventsFromSession({
      validationOutput: "tsc passed",
      resultSummary: log.serialize(),
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("session_completed");
  });

  it("returns empty when neither field holds a serialized log", () => {
    expect(
      extractAuditEventsFromSession({
        validationOutput: "tsc passed",
        resultSummary: "done",
      })
    ).toEqual([]);
  });
});

describe("buildSessionAuditView()", () => {
  it("surfaces serialized audit-log events and flags safety blocks", () => {
    const log = createWorkerAuditLog("ses_blocked");
    log.log("session_started", {}, "info", "system");
    log.log(
      "guardrail_triggered",
      { path: ".env", message: "protected path" },
      "error",
      "system"
    );
    log.log(
      "command_blocked",
      { command: "git push --force", message: "force push" },
      "error",
      "system"
    );

    const view = buildSessionAuditView({
      status: "failed",
      validationOutput: log.serialize(),
    });

    expect(view.source).toBe("audit_log");
    expect(view.hasSafetyBlock).toBe(true);
    expect(view.blockedCount).toBe(2);
    expect(view.events).toHaveLength(3);

    const blocked = view.events.filter((e) => e.isSafetyBlock);
    expect(blocked.map((e) => e.type)).toEqual([
      "guardrail_triggered",
      "command_blocked",
    ]);
    // Detail strings include the offending path/command.
    expect(blocked[0].detail).toContain(".env");
    expect(blocked[1].detail).toContain("git push --force");
  });

  it("derives a gap-free trail from session facts when no log exists", () => {
    const view = buildSessionAuditView({
      status: "completed",
      filesChanged: JSON.stringify(["src/a.ts", "src/b.ts"]),
      commitSha: "abcdef1234567",
      prUrl: "https://github.com/x/y/pull/9",
      prNumber: 9,
      validationOutput: "tsc, lint, test all pass",
    });

    expect(view.source).toBe("derived");
    expect(view.hasSafetyBlock).toBe(false);

    const types = view.events.map((e) => e.type);
    expect(types).toContain("session_started");
    expect(types).toContain("files_changed");
    expect(types).toContain("command_executed");
    expect(types).toContain("pr_opened");
    expect(types).toContain("session_completed");
  });

  it("derives a failed outcome with the error message", () => {
    const view = buildSessionAuditView({
      status: "failed",
      errorMessage: "Push blocked by 1 guardrail violation: .env",
    });

    expect(view.source).toBe("derived");
    const failure = view.events.find((e) => e.type === "session_failed");
    expect(failure?.severity).toBe("error");
    expect(failure?.detail).toContain(".env");
  });

  it("returns no events for an empty session", () => {
    const view = buildSessionAuditView({ status: null });
    // Only a session_started marker is derived; nothing else.
    expect(view.events.map((e) => e.type)).toEqual(["session_started"]);
    expect(view.hasSafetyBlock).toBe(false);
  });
});
