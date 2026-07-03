import { describe, expect, it } from "vitest";

import { humanizeEvent } from "./humanize";
import type { AgentStreamEvent, AgentStreamEventType } from "./types";

/** Builds a stored event; label/detail/type overridable per case. */
function makeEvent(
  type: AgentStreamEventType,
  label: string,
  detail: string | null = null,
  seq = 1
): AgentStreamEvent {
  return { seq, type, label, detail, atMs: seq * 100 };
}

describe("humanizeEvent", () => {
  describe("status lifecycle markers", () => {
    it("phrases a start marker as 'Started working…'", () => {
      const h = humanizeEvent(makeEvent("status", "Agent started"));
      expect(h.tone).toBe("status");
      expect(h.icon).toBe("•");
      expect(h.text).toBe("Started working…");
    });

    it("phrases finish/complete/exit markers as 'Finished'", () => {
      for (const label of [
        "Agent finished",
        "Run completed",
        "Process exited",
        "Session ended",
      ]) {
        const h = humanizeEvent(makeEvent("status", label));
        expect(h.tone).toBe("status");
        expect(h.text).toBe("Finished");
      }
    });

    it("recognizes a truncation marker", () => {
      const h = humanizeEvent(
        makeEvent("status", "Output truncated at 5000 events")
      );
      expect(h.tone).toBe("status");
      expect(h.text).toMatch(/truncated/i);
    });

    it("falls back to the raw status text when unrecognized", () => {
      const h = humanizeEvent(makeEvent("status", "Reconnecting"));
      expect(h.tone).toBe("status");
      expect(h.text).toBe("Reconnecting");
    });
  });

  describe("stderr", () => {
    it("is always an error tone", () => {
      const h = humanizeEvent(makeEvent("stderr", "warning: deprecated API"));
      expect(h.tone).toBe("error");
      expect(h.icon).toBe("!");
      expect(h.text).toBe("warning: deprecated API");
    });

    it("uses a placeholder when the stderr line is empty", () => {
      const h = humanizeEvent(makeEvent("stderr", ""));
      expect(h.tone).toBe("error");
      expect(h.text).toBe("(stderr)");
    });
  });

  describe("file actions", () => {
    it("recognizes an edit and phrases it as 'Edited <path>'", () => {
      const h = humanizeEvent(makeEvent("tool", "Edited src/foo.ts"));
      expect(h.tone).toBe("action");
      expect(h.icon).toBe("→");
      expect(h.text).toBe("Edited src/foo.ts");
    });

    it("normalizes write/create/update/delete verbs to past tense", () => {
      const cases: Array<[string, string]> = [
        ["Writing src/bar.tsx", "Wrote src/bar.tsx"],
        ["Created src/baz.ts", "Created src/baz.ts"],
        ["Updating src/app/page.tsx", "Updated src/app/page.tsx"],
        ["Modified lib/util.ts", "Modified lib/util.ts"],
        ["Added src/new.ts", "Added src/new.ts"],
        ["Deleting src/old.ts", "Deleted src/old.ts"],
        ["Removed lib/dead.ts", "Deleted lib/dead.ts"],
      ];
      for (const [input, expected] of cases) {
        const h = humanizeEvent(makeEvent("text", input));
        expect(h.tone).toBe("action");
        expect(h.text).toBe(expected);
      }
    });

    it("keeps Next.js route-group and dynamic segments in the path", () => {
      const cases: Array<[string, string]> = [
        [
          "Editing src/app/(auth)/login/page.tsx",
          "Edited src/app/(auth)/login/page.tsx",
        ],
        [
          "Writing src/app/api/work/sessions/[sessionId]/stream/route.ts",
          "Wrote src/app/api/work/sessions/[sessionId]/stream/route.ts",
        ],
      ];
      for (const [input, expected] of cases) {
        const h = humanizeEvent(makeEvent("text", input));
        expect(h.tone).toBe("action");
        expect(h.text).toBe(expected);
      }
    });

    it("treats a tool line naming a path (no verb) as an action", () => {
      const h = humanizeEvent(makeEvent("tool", "Read src/config.ts"));
      expect(h.tone).toBe("action");
      expect(h.text).toBe("Read src/config.ts");
    });

    it("treats a verb + explicit 'file' (no path) as an action", () => {
      const h = humanizeEvent(makeEvent("tool", "Writing file to disk"));
      expect(h.tone).toBe("action");
      expect(h.text).toBe("Writing file to disk");
    });
  });

  describe("commands", () => {
    it("recognizes a 'Running …' line as an action", () => {
      const h = humanizeEvent(makeEvent("text", "Running npm test"));
      expect(h.tone).toBe("action");
      expect(h.text).toBe("Running npm test");
    });

    it("rewrites a shell-prompt line as 'Ran <command>'", () => {
      const h = humanizeEvent(makeEvent("text", "$ pnpm build"));
      expect(h.tone).toBe("action");
      expect(h.text).toBe("Ran pnpm build");
    });

    it("recognizes bare package-manager / tooling commands", () => {
      for (const cmd of ["npm install", "pnpm lint", "git commit", "npx tsc"]) {
        const h = humanizeEvent(makeEvent("text", cmd));
        expect(h.tone).toBe("action");
      }
    });
  });

  describe("test / build results", () => {
    it("marks passing/success lines as a result", () => {
      for (const line of [
        "5 passing (1.2s)",
        "PASS src/foo.test.ts",
        "Build compiled successfully",
        "Tests passed",
      ]) {
        const h = humanizeEvent(makeEvent("result", line));
        expect(h.tone).toBe("result");
        expect(h.icon).toBe("✓");
      }
    });

    it("marks failing/error lines as an error", () => {
      for (const line of [
        "1 failing",
        "FAIL src/foo.test.ts",
        "error: something broke",
        "Uncaught exception",
      ]) {
        const h = humanizeEvent(makeEvent("text", line));
        expect(h.tone).toBe("error");
      }
    });

    it("reads '0 errors' / '0 failing' as a clean result, not an error", () => {
      for (const line of ["0 errors", "0 failing", "0 failures"]) {
        const h = humanizeEvent(makeEvent("result", line));
        expect(h.tone).toBe("result");
      }
    });

    it("prioritizes a failure signal over a file path in the same line", () => {
      const h = humanizeEvent(
        makeEvent("text", "FAIL src/foo.test.ts (2 failing)")
      );
      expect(h.tone).toBe("error");
    });
  });

  describe("fallthrough", () => {
    it("keeps a plain text line as info with the emitter's label", () => {
      const h = humanizeEvent(
        makeEvent("text", "Reviewing the repository structure")
      );
      expect(h.tone).toBe("info");
      expect(h.icon).toBe("›");
      expect(h.text).toBe("Reviewing the repository structure");
    });

    it("keeps an unrecognized raw line as info", () => {
      const h = humanizeEvent(makeEvent("raw", "some uncategorized output"));
      expect(h.tone).toBe("info");
      expect(h.text).toBe("some uncategorized output");
    });

    it("keeps an unrecognized result line as a result tone", () => {
      const h = humanizeEvent(makeEvent("result", "Summary of changes"));
      expect(h.tone).toBe("result");
      expect(h.text).toBe("Summary of changes");
    });

    it("falls back to detail when the label is empty", () => {
      const h = humanizeEvent(makeEvent("text", "", "fallback detail"));
      expect(h.text).toBe("fallback detail");
      expect(h.tone).toBe("info");
    });

    it("shows a placeholder when both label and detail are empty", () => {
      const h = humanizeEvent(makeEvent("text", "", null));
      expect(h.text).toBe("(no output)");
      expect(h.tone).toBe("info");
    });
  });

  describe("length handling", () => {
    it("trims a long line to a readable length with an ellipsis", () => {
      const long = "a".repeat(200);
      const h = humanizeEvent(makeEvent("text", long));
      expect(h.text.length).toBe(140);
      expect(h.text.endsWith("…")).toBe(true);
    });

    it("leaves a short line untouched", () => {
      const h = humanizeEvent(makeEvent("text", "short line"));
      expect(h.text).toBe("short line");
    });
  });
});
