import { describe, expect, it } from "vitest";
import {
  generateQaChecklist,
  serializeChecklist,
  countChecklist,
  type QaChecklistInput,
} from "./qa-checklist";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_INPUT: QaChecklistInput = {
  acceptanceCriteria: [
    "Session status transitions to completed, failed, or needs_clarification.",
    "Task status is updated when a session completes.",
    "Timeline events are created.",
  ],
  reviewNotes: "Looks good. Minor comment about naming.",
  reviewFindings: [
    { severity: "non_blocker", description: "Consider renaming foo to bar." },
  ],
  filesChanged: [
    "src/lib/execution-session-service.ts",
    "src/lib/execution-session-service.test.ts",
  ],
  validationCommands: ["npx tsc --noEmit", "npm run lint", "npm run test"],
};

const EMPTY_INPUT: QaChecklistInput = {
  acceptanceCriteria: [],
  reviewNotes: null,
  reviewFindings: [],
  filesChanged: [],
  validationCommands: [],
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("generateQaChecklist", () => {
  // ── Functional checks ────────────────────────────────────────────────────────

  it("generates one functional check per acceptance criterion", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const functional = items.filter((i) => i.category === "functional");
    expect(functional).toHaveLength(3);
  });

  it("functional check label contains the criterion text", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const functional = items.filter((i) => i.category === "functional");
    expect(functional[0]?.label).toContain("Session status transitions");
    expect(functional[1]?.label).toContain("Task status is updated");
    expect(functional[2]?.label).toContain("Timeline events are created");
  });

  it("generates a fallback functional check when no criteria provided", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const functional = items.filter((i) => i.category === "functional");
    expect(functional).toHaveLength(1);
    expect(functional[0]?.label).toContain("task requirements");
  });

  // ── Validation checks ────────────────────────────────────────────────────────

  it("generates one validation check per command", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const validation = items.filter((i) => i.category === "validation");
    expect(validation).toHaveLength(3);
  });

  it("validation check labels reference the command", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const validation = items.filter((i) => i.category === "validation");
    expect(validation[0]?.label).toContain("npx tsc --noEmit");
    expect(validation[1]?.label).toContain("npm run lint");
    expect(validation[2]?.label).toContain("npm run test");
  });

  it("generates no validation checks when command list is empty", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const validation = items.filter((i) => i.category === "validation");
    expect(validation).toHaveLength(0);
  });

  // ── Files check ───────────────────────────────────────────────────────────────

  it("generates one files check when files are present", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const files = items.filter((i) => i.category === "files");
    expect(files).toHaveLength(1);
  });

  it("files check label mentions the count", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const filesCheck = items.find((i) => i.category === "files");
    expect(filesCheck?.label).toContain("2 files");
  });

  it("generates no files check when no files changed", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const files = items.filter((i) => i.category === "files");
    expect(files).toHaveLength(0);
  });

  it("files check is singular for one file", () => {
    const items = generateQaChecklist({
      ...EMPTY_INPUT,
      filesChanged: ["src/lib/foo.ts"],
    });
    const filesCheck = items.find((i) => i.category === "files");
    expect(filesCheck?.label).toContain("1 file");
    expect(filesCheck?.label).not.toContain("1 files");
  });

  // ── Regression checks ────────────────────────────────────────────────────────

  it("always includes regression checks", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const regression = items.filter((i) => i.category === "regression");
    expect(regression.length).toBeGreaterThan(0);
  });

  it("regression checks cover existing tests and functionality", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const regression = items.filter((i) => i.category === "regression");
    const labels = regression.map((i) => i.label);
    expect(labels.some((l) => /existing/i.test(l))).toBe(true);
  });

  // ── Security checks ──────────────────────────────────────────────────────────

  it("always includes security checks", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const security = items.filter((i) => i.category === "security");
    expect(security.length).toBeGreaterThan(0);
  });

  it("security checks include ownership and vulnerability checks", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const security = items.filter((i) => i.category === "security");
    const labels = security.map((i) => i.label);
    expect(labels.some((l) => /vulnerabilit/i.test(l))).toBe(true);
    expect(labels.some((l) => /ownership/i.test(l))).toBe(true);
  });

  // ── Performance checks ────────────────────────────────────────────────────────

  it("always includes at least one performance check", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const performance = items.filter((i) => i.category === "performance");
    expect(performance.length).toBeGreaterThan(0);
  });

  // ── UX checks ────────────────────────────────────────────────────────────────

  it("includes UX checks when .tsx files are changed", () => {
    const items = generateQaChecklist({
      ...EMPTY_INPUT,
      filesChanged: ["src/app/page.tsx"],
    });
    const ux = items.filter((i) => i.category === "ux");
    expect(ux.length).toBeGreaterThan(0);
  });

  it("includes UX checks when .css files are changed", () => {
    const items = generateQaChecklist({
      ...EMPTY_INPUT,
      filesChanged: ["src/app/globals.css"],
    });
    const ux = items.filter((i) => i.category === "ux");
    expect(ux.length).toBeGreaterThan(0);
  });

  it("includes UX checks when files are in app/ directory", () => {
    const items = generateQaChecklist({
      ...EMPTY_INPUT,
      filesChanged: ["src/app/(app)/work/tasks/[id]/page.tsx"],
    });
    const ux = items.filter((i) => i.category === "ux");
    expect(ux.length).toBeGreaterThan(0);
  });

  it("omits UX checks when no UI files are changed", () => {
    const items = generateQaChecklist({
      ...EMPTY_INPUT,
      filesChanged: ["src/lib/review-service.ts", "src/lib/review-service.test.ts"],
    });
    const ux = items.filter((i) => i.category === "ux");
    expect(ux).toHaveLength(0);
  });

  // ── Item structure ────────────────────────────────────────────────────────────

  it("all items have unique IDs", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const ids = items.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all items start with passed: false", () => {
    const items = generateQaChecklist(FULL_INPUT);
    expect(items.every((i) => i.passed === false)).toBe(true);
  });

  it("each item has id, category, label, and passed fields", () => {
    const items = generateQaChecklist(FULL_INPUT);
    for (const item of items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("passed");
    }
  });

  it("returns at least functional + regression + security + performance checks", () => {
    const items = generateQaChecklist(EMPTY_INPUT);
    const categories = new Set(items.map((i) => i.category));
    expect(categories.has("functional")).toBe(true);
    expect(categories.has("regression")).toBe(true);
    expect(categories.has("security")).toBe(true);
    expect(categories.has("performance")).toBe(true);
  });
});

// ─── serializeChecklist ───────────────────────────────────────────────────────

describe("serializeChecklist", () => {
  it("serializes to a valid JSON string", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const json = serializeChecklist(items);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("serialized items are parseable back into check items", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const json = serializeChecklist(items);
    const parsed = JSON.parse(json) as { label: string; passed: boolean }[];
    expect(parsed.length).toBe(items.length);
    expect(parsed[0]).toHaveProperty("label");
    expect(parsed[0]).toHaveProperty("passed");
  });

  it("serialized format is compatible with existing label/passed reader", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const json = serializeChecklist(items);
    const parsed = JSON.parse(json) as { label: string; passed: boolean }[];
    // Every item must have label (string) and passed (boolean) for backwards compat
    for (const item of parsed) {
      expect(typeof item.label).toBe("string");
      expect(typeof item.passed).toBe("boolean");
    }
  });
});

// ─── countChecklist ───────────────────────────────────────────────────────────

describe("countChecklist", () => {
  it("returns zero passed and all failed for fresh checklist", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const { passed, failed, total } = countChecklist(items);
    expect(passed).toBe(0);
    expect(failed).toBe(total);
    expect(total).toBe(items.length);
  });

  it("counts correctly when some items are manually marked passed", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const withSomePassed = items.map((item, i) => ({ ...item, passed: i < 2 }));
    const { passed, failed } = countChecklist(withSomePassed);
    expect(passed).toBe(2);
    expect(failed).toBe(withSomePassed.length - 2);
  });

  it("total equals passed plus failed", () => {
    const items = generateQaChecklist(FULL_INPUT);
    const { passed, failed, total } = countChecklist(items);
    expect(passed + failed).toBe(total);
  });
});
